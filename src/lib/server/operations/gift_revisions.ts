import { inArray, lt } from 'drizzle-orm';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { giftRevision } from '$lib/server/db/gift_revision.schema.js';
import { runAfterResponse } from '$lib/server/background.js';
import { demoSessionId } from '$lib/server/demo/scope.js';
import type { OperationChannel } from './actor.js';
import {
	GIFT_REVISION_PURGE_CHUNK_SIZE,
	GIFT_REVISION_PURGE_INTERVAL_MS,
	GIFT_REVISION_PURGE_MAX_CHUNKS,
	GIFT_REVISION_RETENTION_MS,
} from './constants.js';
import {
	giftRevisionSnapshotsDiffer,
	toGiftRevisionSnapshot,
	type GiftRevisionSnapshot,
	type GiftRevisionSource,
} from './gift_revision_snapshot.js';

/** One observed gift change; `before` is null for a created gift. */
export interface GiftRevisionChange {
	giftId: string;
	wishlistId: string;
	before: GiftRevisionSource | null;
	after: GiftRevisionSource;
}

export type RecordGiftRevisions = (changes: readonly GiftRevisionChange[]) => void | Promise<void>;

export interface GiftRevisionRecord {
	id: string;
	giftId: string;
	wishlistId: string;
	batchId: string;
	actorUserId: string | null;
	channel: OperationChannel;
	operation: string;
	before: GiftRevisionSnapshot | null;
	after: GiftRevisionSnapshot;
	createdAt: Date;
}

export interface GiftRevisionBatch {
	batchId: string;
	actorUserId: string;
	channel: OperationChannel;
}

interface PendingGiftRevision {
	wishlistId: string;
	operation: string;
	before: GiftRevisionSnapshot | null;
	after: GiftRevisionSnapshot;
}

/**
 * Buffers a batch's gift changes and writes one revision per changed gift: several changes to the
 * same gift within one batch collapse into the first `before` and the last `after`, so undoing a
 * batch restores each gift exactly once.
 */
export class GiftRevisionCollector {
	readonly #batch: GiftRevisionBatch;
	readonly #pendingByGiftId = new Map<string, PendingGiftRevision>();

	constructor(batch: GiftRevisionBatch) {
		this.#batch = batch;
	}

	record(operation: string, changes: readonly GiftRevisionChange[]): void {
		for (const change of changes) {
			const after = toGiftRevisionSnapshot(change.after);
			const pending = this.#pendingByGiftId.get(change.giftId);
			this.#pendingByGiftId.set(change.giftId, {
				wishlistId: change.wishlistId,
				operation,
				before:
					pending === undefined
						? change.before === null
							? null
							: toGiftRevisionSnapshot(change.before)
						: pending.before,
				after,
			});
		}
	}

	/** Inserts the changed gifts' revisions and returns them; unchanged gifts write nothing. */
	async flush(transaction: DatabaseTransaction): Promise<GiftRevisionRecord[]> {
		const revisionValues = [...this.#pendingByGiftId]
			.filter(([, pending]) => giftRevisionSnapshotsDiffer(pending.before, pending.after))
			.map(([giftId, pending]) => ({
				giftId,
				wishlistId: pending.wishlistId,
				batchId: this.#batch.batchId,
				actorUserId: this.#batch.actorUserId,
				channel: this.#batch.channel,
				operation: pending.operation,
				before: pending.before,
				after: pending.after,
			}));
		this.#pendingByGiftId.clear();
		if (revisionValues.length === 0) {
			return [];
		}
		// `created_at` is the database clock at insert time, taken while the gift rows are locked.
		const insertedRevisions = await transaction
			.insert(giftRevision)
			.values(revisionValues)
			.returning();
		return insertedRevisions.map((revision) => ({ ...revision, channel: this.#batch.channel }));
	}
}

/** Deletes expired revisions in bounded chunks so no single statement runs long. */
export async function purgeExpiredGiftRevisions(
	database: Pick<ReturnType<typeof getDb>, 'delete' | 'select'>,
	now = new Date(),
): Promise<void> {
	const retentionCutoff = new Date(now.getTime() - GIFT_REVISION_RETENTION_MS);
	for (let chunkIndex = 0; chunkIndex < GIFT_REVISION_PURGE_MAX_CHUNKS; chunkIndex += 1) {
		const expiredRevisionIds = database
			.select({ id: giftRevision.id })
			.from(giftRevision)
			.where(lt(giftRevision.createdAt, retentionCutoff))
			.limit(GIFT_REVISION_PURGE_CHUNK_SIZE);
		const deletedRevisions = await database
			.delete(giftRevision)
			.where(inArray(giftRevision.id, expiredRevisionIds))
			.returning({ id: giftRevision.id });
		if (deletedRevisions.length < GIFT_REVISION_PURGE_CHUNK_SIZE) {
			return;
		}
	}
}

let nextGiftRevisionPurgeAt = 0;

/** Opportunistic retention purge after a committed batch, throttled per isolate and off the response path. */
export function scheduleGiftRevisionPurge(now = Date.now()): void {
	if (now < nextGiftRevisionPurgeAt || demoSessionId() !== null) {
		return;
	}
	// Claim the interval before awaiting: concurrent batches must not launch concurrent purges.
	nextGiftRevisionPurgeAt = now + GIFT_REVISION_PURGE_INTERVAL_MS;
	runAfterResponse(() => purgeExpiredGiftRevisions(getDb()));
}

export function resetGiftRevisionPurgeThrottleForTest(): void {
	if (import.meta.env.MODE !== 'test') {
		throw new Error('The revision purge throttle can only be reset in tests');
	}
	nextGiftRevisionPurgeAt = 0;
}
