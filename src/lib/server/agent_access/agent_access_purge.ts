import { and, eq, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { agentIdempotencyKey, changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { runAfterResponse } from '$lib/server/background.js';
import { demoSessionId } from '$lib/server/demo/scope.js';
import { CHANGE_PROPOSAL_STATUS } from '$lib/modules/change_proposals/types.js';
import { GIFT_REVISION_RETENTION_MS } from '$lib/server/operations/constants.js';
import {
	AGENT_ACCESS_PURGE_CHUNK_SIZE,
	AGENT_ACCESS_PURGE_INTERVAL_MS,
	AGENT_ACCESS_PURGE_MAX_CHUNKS,
	CHANGE_PROPOSAL_EXPIRED_RETENTION_MS,
	IDEMPOTENCY_KEY_RETENTION_MS,
} from './limits.js';

/** Deletes the matching proposals in bounded chunks so no single statement runs long. */
async function deleteProposalsInChunks(condition: SQL | undefined): Promise<void> {
	const database = getDb();
	for (let chunkIndex = 0; chunkIndex < AGENT_ACCESS_PURGE_MAX_CHUNKS; chunkIndex += 1) {
		const chunk = database
			.select({ id: changeProposal.id })
			.from(changeProposal)
			.where(condition)
			.limit(AGENT_ACCESS_PURGE_CHUNK_SIZE);
		const deleted = await database
			.delete(changeProposal)
			.where(inArray(changeProposal.id, chunk))
			.returning({ id: changeProposal.id });
		if (deleted.length < AGENT_ACCESS_PURGE_CHUNK_SIZE) {
			return;
		}
	}
}

async function deleteIdempotencyKeysInChunks(createdBefore: Date): Promise<void> {
	const database = getDb();
	for (let chunkIndex = 0; chunkIndex < AGENT_ACCESS_PURGE_MAX_CHUNKS; chunkIndex += 1) {
		const chunk = database
			.select({ tokenId: agentIdempotencyKey.tokenId, key: agentIdempotencyKey.key })
			.from(agentIdempotencyKey)
			.where(lt(agentIdempotencyKey.createdAt, createdBefore))
			.limit(AGENT_ACCESS_PURGE_CHUNK_SIZE);
		const deleted = await database
			.delete(agentIdempotencyKey)
			.where(sql`(${agentIdempotencyKey.tokenId}, ${agentIdempotencyKey.key}) in (${chunk})`)
			.returning({ key: agentIdempotencyKey.key });
		if (deleted.length < AGENT_ACCESS_PURGE_CHUNK_SIZE) {
			return;
		}
	}
}

/**
 * Deletes expired pending and discarded proposals once a late review link has had time to show
 * them, applied and undone proposals once their batch's gift revisions are gone (undo is
 * impossible after that), and stale idempotency keys.
 */
export async function purgeAgentAccessRecords(now = new Date()): Promise<void> {
	const readableUntil = new Date(now.getTime() - CHANGE_PROPOSAL_EXPIRED_RETENTION_MS);
	const undoableUntil = new Date(now.getTime() - GIFT_REVISION_RETENTION_MS);
	await deleteProposalsInChunks(
		or(
			and(
				eq(changeProposal.status, CHANGE_PROPOSAL_STATUS.pending),
				lt(changeProposal.expiresAt, readableUntil),
			),
			and(
				eq(changeProposal.status, CHANGE_PROPOSAL_STATUS.discarded),
				lt(changeProposal.discardedAt, readableUntil),
			),
			and(
				inArray(changeProposal.status, [
					CHANGE_PROPOSAL_STATUS.applied,
					CHANGE_PROPOSAL_STATUS.undone,
				]),
				lt(changeProposal.appliedAt, undoableUntil),
			),
		),
	);
	await deleteIdempotencyKeysInChunks(new Date(now.getTime() - IDEMPOTENCY_KEY_RETENTION_MS));
}

let nextAgentAccessPurgeAt = 0;

/** Opportunistic purge after a proposal is submitted or applied, throttled per isolate. */
export function scheduleAgentAccessPurge(now = Date.now()): void {
	if (now < nextAgentAccessPurgeAt || demoSessionId() !== null) {
		return;
	}
	// Claim the interval before awaiting: concurrent requests must not launch concurrent purges.
	nextAgentAccessPurgeAt = now + AGENT_ACCESS_PURGE_INTERVAL_MS;
	runAfterResponse(async () => {
		try {
			await purgeAgentAccessRecords();
		} catch (thrown) {
			// A failed purge retries on the next submission instead of after the full interval.
			nextAgentAccessPurgeAt = 0;
			throw thrown;
		}
	});
}
