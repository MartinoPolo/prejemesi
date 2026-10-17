import * as v from 'valibot';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CHANGE_PROPOSAL_OUTCOME,
	CHANGE_PROPOSAL_STATUS,
	NonEmptyIdSchema,
	type ChangeProposalView,
} from '$lib/modules/change_proposals/types.js';
import { OPERATION_KIND } from '$lib/server/operations/operation.js';
import { tokenChannel } from '$lib/server/operations/actor.js';
import type { AuthenticatedAccessToken } from './access_tokens.js';
import type { AgentAccessGrant } from './agent_grant.js';
import { AgentApiFailure } from './api.js';
import {
	authorizeAgentOperations,
	previewAgentOperationBatch,
	type AgentStepPreview,
	type AuthorizedAgentOperation,
} from './authorization.js';
import type { StoredChangeRow, StoredGiftBaseline } from './change_proposal_records.js';
import { TARGET_KIND, type LookupDatabase } from './policy_lookups.js';
import {
	applyChangeProposalRows,
	buildChangeProposalView,
	requireOwnChangeProposal,
} from './change_proposals.js';
import { baselineGiftIds, readGiftSnapshots, toChangeRowError } from './change_proposal_rows.js';
import { scheduleAgentAccessPurge } from './agent_access_purge.js';
import { AGENT_DAILY_CHANGE_BUDGET, CHANGE_PROPOSAL_LIFETIME_MS } from './limits.js';
import type { GiftRevisionSnapshot } from '$lib/server/operations/gift_revision_snapshot.js';

const CHANGE_ROW_ID_PREFIX = 'r';

/** Rows are numbered in submission order, so an agent can match results to its request. */
function changeRowId(index: number): string {
	return `${CHANGE_ROW_ID_PREFIX}${index + 1}`;
}

const ChangeProposalRequestSchema = v.strictObject({
	wishlistShortId: v.optional(NonEmptyIdSchema),
	wishlistId: v.optional(NonEmptyIdSchema),
	operations: v.array(v.strictObject({ operation: v.string(), input: v.unknown() })),
});

type ChangeProposalRequest = v.InferOutput<typeof ChangeProposalRequestSchema>;

function invalidProposal(): AgentApiFailure {
	return new AgentApiFailure(400, SERVER_ERROR.AGENT_PROPOSAL_INVALID);
}

/**
 * The one wishlist a proposal targets, or null for a proposal that only creates wishlists. A
 * restricted token gets 403 for an unknown wishlist too, so it cannot probe which ids exist.
 */
