import { and, desc, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { error, isHttpError } from '@sveltejs/kit';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { personalAccessToken } from '$lib/server/db/access_token.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { giftRevision } from '$lib/server/db/gift_revision.schema.js';
import { moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { requireLiveWishlistRowByShortId } from '$lib/server/operations/wishlist_management.js';
import { SERVER_ERROR, encodeServerError } from '$lib/modules/errors/server_error_codes.js';
import { resolveRoleOnWishlistRow } from '$lib/modules/wishlists/wishlist_access.js';
import { hidesReservationState } from '$lib/modules/wishlists/wishlist_capabilities.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';
import {
	CHANGE_KIND,
	CHANGE_PROPOSAL_OUTCOME,
	CHANGE_PROPOSAL_STATE,
	CHANGE_PROPOSAL_STATUS,
	CHANGE_ROW_STATUS,
	changeProposalReviewPath,
	type ApplyChangeProposalResult,
	type ChangeProposalRowView,
	type ChangeProposalState,
	type ChangeProposalView,
	type ChangeRowConflict,
	type ChangeRowStatus,
	type FailedChangeRows,
	type PendingChangeProposalSummary,
	type UndoChangeProposalResult,
} from '$lib/modules/change_proposals/types.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { executeOperationBatch, type OperationBatchStep } from '$lib/server/operations/runner.js';
import { undoGiftRevisionBatchOperation } from '$lib/server/operations/gift_undo_operations.js';
import {
	cancelOwnReservationOperation,
	reserveGiftOperation,
} from '$lib/server/operations/reservation_operations.js';
import {
	generateModeratorInviteLinkOperation,
	revokeModeratorInviteOperation,
} from '$lib/server/operations/manager_invitation_operations.js';
import type { AgentAccessGrant } from './agent_grant.js';
import {
	authorizeAgentOperations,
	executeAgentOperationBatch,
	type AuthorizedAgentOperation,
} from './authorization.js';
import type { ChangeProposalUndoTargets, StoredChangeRow } from './change_proposal_records.js';
import {
	changeKindOf,
	changeRowErrorOf,
	countChangeKinds,
	describeConflicts,
	findConflictingGiftIds,
	undoSupportsOperation,
} from './change_proposal_rows.js';
import { projectAgentGiftSnapshot } from './read_projections.js';
import { describeServerError } from './server_error_description.js';
import { scheduleAgentAccessPurge } from './agent_access_purge.js';

type ChangeProposalRow = typeof changeProposal.$inferSelect;

/** A proposal with what its views show about the wishlist, the submitter and the token. */
export interface ChangeProposalRecord {
	proposal: ChangeProposalRow;
	wishlistShortId: string | null;
	submitterName: string;
	tokenRevoked: boolean;
	/** The submitter's current role on the proposal's wishlist; null for a proposal without one. */
	viewerRole: WishlistRole | null;
	/** That role must not see reservation state: an ordinary linked recipient. */
	hidesReservations: boolean;
}

/** The session user acting on their own proposal. */
export interface ChangeProposalReviewer {
	id: string;
	name: string;
	email?: string | null;
}

function notFound(): never {
	error(404, SERVER_ERROR.AGENT_PROPOSAL_NOT_FOUND);
}

/**
 * The submitter's own proposal, with their current role on its wishlist. 404 for a missing
 * proposal, someone else's and one whose wishlist the submitter can no longer read (deleted or
 * outside their demo scope) alike, so ids cannot be probed and lost access shows nothing.
 */
export async function requireOwnChangeProposal(
	submitterUserId: string,
	proposalId: string,
): Promise<ChangeProposalRecord> {
	const [found] = await getDb()
		.select({
			proposal: changeProposal,
			wishlistRow: wishlist,
			submitterName: user.name,
			tokenRevokedAt: personalAccessToken.revokedAt,
			liveTokenId: personalAccessToken.id,
		})
		.from(changeProposal)
		.innerJoin(user, eq(user.id, changeProposal.submitterUserId))
		.leftJoin(
			wishlist,
			and(
				eq(wishlist.id, changeProposal.wishlistId),
				isNull(wishlist.deletedAt),
				wishlistScope(),
			),
		)
		.leftJoin(personalAccessToken, eq(personalAccessToken.id, changeProposal.tokenId))
		.where(
			and(
				eq(changeProposal.id, proposalId),
				eq(changeProposal.submitterUserId, submitterUserId),
			),
		);
	if (found === undefined) {
		notFound();
	}
	const { proposal, wishlistRow } = found;
	if (proposal.wishlistId !== null && wishlistRow === null) {
		notFound();
	}
	const viewerRole =
		wishlistRow === null ? null : await resolveRoleOnWishlistRow(submitterUserId, wishlistRow);
	return {
		proposal,
		wishlistShortId: wishlistRow?.shortId ?? null,
		submitterName: found.submitterName,
		tokenRevoked: found.liveTokenId === null || found.tokenRevokedAt !== null,
		viewerRole,
		hidesReservations:
			viewerRole !== null &&
			wishlistRow !== null &&
			hidesReservationState(viewerRole, wishlistRow.recipientIsModerator),
	};
}

function isExpired(proposal: Pick<ChangeProposalRow, 'expiresAt'>, now: Date): boolean {
	return proposal.expiresAt.getTime() <= now.getTime();
}

function proposalState(proposal: ChangeProposalRow, now: Date): ChangeProposalState {
	return proposal.status === CHANGE_PROPOSAL_STATUS.pending && isExpired(proposal, now)
		? CHANGE_PROPOSAL_STATE.expired
		: proposal.status;
}

/** 409 once applied, discarded or undone; 410 once a pending proposal expired. */
function assertPending(proposal: ChangeProposalRow, now: Date): void {
	if (proposal.status !== CHANGE_PROPOSAL_STATUS.pending) {
		error(409, SERVER_ERROR.AGENT_PROPOSAL_NOT_PENDING);
	}
	if (isExpired(proposal, now)) {
		error(410, SERVER_ERROR.AGENT_PROPOSAL_EXPIRED);
	}
}

async function lockChangeProposal(
	transaction: DatabaseTransaction,
	proposalId: string,
): Promise<ChangeProposalRow> {
	const [locked] = await transaction
		.select()
		.from(changeProposal)
		.where(eq(changeProposal.id, proposalId))
		.for('update');
	if (locked === undefined) {
		notFound();
	}
	return locked;
}

/** Applied rows undo cannot reverse: unsupported operations, and invitations already accepted. */
async function rowsBlockingUndo(proposal: ChangeProposalRow): Promise<string[]> {
	const appliedRowIds = new Set(proposal.appliedRowIds ?? []);
	const unsupportedRowIds = proposal.rows
		.filter((row) => appliedRowIds.has(row.rowId) && !undoSupportsOperation(row.operation))
		.map((row) => row.rowId);
	const invites = proposal.undoTargets?.moderatorInvites ?? [];
	const acceptedInvites =
		invites.length === 0
			? []
			: await getDb()
					.select({ id: moderatorInvite.id })
					.from(moderatorInvite)
					.where(
						and(
							inArray(
								moderatorInvite.id,
								invites.map((invite) => invite.inviteId),
							),
							isNotNull(moderatorInvite.usedAt),
						),
					);
	const acceptedInviteIds = new Set(acceptedInvites.map((invite) => invite.id));
	const acceptedRowIds = invites
		.filter((invite) => acceptedInviteIds.has(invite.inviteId))
		.map((invite) => invite.rowId);
	return [...new Set([...unsupportedRowIds, ...acceptedRowIds])];
}

function dryRunStatus(row: StoredChangeRow): ChangeRowStatus {
	if (row.rejection !== null) {
		return CHANGE_ROW_STATUS.rejected;
	}
	return row.requiresConfirmation ? CHANGE_ROW_STATUS.needsConfirmation : CHANGE_ROW_STATUS.ready;
}

function rowStatus(
	proposal: ChangeProposalRow,
	row: StoredChangeRow,
	hasConflict: boolean,
): ChangeRowStatus {
	const applied = (proposal.appliedRowIds ?? []).includes(row.rowId);
	switch (proposal.status) {
		case CHANGE_PROPOSAL_STATUS.applied:
			return applied ? CHANGE_ROW_STATUS.applied : CHANGE_ROW_STATUS.notApplied;
		case CHANGE_PROPOSAL_STATUS.undone:
			return applied ? CHANGE_ROW_STATUS.undone : CHANGE_ROW_STATUS.notApplied;
		case CHANGE_PROPOSAL_STATUS.discarded:
			return dryRunStatus(row);
		case CHANGE_PROPOSAL_STATUS.pending:
			return row.rejection === null && hasConflict
				? CHANGE_ROW_STATUS.conflict
				: dryRunStatus(row);
		default: {
			const unhandled: never = proposal.status;
			throw new Error(`Unknown proposal status ${String(unhandled)}`);
		}
	}
}

/**
 * Gift previews carry no reservation or like data, so they suit every role. A reservation row's
 * result and error details can (an id, the available count): a viewer whose current role hides
 * reservation state sees only that the row exists and why it failed.
 */
function rowView(
	record: ChangeProposalRecord,
	row: StoredChangeRow,
	conflicts: ChangeRowConflict[],
): ChangeProposalRowView {
	const kind = changeKindOf(row.operation);
	const hidesRowDetails = record.hidesReservations && kind === CHANGE_KIND.reservation;
	return {
		rowId: row.rowId,
		operation: row.operation,
		kind,
		input: row.input,
		requiresConfirmation: row.requiresConfirmation,
		status: rowStatus(record.proposal, row, conflicts.length > 0),
		error:
			row.rejection === null || !hidesRowDetails
				? row.rejection
				: { ...row.rejection, details: {} },
		conflicts,
		preview:
			row.preview === null
				? null
				: {
						gifts: row.preview.giftChanges.map((change) => ({
							giftId: change.giftId,
							before:
								change.before === null
									? null
									: projectAgentGiftSnapshot(change.before),
							after: projectAgentGiftSnapshot(change.after),
						})),
						result: hidesRowDetails ? null : row.preview.result,
					},
		appliedResult: hidesRowDetails ? null : (row.appliedResult ?? null),
	};
}

/** Live conflicts for a pending proposal; a settled proposal no longer compares its rows. */
async function liveConflicts(
	proposal: ChangeProposalRow,
): Promise<Map<string, ChangeRowConflict[]>> {
	if (proposal.status !== CHANGE_PROPOSAL_STATUS.pending) {
		return new Map();
	}
	const database = getDb();
	const comparedRows = proposal.rows.filter((row) => row.rejection === null);
	const { conflicts, currentSnapshots } = await findConflictingGiftIds(database, comparedRows);
	return describeConflicts(database, conflicts, currentSnapshots, proposal.createdAt);
}

export async function buildChangeProposalView(
	record: ChangeProposalRecord,
	now = new Date(),
): Promise<ChangeProposalView> {
	const { proposal } = record;
	const conflictsByRow = await liveConflicts(proposal);
	const undoBlockingRowIds =
		proposal.status === CHANGE_PROPOSAL_STATUS.applied ? await rowsBlockingUndo(proposal) : [];
	return {
		id: proposal.id,
		state: proposalState(proposal, now),
		wishlistShortId: record.wishlistShortId,
		reviewUrl:
			record.wishlistShortId === null
				? null
				: changeProposalReviewPath(record.wishlistShortId, proposal.id),
		submitterName: record.submitterName,
		viewerRole: record.viewerRole,
		channel: proposal.channel,
		tokenName: proposal.tokenName,
		tokenRevoked: record.tokenRevoked,
		createdAt: proposal.createdAt,
		expiresAt: proposal.expiresAt,
		appliedAt: proposal.appliedAt,
		discardedAt: proposal.discardedAt,
		undoneAt: proposal.undoneAt,
		rowCount: proposal.rowCount,
		kindCounts: countChangeKinds(proposal.rows),
		undo:
			proposal.status === CHANGE_PROPOSAL_STATUS.applied
				? { available: undoBlockingRowIds.length === 0, blockingRowIds: undoBlockingRowIds }
				: null,
		rows: proposal.rows.map((row) => rowView(record, row, conflictsByRow.get(row.rowId) ?? [])),
	};
}

async function ownChangeProposalView(
	submitterUserId: string,
	proposalId: string,
): Promise<ChangeProposalView> {
	return buildChangeProposalView(await requireOwnChangeProposal(submitterUserId, proposalId));
}

/** The review page's proposal: only its submitter sees it, only under its own wishlist. */
export async function getChangeProposalForReview(
	reviewer: ChangeProposalReviewer,
	address: { wishlistShortId: string; proposalId: string },
): Promise<ChangeProposalView> {
	const record = await requireOwnChangeProposal(reviewer.id, address.proposalId);
	if (record.wishlistShortId !== address.wishlistShortId) {
		notFound();
	}
	return buildChangeProposalView(record);
}

/** The driver hands raw jsonb over as text. */
function operationNamesOf(value: unknown): string[] {
	const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
	if (!Array.isArray(parsed) || !parsed.every((name) => typeof name === 'string')) {
		throw new Error('Change proposal rows lack operation names');
	}
	return parsed;
}

/**
 * The session user's own pending, unexpired proposals for one wishlist they can read, newest
 * first. Only each row's operation name leaves the database, not the stored previews.
 */
export async function listPendingChangeProposals(
	reviewer: Pick<ChangeProposalReviewer, 'id'>,
	wishlistShortId: string,
	now = new Date(),
): Promise<PendingChangeProposalSummary[]> {
	const database = getDb();
	const wishlistRow = await requireLiveWishlistRowByShortId(database, wishlistShortId);
	const pendingProposals = await database
		.select({
			id: changeProposal.id,
			channel: changeProposal.channel,
			tokenName: changeProposal.tokenName,
			createdAt: changeProposal.createdAt,
			expiresAt: changeProposal.expiresAt,
			rowCount: changeProposal.rowCount,
			operations:
				sql`jsonb_path_query_array(${changeProposal.rows}, '$[*].operation')`.mapWith(
					operationNamesOf,
				),
		})
		.from(changeProposal)
		.where(
			and(
				eq(changeProposal.wishlistId, wishlistRow.id),
				eq(changeProposal.submitterUserId, reviewer.id),
				eq(changeProposal.status, CHANGE_PROPOSAL_STATUS.pending),
				gt(changeProposal.expiresAt, now),
			),
		)
		.orderBy(desc(changeProposal.createdAt), desc(changeProposal.id));
	return pendingProposals.map(({ operations, ...proposal }) => ({
		...proposal,
		reviewUrl: changeProposalReviewPath(wishlistShortId, proposal.id),
		kindCounts: countChangeKinds(operations.map((operation) => ({ operation }))),
	}));
}

/** The grant the proposal was submitted with, acting as its user through the token's channel. */
function submittedGrant(
	proposal: ChangeProposalRow,
	reviewer: Pick<ChangeProposalReviewer, 'id' | 'name'>,
): AgentAccessGrant {
	return {
		userId: reviewer.id,
		userName: reviewer.name,
		tokenName: proposal.tokenName,
		scopes: proposal.grant.scopes,
		wishlistIds: proposal.grant.wishlistIds,
	};
}

/** 400 listing the selected row ids that are unknown, repeated or rejected by the dry run. */
function selectRows(rows: readonly StoredChangeRow[], selectedRowIds: readonly string[]) {
	const rowsById = new Map(rows.map((row) => [row.rowId, row]));
	const invalidRowIds = selectedRowIds.filter(
		(rowId, index) =>
			selectedRowIds.indexOf(rowId) !== index || rowsById.get(rowId)?.rejection !== null,
	);
	if (selectedRowIds.length === 0 || invalidRowIds.length > 0) {
		error(
			400,
			encodeServerError(SERVER_ERROR.AGENT_PROPOSAL_SELECTION_INVALID, {
				rowIds: [...new Set(invalidRowIds)].join(','),
			}),
		);
	}
	const selected = new Set(selectedRowIds);
	// Submission order, whatever order the reviewer selected in.
	return rows.filter((row) => selected.has(row.rowId));
}

type SelectedAuthorization = { authorized: AuthorizedAgentOperation[] } | FailedChangeRows;

/**
 * Re-authorizes the selected rows with the submitted grant, in one call; when that fails, row by
 * row so the result names the rows the grant no longer covers.
 */
async function authorizeSelectedRows(
	grant: AgentAccessGrant,
	rows: readonly StoredChangeRow[],
): Promise<SelectedAuthorization> {
	const requestOf = (row: StoredChangeRow) => ({
		operationName: row.operation,
		input: row.input,
	});
	try {
		return { authorized: await authorizeAgentOperations(grant, rows.map(requestOf)) };
	} catch (batchError) {
		if (changeRowErrorOf(batchError) === null) {
			throw batchError;
		}
		const failedRows: FailedChangeRows['rows'] = [];
		for (const row of rows) {
			try {
				await authorizeAgentOperations(grant, [requestOf(row)]);
			} catch (thrown) {
				const rowError = changeRowErrorOf(thrown);
				if (rowError === null) {
					throw thrown;
				}
				failedRows.push({ rowId: row.rowId, error: rowError });
			}
		}
		if (failedRows.length === 0) {
			throw batchError;
		}
		return { outcome: CHANGE_PROPOSAL_OUTCOME.failed, rows: failedRows };
	}
}

class ChangeProposalConflict extends Error {
	constructor(readonly conflicts: Map<string, string[]>) {
		super('Change proposal conflict');
	}
}

function stringField(output: unknown, field: string): string | null {
	if (typeof output !== 'object' || output === null || !(field in output)) {
		return null;
	}
	const value: unknown = Reflect.get(output, field);
	return typeof value === 'string' ? value : null;
}

/** The reservations and invitations the applied rows created, for undo to cancel and revoke. */
function collectUndoTargets(
	rows: readonly StoredChangeRow[],
	rawResults: readonly unknown[],
): ChangeProposalUndoTargets {
	const targets: ChangeProposalUndoTargets = { reservations: [], moderatorInvites: [] };
	for (const [index, row] of rows.entries()) {
		const output = rawResults[index];
		const reservationId =
			row.operation === reserveGiftOperation.name
				? stringField(output, 'reservationId')
				: null;
		if (reservationId !== null) {
			targets.reservations.push({ rowId: row.rowId, reservationId });
		}
		const inviteId =
			row.operation === generateModeratorInviteLinkOperation.name
				? stringField(output, 'inviteId')
				: null;
		if (inviteId !== null) {
			targets.moderatorInvites.push({ rowId: row.rowId, inviteId });
		}
	}
	return targets;
}

/** A step the core refused, as a result naming the rows it belongs to; null for a defect. */
function failedRowsResult(rowIds: readonly string[], thrown: unknown): FailedChangeRows | null {
	const rowError = changeRowErrorOf(thrown);
	if (rowError === null || rowIds.length === 0) {
		return null;
	}
	return {
		outcome: CHANGE_PROPOSAL_OUTCOME.failed,
		rows: rowIds.map((rowId) => ({ rowId, error: rowError })),
	};
}

/**
 * Applies the selected rows of a pending proposal in one transaction as its submitter through the
 * submitting token's channel, with the grant stored at submission, so a revoked token's proposal
 * still applies; the core checks the submitter's current role on every row. Every target wishlist
 * is locked first and then the proposal row; under those locks the proposal must still be pending
 * and every selected row's gifts unchanged since submission. A conflict, a row the core refuses
 * and an authorization that changed before the locks apply nothing and are answered as results.
 */
export async function applyChangeProposalRows(
	reviewer: Pick<ChangeProposalReviewer, 'id' | 'name'>,
	proposalId: string,
	selectedRowIds: readonly string[],
): Promise<ApplyChangeProposalResult> {
	const { proposal } = await requireOwnChangeProposal(reviewer.id, proposalId);
	assertPending(proposal, new Date());
	const selectedRows = selectRows(proposal.rows, selectedRowIds);
	const grant = submittedGrant(proposal, reviewer);
	const authorization = await authorizeSelectedRows(grant, selectedRows);
	if (!('authorized' in authorization)) {
		return authorization;
	}
	const { authorized } = authorization;
	let failedStepIndex: number | null = null;
	try {
		await executeAgentOperationBatch(grant, authorized, {
			verifyLocked: async (transaction) => {
				assertPending(await lockChangeProposal(transaction, proposal.id), new Date());
				const { conflicts } = await findConflictingGiftIds(transaction, selectedRows);
				if (conflicts.size > 0) {
					throw new ChangeProposalConflict(conflicts);
				}
			},
			onStepFailed: (stepIndex) => {
				failedStepIndex = stepIndex;
			},
			beforeCommit: async (transaction, batch) => {
				const appliedResults = new Map(
					selectedRows.map((row, index) => [
						row.rowId,
						authorized[index]?.projectOutput(batch.results[index]),
					]),
				);
				await transaction
					.update(changeProposal)
					.set({
						status: CHANGE_PROPOSAL_STATUS.applied,
						appliedAt: new Date(),
						appliedBatchId: batch.batchId,
						appliedRowIds: selectedRows.map((row) => row.rowId),
						undoTargets: collectUndoTargets(selectedRows, batch.results),
						rows: proposal.rows.map((row) =>
							appliedResults.has(row.rowId)
								? { ...row, appliedResult: appliedResults.get(row.rowId) ?? null }
								: row,
						),
					})
					.where(eq(changeProposal.id, proposal.id));
			},
		});
	} catch (thrown) {
		if (thrown instanceof ChangeProposalConflict) {
			const database = getDb();
			const { currentSnapshots } = await findConflictingGiftIds(database, selectedRows);
			const described = await describeConflicts(
				database,
				thrown.conflicts,
				currentSnapshots,
				proposal.createdAt,
			);
			return {
				outcome: CHANGE_PROPOSAL_OUTCOME.conflict,
				rows: [...described].map(([rowId, conflicts]) => ({ rowId, conflicts })),
			};
		}
		const failedRow = failedStepIndex === null ? undefined : selectedRows[failedStepIndex];
		const failed = failedRowsResult(failedRow === undefined ? [] : [failedRow.rowId], thrown);
		if (failed === null) {
			throw thrown;
		}
		return failed;
	}
	scheduleAgentAccessPurge();
	return {
		outcome: CHANGE_PROPOSAL_OUTCOME.applied,
		proposal: await ownChangeProposalView(reviewer.id, proposal.id),
	};
}

export async function discardChangeProposal(
	reviewer: Pick<ChangeProposalReviewer, 'id'>,
	proposalId: string,
): Promise<ChangeProposalView> {
	const { proposal } = await requireOwnChangeProposal(reviewer.id, proposalId);
	await getDb().transaction(async (transaction) => {
		const now = new Date();
		assertPending(await lockChangeProposal(transaction, proposal.id), now);
		await transaction
			.update(changeProposal)
			.set({ status: CHANGE_PROPOSAL_STATUS.discarded, discardedAt: now })
			.where(eq(changeProposal.id, proposal.id));
	});
	return ownChangeProposalView(reviewer.id, proposal.id);
}

/** One undo step and the proposal rows whose effect it reverses. */
interface UndoStep {
	step: OperationBatchStep;
	rowIds: string[];
}

/**
 * The undo batch: revoke the invitations still pending, restore the gifts through the core's
 * batch undo, then cancel the reservations still active. Invitations come first because revoking
 * locks the invitation before its wishlist, and the gift undo locks the wishlists itself.
 */
async function planUndoSteps(proposal: ChangeProposalRow): Promise<UndoStep[]> {
	const database = getDb();
	const targets = proposal.undoTargets ?? { reservations: [], moderatorInvites: [] };
	const inviteIds = targets.moderatorInvites.map((invite) => invite.inviteId);
	const pendingInviteIds =
		inviteIds.length === 0
			? new Set<string>()
			: new Set(
					(
						await database
							.select({ id: moderatorInvite.id })
							.from(moderatorInvite)
							.where(
								and(
									inArray(moderatorInvite.id, inviteIds),
									isNull(moderatorInvite.revokedAt),
									isNull(moderatorInvite.usedAt),
								),
							)
					).map((invite) => invite.id),
				);
	const reservationIds = targets.reservations.map((target) => target.reservationId);
	const activeReservationIds =
		reservationIds.length === 0
			? new Set<string>()
			: new Set(
					(
						await database
							.select({ id: reservation.id })
							.from(reservation)
							.where(
								and(
									inArray(reservation.id, reservationIds),
									isNull(reservation.deletedAt),
								),
							)
					).map((activeReservation) => activeReservation.id),
				);
	const batchId = proposal.appliedBatchId;
	const [batchRevision] =
		batchId === null
			? []
			: await database
					.select({ id: giftRevision.id })
					.from(giftRevision)
					.where(eq(giftRevision.batchId, batchId))
					.limit(1);
	const targetRowIds = new Set(
		[...targets.reservations, ...targets.moderatorInvites].map((target) => target.rowId),
	);
	const giftRowIds = (proposal.appliedRowIds ?? []).filter((rowId) => !targetRowIds.has(rowId));
	return [
		...targets.moderatorInvites
			.filter((invite) => pendingInviteIds.has(invite.inviteId))
			.map((invite) => ({
				step: {
					operation: revokeModeratorInviteOperation,
					input: { inviteId: invite.inviteId },
				},
				rowIds: [invite.rowId],
			})),
		...(batchRevision === undefined || batchId === null
			? []
			: [
					{
						step: { operation: undoGiftRevisionBatchOperation, input: { batchId } },
						rowIds: giftRowIds,
					},
				]),
		...targets.reservations
			.filter((target) => activeReservationIds.has(target.reservationId))
			.map((target) => ({
				step: {
					operation: cancelOwnReservationOperation,
					input: { reservationId: target.reservationId },
				},
				rowIds: [target.rowId],
			})),
	];
}

function changedGiftIds(thrown: unknown): string[] | null {
	if (!isHttpError(thrown) || thrown.status !== 409) {
		return null;
	}
	const { code, details } = describeServerError(thrown.status, thrown.body.message);
	if (code !== SERVER_ERROR.GIFT_REVISION_CONFLICT || typeof details.giftIds !== 'string') {
		return null;
	}
	return details.giftIds.split(',').filter((giftId) => giftId !== '');
}

async function changedGiftsResult(giftIds: readonly string[]): Promise<UndoChangeProposalResult> {
	const changedGifts =
		giftIds.length === 0
			? []
			: await getDb()
					.select({ id: gift.id, name: gift.name })
					.from(gift)
					.where(inArray(gift.id, [...giftIds]));
	const names = new Map(changedGifts.map((changedGift) => [changedGift.id, changedGift.name]));
	return {
		outcome: CHANGE_PROPOSAL_OUTCOME.conflict,
		changedGifts: giftIds.map((giftId) => ({ giftId, name: names.get(giftId) ?? null })),
	};
}

async function markUndone(transaction: DatabaseTransaction, proposalId: string): Promise<void> {
	const locked = await lockChangeProposal(transaction, proposalId);
	if (locked.status !== CHANGE_PROPOSAL_STATUS.applied) {
		error(409, SERVER_ERROR.AGENT_PROPOSAL_NOT_APPLIED);
	}
	await transaction
		.update(changeProposal)
		.set({ status: CHANGE_PROPOSAL_STATUS.undone, undoneAt: new Date() })
		.where(eq(changeProposal.id, proposalId));
}

/**
 * Undoes a whole applied proposal as one ordinary batch by its submitter in the UI. Refuses with
 * 409 `AGENT_PROPOSAL_UNDO_UNSUPPORTED` while applied rows cannot be reversed. A gift changed since
 * apply is the core's conflict, answered as a result listing the changed gifts; a step the core
 * refuses (an invitation or reservation that changed since planning, a lost role) is answered as
 * the failed rows. Either way nothing is undone.
 */
export async function undoChangeProposal(
	reviewer: ChangeProposalReviewer,
	proposalId: string,
): Promise<UndoChangeProposalResult> {
	const { proposal } = await requireOwnChangeProposal(reviewer.id, proposalId);
	if (proposal.status !== CHANGE_PROPOSAL_STATUS.applied) {
		error(409, SERVER_ERROR.AGENT_PROPOSAL_NOT_APPLIED);
	}
	const blockingRowIds = await rowsBlockingUndo(proposal);
	if (blockingRowIds.length > 0) {
		error(
			409,
			encodeServerError(SERVER_ERROR.AGENT_PROPOSAL_UNDO_UNSUPPORTED, {
				rowIds: blockingRowIds.join(','),
			}),
		);
	}
	const undoSteps = await planUndoSteps(proposal);
	let failedStepIndex: number | null = null;
	try {
		if (undoSteps.length === 0) {
			await getDb().transaction((transaction) => markUndone(transaction, proposal.id));
		} else {
			await executeOperationBatch(
				userInterfaceActor(reviewer),
				undoSteps.map((undoStep) => undoStep.step),
				{
					beforeCommit: (transaction) => markUndone(transaction, proposal.id),
					onStepFailed: (stepIndex) => {
						failedStepIndex = stepIndex;
					},
				},
			);
		}
	} catch (thrown) {
		const giftIds = changedGiftIds(thrown);
		if (giftIds !== null) {
			return changedGiftsResult(giftIds);
		}
		const failedStep = failedStepIndex === null ? undefined : undoSteps[failedStepIndex];
		const failed = failedRowsResult(failedStep?.rowIds ?? [], thrown);
		if (failed === null) {
			throw thrown;
		}
		return failed;
	}
	return {
		outcome: CHANGE_PROPOSAL_OUTCOME.undone,
		proposal: await ownChangeProposalView(reviewer.id, proposal.id),
	};
}
