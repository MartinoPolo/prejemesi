import { and, eq, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import {
	agentIdempotencyKey,
	agentOauthIdempotencyKey,
	changeProposal,
} from '$lib/server/db/change_proposal.schema.js';
import { agentImage } from '$lib/server/db/agent_image.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { runAfterResponse } from '$lib/server/background.js';
import { agentImageStorage, getR2Bucket, type AgentImageStorage } from '$lib/server/storage/r2.js';
import { demoSessionId } from '$lib/server/demo/scope.js';
import { CHANGE_PROPOSAL_STATUS } from '$lib/modules/change_proposals/types.js';
import { GIFT_REVISION_RETENTION_MS } from '$lib/server/operations/constants.js';
import {
	AGENT_ACCESS_PURGE_CHUNK_SIZE,
	AGENT_ACCESS_PURGE_INTERVAL_MS,
	AGENT_ACCESS_PURGE_MAX_CHUNKS,
	AGENT_IMAGE_PURGE_DELAY_MS,
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

const IDEMPOTENCY_KEY_TABLES = [
	{ table: agentIdempotencyKey, ownerColumn: agentIdempotencyKey.tokenId },
	{ table: agentOauthIdempotencyKey, ownerColumn: agentOauthIdempotencyKey.grantId },
];

async function deleteIdempotencyKeysInChunks(
	{ table, ownerColumn }: (typeof IDEMPOTENCY_KEY_TABLES)[number],
	createdBefore: Date,
): Promise<void> {
	const database = getDb();
	for (let chunkIndex = 0; chunkIndex < AGENT_ACCESS_PURGE_MAX_CHUNKS; chunkIndex += 1) {
		const chunk = database
			.select({ ownerId: ownerColumn, key: table.key })
			.from(table)
			.where(lt(table.createdAt, createdBefore))
			.limit(AGENT_ACCESS_PURGE_CHUNK_SIZE);
		const deleted = await database
			.delete(table)
			.where(sql`(${ownerColumn}, ${table.key}) in (${chunk})`)
			.returning({ key: table.key });
		if (deleted.length < AGENT_ACCESS_PURGE_CHUNK_SIZE) {
			return;
		}
	}
}

/** The keys among `objectKeys` that no gift row, deleted or not, uses. */
async function keysNoGiftUses(objectKeys: readonly string[]): Promise<string[]> {
	const usedRows = await getDb()
		.select({ imageKey: gift.imageKey })
		.from(gift)
		.where(inArray(gift.imageKey, [...objectKeys]));
	const usedKeys = new Set(usedRows.map((row) => row.imageKey));
	return objectKeys.filter((objectKey) => !usedKeys.has(objectKey));
}

/**
 * Deletes the matching agent images in chunks, objects first: a row stays when its object could
 * not be deleted, so the next purge retries.
 */
async function deleteAgentImagesInChunks(
	condition: SQL | undefined,
	storage: AgentImageStorage,
	deletableKeys: (objectKeys: readonly string[]) => Promise<readonly string[]>,
): Promise<void> {
	const database = getDb();
	for (let chunkIndex = 0; chunkIndex < AGENT_ACCESS_PURGE_MAX_CHUNKS; chunkIndex += 1) {
		const images = await database
			.select({ id: agentImage.id, objectKey: agentImage.objectKey })
			.from(agentImage)
			.where(condition)
			.orderBy(agentImage.id)
			.limit(AGENT_ACCESS_PURGE_CHUNK_SIZE);
		if (images.length === 0) {
			return;
		}
		const objectKeys = await deletableKeys(images.map((image) => image.objectKey));
		if (objectKeys.length > 0) {
			await storage.deleteOrThrow(objectKeys);
		}
		await database.delete(agentImage).where(
			inArray(
				agentImage.id,
				images.map((image) => image.id),
			),
		);
		if (images.length < AGENT_ACCESS_PURGE_CHUNK_SIZE) {
			return;
		}
	}
}

/**
 * Deletes agent images never attached once expired, and attached ones once undo can no longer
 * detach them. An unattached image is never a gift's: attaching re-checks expiry under a row
 * lock and the purge waits past it. An attached image's object goes only while no gift uses it.
 */
async function purgeAgentImages(now: Date, storage: AgentImageStorage): Promise<void> {
	const settledBefore = new Date(now.getTime() - AGENT_IMAGE_PURGE_DELAY_MS);
	const undoableSince = new Date(settledBefore.getTime() - GIFT_REVISION_RETENTION_MS);
	await deleteAgentImagesInChunks(
		and(isNull(agentImage.attachedAt), lt(agentImage.expiresAt, settledBefore)),
		storage,
		async (objectKeys) => objectKeys,
	);
	await deleteAgentImagesInChunks(
		lt(agentImage.attachedAt, undoableSince),
		storage,
		keysNoGiftUses,
	);
}

/**
 * Deletes expired pending and discarded proposals once a late review link has had time to show
 * them, applied and undone proposals once their batch's gift revisions are gone (undo is
 * impossible after that), and stale idempotency keys. Agent images are purged only with
 * `storage`, since their objects must go first.
 */
export async function purgeAgentAccessRecords(
	now = new Date(),
	storage?: AgentImageStorage,
): Promise<void> {
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
	const staleKeysBefore = new Date(now.getTime() - IDEMPOTENCY_KEY_RETENTION_MS);
	for (const keyTable of IDEMPOTENCY_KEY_TABLES) {
		await deleteIdempotencyKeysInChunks(keyTable, staleKeysBefore);
	}
	if (storage !== undefined) {
		await purgeAgentImages(now, storage);
	}
}

let nextAgentAccessPurgeAt = 0;

/**
 * Opportunistic purge after a proposal is submitted or applied or an image is uploaded,
 * throttled per isolate. The request's R2 binding is taken now, while the request is current.
 */
export function scheduleAgentAccessPurge(now = Date.now()): void {
	if (now < nextAgentAccessPurgeAt || demoSessionId() !== null) {
		return;
	}
	// Claim the interval before awaiting: concurrent requests must not launch concurrent purges.
	nextAgentAccessPurgeAt = now + AGENT_ACCESS_PURGE_INTERVAL_MS;
	const bucket = getR2Bucket();
	const storage = bucket && agentImageStorage(bucket);
	runAfterResponse(async () => {
		try {
			await purgeAgentAccessRecords(new Date(), storage);
		} catch (thrown) {
			// A failed purge retries on the next submission instead of after the full interval.
			nextAgentAccessPurgeAt = 0;
			throw thrown;
		}
	});
}
