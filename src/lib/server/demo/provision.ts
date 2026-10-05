import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { gift, giftCategory, reservation } from '$lib/server/db/gift.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { generateId } from '$lib/server/db/id.js';
import { DEFAULT_PRIORITY_LEVELS } from '$lib/modules/wishlists/types.js';
import {
	GIFT_CATEGORY_PRESET_BY_KEY,
	isGiftCategoryPresetKey,
} from '$lib/modules/gift-categories/presets.js';
import { getDemoCatalog, type DemoCatalogWishlist } from './catalog.js';
import { demoEmailAddress } from './constants.js';

const HOUR_MS = 3_600_000;
const PRIORITY_LEVEL_INDEX = { high: 0, medium: 1, low: 2 } as const;

function demoEventDate(entry: DemoCatalogWishlist, index: number, now: Date): Date | null {
	if (entry.occasion === 'ongoing') {
		return null;
	}
	const date = new Date(now);
	if (entry.status === 'archived') {
		date.setUTCDate(date.getUTCDate() - 45);
	} else if (entry.occasion === 'christmas') {
		date.setUTCMonth(11, 24);
		if (date <= now) {
			date.setUTCFullYear(date.getUTCFullYear() + 1);
		}
	} else {
		date.setUTCDate(date.getUTCDate() + 60 + index * 10);
	}
	return date;
}

function demoRecipientUserId(
	entry: DemoCatalogWishlist,
	viewerUserId: string,
	otherUserId: string,
): string | null {
	if (entry.role === 'own') {
		return viewerUserId;
	}
	return entry.role === 'followed' ? otherUserId : null;
}

async function insertDemoWishlist(
	tx: DatabaseTransaction,
	sessionId: string,
	entry: DemoCatalogWishlist,
	recipientUserId: string | null,
	eventDate: Date | null,
	now: Date,
): Promise<{ id: string; createdAt: Date }> {
	const archive = entry.status === 'archived';
	const createdAt = new Date(now.getTime() - (archive ? 90 * 24 : 2) * HOUR_MS);
	const sharedAt = new Date(now.getTime() - (archive ? 80 * 24 : 1) * HOUR_MS);
	const [created] = await tx
		.insert(wishlist)
		.values({
			demoSessionId: sessionId,
			recipientUserId,
			recipientName: entry.role === 'managed' ? entry.recipientName : null,
			title: entry.title,
			description: entry.description,
			palette: entry.palette,
			status: entry.status === 'shared' ? 'active' : entry.status,
			sharedAt: entry.status === 'draft' ? null : sharedAt,
			archivedAt: archive ? new Date(now.getTime() - 30 * 24 * HOUR_MS) : null,
			createdAt,
			eventDate,
		})
		.returning({ id: wishlist.id });
	if (created === undefined) {
		throw new Error('Failed to create demo wishlist');
	}
	return { id: created.id, createdAt };
}

async function linkDemoViewer(
	tx: DatabaseTransaction,
	entry: DemoCatalogWishlist,
	wishlistId: string,
	viewerUserId: string,
) {
	if (entry.role === 'managed') {
		await tx.insert(moderatorAssignment).values({ wishlistId, userId: viewerUserId });
	}
	if (entry.role === 'followed') {
		await tx.insert(wishlistFollower).values({ wishlistId, userId: viewerUserId });
	}
}

async function insertDemoGifts(
	tx: DatabaseTransaction,
	entry: DemoCatalogWishlist,
	wishlistId: string,
	createdAt: Date,
): Promise<string[]> {
	const priorities = await tx
		.insert(priorityLevel)
		.values(
			DEFAULT_PRIORITY_LEVELS.map((level) => ({
				wishlistId,
				label: level.label,
				sortOrder: level.sortOrder,
			})),
		)
		.returning();
	const categories = [...new Set(entry.gifts.map((item) => item.category))];
	const categoryRows = await tx
		.insert(giftCategory)
		.values(
			categories.map((category, sortOrder) => ({
				wishlistId,
				...(isGiftCategoryPresetKey(category)
					? { presetKey: category }
					: { customLabel: category }),
				color: isGiftCategoryPresetKey(category)
					? GIFT_CATEGORY_PRESET_BY_KEY.get(category)!.color
					: '#2563EB',
				sortOrder,
			})),
		)
		.returning();
	const gifts = await tx
		.insert(gift)
		.values(
			entry.gifts.map((item, sortOrder) => ({
				wishlistId,
				createdAt,
				name: item.name,
				description: item.description,
				imageUrl: item.imageUrl,
				links: [{ url: item.url }],
				price: item.price,
				currency: 'CZK',
				categoryId:
					categoryRows.find(
						(_, categoryIndex) => categories[categoryIndex] === item.category,
					)?.id ?? null,
				priorityLevelId: priorities[PRIORITY_LEVEL_INDEX[item.priority]]?.id ?? null,
				sortOrder,
				received: item.state === 'received',
			})),
		)
		.returning({ id: gift.id });
	return gifts.map((row) => row.id);
}

async function insertDemoReservations(
	tx: DatabaseTransaction,
	entry: DemoCatalogWishlist,
	giftIds: string[],
	viewerUserId: string,
) {
	const reserved = entry.gifts.flatMap((item, giftIndex) =>
		item.state === 'reserved'
			? [
					{
						giftId: giftIds[giftIndex]!,
						...(entry.role !== 'own' && giftIndex === 3
							? { userId: viewerUserId }
							: { anonymousName: 'Pavel Novák' }),
					},
				]
			: [],
	);
	if (reserved.length) {
		await tx.insert(reservation).values(reserved);
	}
}

export async function provisionDemoCatalog(
	tx: DatabaseTransaction,
	sessionId: string,
	viewerUserId: string,
	locale: 'cs' | 'en',
	now: Date,
) {
	const catalog = getDemoCatalog(locale);
	for (const [index, entry] of catalog.entries()) {
		const otherUserId = generateId(24);
		if (entry.role === 'followed') {
			await tx.insert(user).values({
				id: otherUserId,
				demoSessionId: sessionId,
				name: entry.recipientName,
				email: demoEmailAddress(otherUserId),
			});
		}
		const created = await insertDemoWishlist(
			tx,
			sessionId,
			entry,
			demoRecipientUserId(entry, viewerUserId, otherUserId),
			demoEventDate(entry, index, now),
			now,
		);
		await linkDemoViewer(tx, entry, created.id, viewerUserId);
		const giftIds = await insertDemoGifts(tx, entry, created.id, created.createdAt);
		await insertDemoReservations(tx, entry, giftIds, viewerUserId);
	}
}
