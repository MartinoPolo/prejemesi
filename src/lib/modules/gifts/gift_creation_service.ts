import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { wishlistScope, demoSessionId, rejectDemoGiftImages } from '$lib/server/demo/scope.js';
import { enforceDemoGiftLimit } from '$lib/server/demo/limits.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { normalizeGiftLinks } from './gift_url.js';
import { DEFAULT_GIFT_CURRENCY, type GiftLink, type GiftWithImages } from './types.js';
import { giftCover, hasImageSource, type GiftImage } from './gift_images.js';
import { DEFAULT_IMAGE_METADATA, type ImageMetadata } from '$lib/modules/images/types.js';
import { replaceGiftGalleries } from '$lib/server/operations/gift_gallery.js';
import { coalesceNewGiftDigests } from '$lib/modules/notifications/new_gift_digest.js';
import { assertActiveGiftCategoryAssignments } from '$lib/modules/gift-categories/gift_categories_service.js';
import type { RecordGiftRevisions } from '$lib/server/operations/gift_revisions.js';

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
	/** The complete ordered gallery; when present the single image fields are ignored. */
	images?: readonly GiftImage[];
	quantity?: number | null;
	priorityLevelId?: string | null;
	categoryIds?: readonly string[];
}

/**
 * A new gift's gallery from the complete `images` list or the single cover fields; a fresh image
 * without presentation metadata gets the default.
 */
function creationGallery(item: NormalizedGiftCreationInput): GiftImage[] {
	const requestedImages = item.images ?? [
		{
			imageUrl: item.imageUrl ?? null,
			imageKey: item.imageKey ?? null,
			imageMeta: item.imageMeta ?? null,
		},
	];
	return requestedImages.filter(hasImageSource).map((image) => ({
		imageUrl: image.imageUrl,
		imageKey: image.imageKey,
		imageMeta: image.imageMeta ?? DEFAULT_IMAGE_METADATA,
	}));
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
	/** Every creation path records who created each gift and through which channel. */
	recordRevisions: RecordGiftRevisions;
}

export async function appendGifts(
	input: AppendGiftsInput,
	options: { database?: GiftCreationDatabase; now?: Date } = {},
): Promise<GiftWithImages[]> {
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
): Promise<GiftWithImages[]> {
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
		.where(and(eq(wishlist.id, input.wishlistId), isNull(wishlist.deletedAt), wishlistScope()))
		.limit(1)
		.for('update');
	if (wishlistRow === undefined) {
		throw new GiftCreationError('wishlist-not-found', 'Wishlist was not found');
	}
	if (wishlistRow.status === 'archived') {
		throw new GiftCreationError('wishlist-archived', 'Wishlist is archived');
	}

	const sessionId = demoSessionId();
	if (sessionId !== null) {
		rejectDemoGiftImages(input.gifts);
		await enforceDemoGiftLimit(tx, sessionId, input.gifts.length);
	}
	const [maxSort] = await tx
		.select({ maxSort: sql<number>`COALESCE(MAX(${gift.sortOrder}), -1)` })
		.from(gift)
		.where(and(eq(gift.wishlistId, input.wishlistId), isNull(gift.deletedAt)));
	let nextSortOrder = Number(maxSort?.maxSort ?? -1) + 1;
	const categoryIdLists = await Promise.all(
		input.gifts.map((item) =>
			assertActiveGiftCategoryAssignments(tx, input.wishlistId, item.categoryIds ?? []),
		),
	);
	const galleries = input.gifts.map(creationGallery);
	const rows = input.gifts.map((item, index) => {
		const allocatedSortOrder = nextSortOrder++;
		const cover = giftCover(galleries[index] ?? []);
		return {
			...(item.id === undefined ? {} : { id: item.id }),
			wishlistId: input.wishlistId,
			name: item.name,
			description: item.description ?? null,
			links: normalizeGiftLinks(item.links ?? []),
			price: item.price ?? null,
			priceMax: item.priceMax ?? null,
			currency: item.currency ?? DEFAULT_GIFT_CURRENCY,
			imageUrl: cover.imageUrl,
			imageKey: cover.imageKey,
			imageMeta: cover.imageMeta,
			quantity: item.quantity ?? 1,
			priorityLevelId: item.priorityLevelId ?? null,
			categoryIds: categoryIdLists[index] ?? [],
			sortOrder: allocatedSortOrder,
		};
	});
	const insertedRows = (await tx
		.insert(gift)
		.values(rows)
		.returning()) as (typeof gift.$inferSelect)[];
	if (insertedRows.length !== rows.length) {
		throw new GiftCreationError('incomplete-insert', 'Gift insert returned incomplete rows');
	}
	const created: GiftWithImages[] = insertedRows.map((row, index) => ({
		...row,
		images: galleries[index] ?? [],
	}));
	await replaceGiftGalleries(
		tx,
		new Map(
			created
				.filter((row) => row.images.length > 0)
				.map((row) => [row.id, row.images] as const),
		),
	);
	if (input.notifyFollowers !== false) {
		await coalesceNewGiftDigests(tx, {
			wishlist: wishlistRow,
			actorId: input.actorId,
			giftNames: created.map((row) => row.name),
			now,
		});
	}
	await input.recordRevisions(
		created.map((row) => ({
			giftId: row.id,
			wishlistId: row.wishlistId,
			before: null,
			after: row,
		})),
	);
	return created;
}
