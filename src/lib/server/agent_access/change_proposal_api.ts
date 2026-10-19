import * as v from 'valibot';
import { and, asc, eq, gt } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { resolveAddressedWishlist } from './wishlist_address.js';
import { SERVER_ERROR, type ServerErrorCode } from '$lib/modules/errors/server_error_codes.js';
import {
	CHANGE_PROPOSAL_OUTCOME,
	CHANGE_PROPOSAL_STATUS,
	CHANGE_ROW_STATUS,
	NonEmptyIdSchema,
	type ChangeProposalView,
} from '$lib/modules/change_proposals/types.js';
import { OPERATION_KIND } from '$lib/server/operations/operation.js';
import { credentialReference, type AgentCaller } from './agent_caller.js';
import type { AgentAccessGrant } from './agent_grant.js';
import { AgentApiFailure } from './api.js';
import {
	authorizeAgentOperations,
	previewAgentOperationBatch,
	type AgentStepPreview,
	type AuthorizedAgentOperation,
} from './authorization.js';
import type { StoredChangeRow, StoredGiftBaseline } from './change_proposal_records.js';
import { TARGET_KIND, type TargetKind } from './policy_lookups.js';
import {
	acceptEveryReadyRow,
	applyChangeProposalRows,
	buildChangeProposalView,
	requireOwnChangeProposal,
} from './change_proposals.js';
import { baselineGiftIds, readGiftSnapshots, toChangeRowError } from './change_proposal_rows.js';
import { scheduleAgentAccessPurge } from './agent_access_purge.js';
import {
	assertWithinTrailingBudget,
	lockTrailingBudget,
	type TrailingBudget,
} from './trailing_budget.js';
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

