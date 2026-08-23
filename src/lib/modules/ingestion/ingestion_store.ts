import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { user } from '$lib/server/db/auth.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { giftIngestionItem, giftIngestionRun } from '$lib/server/db/ingestion.schema.js';
import { getDb } from '$lib/server/db/index.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import {
	appendGiftsUsingTransaction,
	GiftCreationError,
	type GiftCreationTransaction,
} from '$lib/modules/gifts/gift_creation_service.js';
import { canonicalIngestionSourceKey } from '$lib/modules/gifts/gift_url.js';
import type { GiftLink } from '$lib/modules/gifts/types.js';
import type { GiftIngestionStore } from './ingestion_service.js';
import { IngestionError } from './ingestion_error.js';

type IngestionDatabase = GiftCreationTransaction | ReturnType<typeof getDb>;

function canonicalPersistedPrimarySourceKeys(
	rows: readonly { links: GiftLink[] | null }[],
): Set<string> {
	const keys = new Set<string>();
	for (const row of rows) {
		const key = canonicalIngestionSourceKey(row.links?.[0]?.url ?? '');
		if (key !== null) {
			keys.add(key);
		}
	}
	return keys;
}

function database(tx: GiftCreationTransaction | undefined): IngestionDatabase {
	return tx ?? getDb();
}

export const drizzleGiftIngestionStore: GiftIngestionStore = {
	transaction: (work) => getDb().transaction(work),
	async lockTarget(tx, wishlistId) {
		await tx
			.select({ id: wishlist.id })
			.from(wishlist)
			.where(eq(wishlist.id, wishlistId))
			.limit(1)
			.for('update');
	},
	async resolveTarget(tx, fixedShortId) {
		const [row] = await database(tx)
			.select({
				id: wishlist.id,
				shortId: wishlist.shortId,
				title: wishlist.title,
				recipientName: wishlist.recipientName,
				linkedRecipientName: user.name,
				status: wishlist.status,
			})
			.from(wishlist)
			.leftJoin(user, eq(user.id, wishlist.recipientUserId))
			.where(and(eq(wishlist.shortId, fixedShortId), isNull(wishlist.deletedAt)))
			.limit(1);
		if (row === undefined) {
			return null;
		}
		return {
			id: row.id,
			shortId: row.shortId,
			title: row.title,
			recipient: row.recipientName ?? row.linkedRecipientName ?? '',
			status: row.status,
		};
	},
	async findRun(tx, manifestId) {
		const [row] = await database(tx)
			.select({
				manifestHash: giftIngestionRun.manifestHash,
				result: giftIngestionRun.result,
			})
			.from(giftIngestionRun)
			.where(eq(giftIngestionRun.manifestId, manifestId))
			.limit(1);
		return row ?? null;
	},
	async findItems(tx, itemIds) {
		if (itemIds.length === 0) {
			return [];
		}
		return database(tx)
			.select({
				itemId: giftIngestionItem.itemId,
				itemHash: giftIngestionItem.itemHash,
				createdGiftId: giftIngestionItem.createdGiftId,
			})
			.from(giftIngestionItem)
			.where(inArray(giftIngestionItem.itemId, [...itemIds]));
	},
	async findExistingSourceKeys(tx, wishlistId) {
		const rows = await database(tx)
			.select({ links: gift.links })
			.from(gift)
			.where(and(eq(gift.wishlistId, wishlistId), isNull(gift.deletedAt)));
		return canonicalPersistedPrimarySourceKeys(rows as { links: GiftLink[] | null }[]);
	},
	async resolvePriorities(tx, wishlistId) {
		const rows = await database(tx)
			.select({ id: priorityLevel.id })
			.from(priorityLevel)
			.where(eq(priorityLevel.wishlistId, wishlistId))
			.orderBy(asc(priorityLevel.sortOrder))
			.limit(2);
		return { high: rows[0]?.id ?? null, medium: rows[1]?.id ?? rows[0]?.id ?? null };
	},
	async appendGifts(tx, input) {
		try {
			return await appendGiftsUsingTransaction(tx, input);
		} catch (thrown) {
			if (thrown instanceof GiftCreationError) {
				if (thrown.code === 'wishlist-not-found') {
					throw new IngestionError('target_not_found', thrown.message);
				}
				if (thrown.code === 'wishlist-archived') {
					throw new IngestionError('target_archived', thrown.message);
				}
			}
			throw thrown;
		}
	},
	async insertRun(tx, input) {
		const [row] = await tx
			.insert(giftIngestionRun)
			.values(input)
			.returning({ id: giftIngestionRun.id });
		if (row === undefined) {
			throw new Error('Failed to record ingestion run');
		}
		return row.id;
	},
	async insertItems(tx, runId, items) {
		if (items.length === 0) {
			return;
		}
		await tx.insert(giftIngestionItem).values(items.map((item) => ({ ...item, runId })));
	},
};