async function resolveProposalWishlist(
	grant: AgentAccessGrant,
	request: ChangeProposalRequest,
): Promise<{ id: string; shortId: string } | null> {
	const { wishlistShortId, wishlistId } = request;
	if (wishlistShortId !== undefined && wishlistId !== undefined) {
		throw invalidProposal();
	}
	if (wishlistShortId === undefined && wishlistId === undefined) {
		return null;
	}
	const [wishlistRow] = await getDb()
		.select({ id: wishlist.id, shortId: wishlist.shortId })
		.from(wishlist)
		.where(
			and(
				wishlistShortId === undefined
					? eq(wishlist.id, wishlistId ?? '')
					: eq(wishlist.shortId, wishlistShortId),
				isNull(wishlist.deletedAt),
				wishlistScope(),
			),
		)
		.limit(1);
	const allowedWishlistIds = grant.wishlistIds;
	if (
		allowedWishlistIds !== null &&
		(wishlistRow === undefined || !allowedWishlistIds.includes(wishlistRow.id))
	) {
		throw new AgentApiFailure(403, SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED);
	}
	if (wishlistRow === undefined) {
		throw new AgentApiFailure(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}
	return wishlistRow;
}

function createsWishlist(authorized: AuthorizedAgentOperation): boolean {
	return authorized.lookup.targets.length === 0;
}

/**
 * Every row must change the proposal's wishlist, so one review page covers it. Creating a
 * wishlist has no page to review it on: only an unrestricted fast-forward token may, in a
 * proposal naming no wishlist, which applies at once. A row whose reference resolves to nothing
 * stays in the proposal and the dry run rejects it.
 */
function assertRowsFitWishlist(
	token: AuthenticatedAccessToken,
	proposalWishlist: { id: string } | null,
	authorizedOperations: readonly AuthorizedAgentOperation[],
): void {
	authorizedOperations.forEach((authorized, index) => {
		const rowId = changeRowId(index);
		if (createsWishlist(authorized)) {
			const mayCreate =
				proposalWishlist === null && token.fastForward && token.grant.wishlistIds === null;
			if (!mayCreate) {
				throw new AgentApiFailure(
					400,
					SERVER_ERROR.AGENT_WISHLIST_CREATION_REQUIRES_FAST_FORWARD,
					{ rowId },
				);
			}
			return;
		}
		if (proposalWishlist === null) {
			throw new AgentApiFailure(400, SERVER_ERROR.AGENT_PROPOSAL_INVALID, { rowId });
		}
		const { targetWishlistIds } = authorized;
		if (targetWishlistIds.length > 0 && !targetWishlistIds.includes(proposalWishlist.id)) {
			throw new AgentApiFailure(400, SERVER_ERROR.AGENT_PROPOSAL_WISHLIST_MISMATCH, {
				rowId,
			});
		}
	});
}

/**
 * Seconds until enough of the user's rows leave the trailing window for this many more, or null
 * while they fit the daily change budget. Rows count from every token and every outcome.
 */
async function secondsUntilBudgetFits(
	database: LookupDatabase,
	userId: string,
	requestedRows: number,
	now: Date,
): Promise<number | null> {
	const windowStart = new Date(now.getTime() - AGENT_DAILY_CHANGE_BUDGET.windowMs);
	const recentProposals = await database
		.select({ createdAt: changeProposal.createdAt, rowCount: changeProposal.rowCount })
		.from(changeProposal)
		.where(
			and(
				eq(changeProposal.submitterUserId, userId),
				gt(changeProposal.createdAt, windowStart),
			),
		)
		.orderBy(asc(changeProposal.createdAt));
	let usedRows = recentProposals.reduce((sum, proposal) => sum + proposal.rowCount, 0);
	if (usedRows + requestedRows <= AGENT_DAILY_CHANGE_BUDGET.rows) {
		return null;
	}
	for (const proposal of recentProposals) {
		usedRows -= proposal.rowCount;
		if (usedRows + requestedRows <= AGENT_DAILY_CHANGE_BUDGET.rows) {
			const leavesWindowAt =
				proposal.createdAt.getTime() + AGENT_DAILY_CHANGE_BUDGET.windowMs;
			return Math.max(1, Math.ceil((leavesWindowAt - now.getTime()) / 1000));
		}
	}
	return Math.ceil(AGENT_DAILY_CHANGE_BUDGET.windowMs / 1000);
}

async function assertWithinChangeBudget(
	database: LookupDatabase,
	userId: string,
	requestedRows: number,
	now: Date,
): Promise<void> {
	const retryAfterSeconds = await secondsUntilBudgetFits(database, userId, requestedRows, now);
	if (retryAfterSeconds !== null) {
		throw new AgentApiFailure(
			429,
			SERVER_ERROR.AGENT_DAILY_CHANGE_BUDGET_EXCEEDED,
			{
				retryAfterSeconds,
				budgetRows: AGENT_DAILY_CHANGE_BUDGET.rows,
				windowSeconds: AGENT_DAILY_CHANGE_BUDGET.windowMs / 1000,
			},
			{ 'retry-after': String(retryAfterSeconds) },
		);
	}
}

function storedRow(
	authorized: AuthorizedAgentOperation,
	preview: AgentStepPreview,
	index: number,
	giftsAtSubmission: ReadonlyMap<string, GiftRevisionSnapshot>,
	rawRequest: { operation: string; input: unknown },
): StoredChangeRow {
	const giftChanges = preview.accepted
		? preview.revisions.map((revision) => ({
				giftId: revision.giftId,
				before: revision.before,
				after: revision.after,
			}))
		: [];
	const baseline = baselineGiftIds(authorized.lookup.targets, giftChanges).flatMap(
		(giftId): StoredGiftBaseline[] => {
			const snapshot = giftsAtSubmission.get(giftId);
			return snapshot === undefined ? [] : [{ giftId, snapshot }];
		},
	);
	return {
		rowId: changeRowId(index),
		operation: rawRequest.operation,
		input: rawRequest.input,
		requiresConfirmation: authorized.requiresConfirmation,
		rejection: preview.accepted ? null : toChangeRowError(preview.rejection),
		preview: preview.accepted ? { giftChanges, result: preview.result } : null,
		baseline,
	};
}

/**
 * The gifts as they were at submission: the named ones read under the locks before the first row
 * runs, and every other gift the dry run changed from the first revision touching it, since the
 * preview steps build on each other.
 */
function giftsAtSubmissionOf(
	namedGifts: ReadonlyMap<string, GiftRevisionSnapshot>,
	previews: readonly AgentStepPreview[],
): Map<string, GiftRevisionSnapshot> {
	const giftsAtSubmission = new Map(namedGifts);
	for (const preview of previews) {
		for (const revision of preview.accepted ? preview.revisions : []) {
			if (revision.before !== null && !giftsAtSubmission.has(revision.giftId)) {
				giftsAtSubmission.set(revision.giftId, revision.before);
			}
		}
	}
	return giftsAtSubmission;
}

/** Dry-runs every row under the batch's locks; each row's conflict baseline is the state at submission. */
async function previewRows(
	grant: AgentAccessGrant,
	authorizedOperations: readonly AuthorizedAgentOperation[],
	request: ChangeProposalRequest,
): Promise<StoredChangeRow[]> {
	const namedGiftIds = [
		...new Set(
			authorizedOperations.flatMap((authorized) =>
				authorized.lookup.targets
					.filter((target) => target.kind === TARGET_KIND.giftId)
					.map((target) => target.id),
			),
		),
	];
	let namedGifts = new Map<string, GiftRevisionSnapshot>();
	const previews = await previewAgentOperationBatch(grant, authorizedOperations, {
		verifyLocked: async (transaction) => {
			namedGifts = await readGiftSnapshots(transaction, namedGiftIds);
		},
	});
	const giftsAtSubmission = giftsAtSubmissionOf(namedGifts, previews);
	return authorizedOperations.map((authorized, index) => {
		const preview = previews[index];
		const rawRequest = request.operations[index];
		if (preview === undefined || rawRequest === undefined) {
			throw new Error(`Missing preview for row ${index}`);
		}
		return storedRow(authorized, preview, index, giftsAtSubmission, rawRequest);
	});
}

/** Serializes one user's submissions so concurrent ones cannot both pass the budget check. */
async function lockUserChangeBudget(
	transaction: DatabaseTransaction,
	userId: string,
): Promise<void> {
	await transaction.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`agent-change-budget:${userId}`}, 0))`,
	);
}

/** A proposal as the API reports it; reviewer-only details (gift previews, names) stay out. */
function projectChangeProposalForAgent(view: ChangeProposalView) {
	return {
		id: view.id,
		status: view.state,
		wishlistShortId: view.wishlistShortId,
		reviewUrl: view.reviewUrl,
		createdAt: view.createdAt,
		expiresAt: view.expiresAt,
		appliedAt: view.appliedAt,
		discardedAt: view.discardedAt,
		undoneAt: view.undoneAt,
		rows: view.rows.map((row) => ({
			rowId: row.rowId,
			operation: row.operation,
			kind: row.kind,
			status: row.status,
			requiresConfirmation: row.requiresConfirmation,
			error: row.error,
			conflictGiftIds: row.conflicts.map((conflict) => conflict.giftId),
			result: row.appliedResult ?? row.preview?.result ?? null,
		})),
	};
}

async function agentProposalView(userId: string, proposalId: string) {
	return projectChangeProposalForAgent(
		await buildChangeProposalView(await requireOwnChangeProposal(userId, proposalId)),
	);
}

async function discardUnappliedProposal(proposalId: string): Promise<void> {
	await getDb()
		.update(changeProposal)
		.set({ status: CHANGE_PROPOSAL_STATUS.discarded, discardedAt: new Date() })
		.where(
			and(
				eq(changeProposal.id, proposalId),
				eq(changeProposal.status, CHANGE_PROPOSAL_STATUS.pending),
			),
		);
}

/**
 * Submits a proposal: authorizes every row with the token's grant, dry-runs the rows and stores
 * them for the user to review. With fast-forward, a proposal whose rows are all ready and none
 * needs confirmation applies at once; a wishlist-creating proposal that cannot is discarded.
 */
export async function submitChangeProposal(
	token: AuthenticatedAccessToken,
	body: unknown,
	now = new Date(),
) {
	const parsed = v.safeParse(ChangeProposalRequestSchema, body);
	if (!parsed.success) {
		throw invalidProposal();
	}
	const request = parsed.output;
	const { grant } = token;
	const proposalWishlist = await resolveProposalWishlist(grant, request);
	const authorizedOperations = await authorizeAgentOperations(
		grant,
		request.operations.map((operation) => ({
			operationName: operation.operation,
			input: operation.input,
		})),
	);
	if (
		authorizedOperations.some((authorized) => authorized.operation.kind === OPERATION_KIND.read)
	) {
		throw new AgentApiFailure(400, SERVER_ERROR.AGENT_PROPOSAL_NOT_A_CHANGE);
	}
	assertRowsFitWishlist(token, proposalWishlist, authorizedOperations);
	const database = getDb();
	await assertWithinChangeBudget(database, grant.userId, authorizedOperations.length, now);

	const rows = await previewRows(grant, authorizedOperations, request);
	const fastForwards =
		token.fastForward &&
		rows.every((row) => row.rejection === null && !row.requiresConfirmation);
	const proposalId = await database.transaction(async (transaction) => {
		await lockUserChangeBudget(transaction, grant.userId);
		await assertWithinChangeBudget(transaction, grant.userId, rows.length, now);
		const createsOnlyWishlists = proposalWishlist === null;
		const [inserted] = await transaction
			.insert(changeProposal)
			.values({
				wishlistId: proposalWishlist?.id ?? null,
				submitterUserId: grant.userId,
				tokenId: token.tokenId,
				channel: tokenChannel(grant.tokenName),
				tokenName: grant.tokenName,
				grant: {
					scopes: [...grant.scopes],
					wishlistIds: grant.wishlistIds === null ? null : [...grant.wishlistIds],
				},
				status:
					createsOnlyWishlists && !fastForwards
						? CHANGE_PROPOSAL_STATUS.discarded
						: CHANGE_PROPOSAL_STATUS.pending,
				discardedAt: createsOnlyWishlists && !fastForwards ? now : null,
				rows,
				rowCount: rows.length,
				createdAt: now,
				expiresAt: new Date(now.getTime() + CHANGE_PROPOSAL_LIFETIME_MS),
			})
			.returning({ id: changeProposal.id });
		if (inserted === undefined) {
			throw new Error('Inserting the change proposal returned no row');
		}
		return inserted.id;
	});

	if (fastForwards) {
		await fastForwardProposal(grant, proposalId, rows, proposalWishlist === null);
	}
	scheduleAgentAccessPurge();
	return agentProposalView(grant.userId, proposalId);
}

/**
 * Applies a just-stored proposal at once. The proposal is already committed, so a failed apply
 * must not fail the request: the agent gets the pending proposal back to retry or review. A
 * wishlist-creating proposal has no review page, so one that did not apply is discarded instead.
 */
async function fastForwardProposal(
	grant: AgentAccessGrant,
	proposalId: string,
	rows: readonly StoredChangeRow[],
	createsOnlyWishlists: boolean,
): Promise<void> {
	let applied = false;
	try {
		const result = await applyChangeProposalRows(
			{ id: grant.userId, name: grant.userName },
			proposalId,
			rows.map((row) => row.rowId),
		);
		applied = result.outcome === CHANGE_PROPOSAL_OUTCOME.applied;
	} catch (thrown) {
		console.error('Fast-forwarding change proposal failed', proposalId, thrown);
	}
	if (!applied && createsOnlyWishlists) {
		await discardUnappliedProposal(proposalId);
	}
}

/** The token's user's own proposal; 403 when the token's wishlist restriction excludes it. */
export async function readChangeProposalForAgent(
	token: AuthenticatedAccessToken,
	proposalId: string,
) {
	const record = await requireOwnChangeProposal(token.grant.userId, proposalId);
	const allowedWishlistIds = token.grant.wishlistIds;
	const { wishlistId } = record.proposal;
	if (
		allowedWishlistIds !== null &&
		(wishlistId === null || !allowedWishlistIds.includes(wishlistId))
	) {
		throw new AgentApiFailure(403, SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED);
	}
	return projectChangeProposalForAgent(await buildChangeProposalView(record));
}
