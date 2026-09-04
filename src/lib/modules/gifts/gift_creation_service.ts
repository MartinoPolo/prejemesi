import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { normalizeGiftLinks } from './gift_url.js';
import { DEFAULT_GIFT_CURRENCY, type GiftLink } from './types.js';
import { DEFAULT_IMAGE_METADATA, type ImageMetadata } from '$lib/modules/images/types.js';
import { coalesceNewGiftDigests } from '$lib/modules/notifications/new_gift_digest.js';
import { assertActiveGiftCategoryAssignment } from '$lib/modules/gift-categories/gift_categories_service.js';

export type GiftCreationErrorCode =
	| 'wishlist-not-found'
	| 'wishlist-archived'
	| 'incomplete-insert';

export class GiftCreationError extends Error {
	constructor(
		readonly code: GiftCreationErrorCode,
		message: string,
	) {
		super(message);
		this.name = 'GiftCreationError';
	}
}

export interface NormalizedGiftCreationInput {
	/** Optional server-allocated identity for workflows that stage external resources before commit. */
	id?: string;
	name: string;
	description?: string | null;
	links?: readonly GiftLink[] | null;
	price?: number | null;
	priceMax?: number | null;
	currency?: string | null;
	imageUrl?: string | null;
	imageKey?: string | null;
	imageMeta?: ImageMetadata | null;
	quantity?: number | null;
	priorityLevelId?: string | null;
	categoryId?: string | null;
}

export type GiftCreationDatabase = Pick<ReturnType<typeof getDb>, 'transaction'>;
export type GiftCreationTransaction = Parameters<
	Parameters<ReturnType<typeof getDb>['transaction']>[0]
>[0];

export interface AppendGiftsInput {
	wishlistId: string;
	actorId: string;
	gifts: readonly NormalizedGiftCreationInput[];
	notifyFollowers?: boolean;
}

export async function appendGifts(
	input: AppendGiftsInput,
	options: { database?: GiftCreationDatabase; now?: Date } = {},
): Promise<(typeof gift.$inferSelect)[]> {
	if (input.gifts.length === 0) {
		return [];
	}
	const database = options.database ?? getDb();
	return database.transaction((tx) => appendGiftsUsingTransaction(tx, input, options.now));
}

export async function appendGiftsUsingTransaction(
	tx: GiftCreationTransaction,
	input: AppendGiftsInput,
	now = new Date(),
): Promise<(typeof gift.$inferSelect)[]> {
	if (input.gifts.length === 0) {
		return [];
	}
	const [wishlistRow] = await tx
		.select({
			id: wishlist.id,
			shortId: wishlist.shortId,
			title: wishlist.title,
			status: wishlist.status,
			recipientUserId: wishlist.recipientUserId,
		})
		.from(wishlist)
		.where(and(eq(wishlist.id, input.wishlistId), isNull(wishlist.deletedAt)))
		.limit(1)
		.for('update');
	if (wishlistRow === undefined) {
		throw new GiftCreationError('wishlist-not-found', 'Wishlist was not found');
	}
	if (wishlistRow.status === 'archived') {
		throw new GiftCreationError('wishlist-archived', 'Wishlist is archived');
	}

	const [maxSort] = await tx
		.select({ maxSort: sql<number>`COALESCE(MAX(${gift.sortOrder}), -1)` })
		.from(gift)
		.where(and(eq(gift.wishlistId, input.wishlistId), isNull(gift.deletedAt)));
	let nextSortOrder = Number(maxSort?.maxSort ?? -1) + 1;
	const categoryIds = await Promise.all(
		input.gifts.map((item) =>
			assertActiveGiftCategoryAssignment(tx, input.wishlistId, item.categoryId),
		),
	);
	const rows = input.gifts.map((item, index) => {
		const allocatedSortOrder = nextSortOrder++;
		const imageUrl = item.imageUrl ?? null;
		const imageKey = item.imageKey ?? null;
		return {
			...(item.id === undefined ? {} : { id: item.id }),
			wishlistId: input.wishlistId,
			name: item.name,
			description: item.description ?? null,
			links: normalizeGiftLinks(item.links ?? []),
			price: item.price ?? null,
			priceMax: item.priceMax ?? null,
			currency: item.currency ?? DEFAULT_GIFT_CURRENCY,
			imageUrl,
			imageKey,
			imageMeta:
				imageUrl !== null || imageKey !== null
					? (item.imageMeta ?? DEFAULT_IMAGE_METADATA)
					: null,
			quantity: item.quantity ?? 1,
			priorityLevelId: item.priorityLevelId ?? null,
			categoryId: categoryIds[index] ?? null,
			sortOrder: allocatedSortOrder,
		};
	});
	const created = (await tx
		.insert(gift)
		.values(rows)
		.returning()) as (typeof gift.$inferSelect)[];
	if (created.length !== rows.length) {
		throw new GiftCreationError('incomplete-insert', 'Gift insert returned incomplete rows');
	}
	if (input.notifyFollowers !== false) {
		await coalesceNewGiftDigests(tx, {
			wishlist: wishlistRow,
			actorId: input.actorId,
			giftNames: created.map((row) => row.name),
			now,
		});
	}
	return created;
}