/** The one wishlist a proposal targets, or null for a proposal that only creates wishlists. */
async function resolveProposalWishlist(
	grant: AgentAccessGrant,
	request: ChangeProposalRequest,
): Promise<{ id: string; shortId: string } | null> {
	if (request.wishlistShortId !== undefined && request.wishlistId !== undefined) {
		throw invalidProposal();
	}
	return resolveAddressedWishlist(grant, request);
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
	caller: AgentCaller,
	proposalWishlist: { id: string } | null,
	authorizedOperations: readonly AuthorizedAgentOperation[],
): void {
	authorizedOperations.forEach((authorized, index) => {
		const rowId = changeRowId(index);
		if (createsWishlist(authorized)) {
			const mayCreate =
				proposalWishlist === null &&
				caller.fastForward &&
				caller.grant.wishlistIds === null;
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

/** Rows count from every token and every outcome. */
const CHANGE_BUDGET: TrailingBudget = {
	lockName: 'agent-change-budget',
	limit: AGENT_DAILY_CHANGE_BUDGET.rows,
	windowMs: AGENT_DAILY_CHANGE_BUDGET.windowMs,
	exceededCode: SERVER_ERROR.AGENT_DAILY_CHANGE_BUDGET_EXCEEDED,
	limitDetail: 'budgetRows',
	recentSpends: (database, userId, windowStart) =>
		database
			.select({ createdAt: changeProposal.createdAt, amount: changeProposal.rowCount })
			.from(changeProposal)
			.where(
				and(
					eq(changeProposal.submitterUserId, userId),
					gt(changeProposal.createdAt, windowStart),
				),
			)
			.orderBy(asc(changeProposal.createdAt)),
};

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
	request: Pick<ChangeProposalRequest, 'operations'>,
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
export async function submitChangeProposal(caller: AgentCaller, body: unknown, now = new Date()) {
	const parsed = v.safeParse(ChangeProposalRequestSchema, body);
	if (!parsed.success) {
		throw invalidProposal();
	}
	const request = parsed.output;
	const { grant } = caller;
	const proposalWishlist = await resolveProposalWishlist(grant, request);
	const authorizedOperations = await authorizeAgentOperations(
		grant,
		request.operations.map((operation) => ({
			operationName: operation.operation,
			input: operation.input,
		})),
	);
	return storeChangeProposal(caller, proposalWishlist, authorizedOperations, request, now);
}

/** What an existing target that names no live wishlist answers. */
const MISSING_TARGET_ERROR = {
	[TARGET_KIND.wishlistId]: SERVER_ERROR.WISHLIST_NOT_FOUND,
	[TARGET_KIND.wishlistShortId]: SERVER_ERROR.WISHLIST_NOT_FOUND,
	[TARGET_KIND.giftId]: SERVER_ERROR.GIFT_NOT_FOUND,
	[TARGET_KIND.reservationId]: SERVER_ERROR.RESERVATION_NOT_FOUND,
	[TARGET_KIND.revisionBatchId]: SERVER_ERROR.GIFT_REVISION_NOT_FOUND,
} satisfies Record<TargetKind, ServerErrorCode>;

/**
 * Submits one change as a proposal of its own, on the wishlist the change targets (the first one
 * when it names several, such as a copy's source). A change that only creates a wishlist names
 * none, like a wishlist-creating proposal.
 */
export async function submitSingleChangeProposal(
	caller: AgentCaller,
	operationName: string,
	input: unknown,
	now = new Date(),
) {
	const { grant } = caller;
	const authorizedOperations = await authorizeAgentOperations(grant, [{ operationName, input }]);
	const [authorized] = authorizedOperations;
	if (authorized === undefined) {
		throw new Error(`Authorizing ${operationName} returned no operation`);
	}
	const [targetWishlistId] = authorized.targetWishlistIds;
	const [firstTarget] = authorized.lookup.targets;
	if (targetWishlistId === undefined && firstTarget !== undefined) {
		throw new AgentApiFailure(404, MISSING_TARGET_ERROR[firstTarget.kind]);
	}
	const proposalWishlist =
		targetWishlistId === undefined
			? null
			: await resolveAddressedWishlist(grant, { wishlistId: targetWishlistId });
	return storeChangeProposal(
		caller,
		proposalWishlist,
		authorizedOperations,
		{ operations: [{ operation: operationName, input }] },
		now,
	);
}

async function storeChangeProposal(
	caller: AgentCaller,
	proposalWishlist: { id: string; shortId: string } | null,
	authorizedOperations: readonly AuthorizedAgentOperation[],
	request: Pick<ChangeProposalRequest, 'operations'>,
	now: Date,
) {
	const { grant } = caller;
	if (
		authorizedOperations.some((authorized) => authorized.operation.kind === OPERATION_KIND.read)
	) {
		throw new AgentApiFailure(400, SERVER_ERROR.AGENT_PROPOSAL_NOT_A_CHANGE);
	}
	assertRowsFitWishlist(caller, proposalWishlist, authorizedOperations);
	const database = getDb();
	await assertWithinTrailingBudget(
		database,
		CHANGE_BUDGET,
		grant.userId,
		authorizedOperations.length,
		now,
	);

	const rows = await previewRows(grant, authorizedOperations, request);
	const fastForwards =
		caller.fastForward &&
		rows.every((row) => row.rejection === null && !row.requiresConfirmation);
	const proposalId = await database.transaction(async (transaction) => {
		await lockTrailingBudget(transaction, CHANGE_BUDGET, grant.userId);
		await assertWithinTrailingBudget(
			transaction,
			CHANGE_BUDGET,
			grant.userId,
			rows.length,
			now,
		);
		const createsOnlyWishlists = proposalWishlist === null;
		const [inserted] = await transaction
			.insert(changeProposal)
			.values({
				wishlistId: proposalWishlist?.id ?? null,
				submitterUserId: grant.userId,
				...credentialReference(caller.credential),
				channel: grant.channel,
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
			acceptEveryReadyRow(rows),
		);
		applied = result.outcome === CHANGE_PROPOSAL_OUTCOME.applied;
	} catch (thrown) {
		console.error('Fast-forwarding change proposal failed', proposalId, thrown);
	}
	if (!applied && createsOnlyWishlists) {
		await discardUnappliedProposal(proposalId);
	}
}

/** The caller's user's own proposal; 403 when the caller's wishlist restriction excludes it. */
async function requireAgentChangeProposal(caller: AgentCaller, proposalId: string) {
	const record = await requireOwnChangeProposal(caller.grant.userId, proposalId);
	const allowedWishlistIds = caller.grant.wishlistIds;
	const { wishlistId } = record.proposal;
	if (
		allowedWishlistIds !== null &&
		(wishlistId === null || !allowedWishlistIds.includes(wishlistId))
	) {
		throw new AgentApiFailure(403, SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED);
	}
	return record;
}

export async function readChangeProposalForAgent(caller: AgentCaller, proposalId: string) {
	return projectChangeProposalForAgent(
		await buildChangeProposalView(await requireAgentChangeProposal(caller, proposalId)),
	);
}

function reviewRequired(view: ChangeProposalView, details: Record<string, unknown> = {}) {
	return new AgentApiFailure(409, SERVER_ERROR.AGENT_PROPOSAL_REVIEW_REQUIRED, {
		reviewUrl: view.reviewUrl,
		...details,
	});
}

/**
 * Applies a pending proposal under the rule fast-forward applies at submission, for one that
 * waited because its apply failed or a gift changed meanwhile. Only the fast-forward token that
 * submitted it may, so no token skips the review another token's proposal waits for.
 */
export async function applyChangeProposalForAgent(caller: AgentCaller, proposalId: string) {
	const record = await requireAgentChangeProposal(caller, proposalId);
	const view = await buildChangeProposalView(record);
	if (view.state !== CHANGE_PROPOSAL_STATUS.pending) {
		throw new AgentApiFailure(409, SERVER_ERROR.AGENT_PROPOSAL_NOT_PENDING, {
			status: view.state,
		});
	}
	if (!caller.fastForward || record.proposal.tokenId !== caller.credential.id) {
		throw reviewRequired(view);
	}
	if (view.rows.some((row) => row.status !== CHANGE_ROW_STATUS.ready)) {
		throw reviewRequired(view);
	}
	const result = await applyChangeProposalRows(
		{ id: caller.grant.userId, name: caller.grant.userName },
		proposalId,
		acceptEveryReadyRow(record.proposal.rows),
	);
	if (result.outcome !== CHANGE_PROPOSAL_OUTCOME.applied) {
		throw reviewRequired(view, { outcome: result.outcome });
	}
	return projectChangeProposalForAgent(result.proposal);
}
