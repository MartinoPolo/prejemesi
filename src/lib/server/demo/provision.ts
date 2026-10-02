import type { getDb } from '$lib/server/db/index.js';
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
import { getDemoCatalog } from './catalog.js';

type Transaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

export async function provisionDemoCatalog(
	tx: Transaction,
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
				email: `${otherUserId}@demo.invalid`,
			});
		}
		const eventDate =
			entry.occasion === 'ongoing'
				? null
				: (() => {
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
					})();
		const archive = entry.status === 'archived';
		const createdAt = new Date(now.getTime() - (archive ? 90 * 24 : 2) * 3_600_000);
		const sharedAt = new Date(now.getTime() - (archive ? 80 * 24 : 1) * 3_600_000);
		const [created] = await tx
			.insert(wishlist)
			.values({
				demoSessionId: sessionId,
				recipientUserId:
					entry.role === 'own'
						? viewerUserId
						: entry.role === 'followed'
							? otherUserId
							: null,
				recipientName: entry.role === 'managed' ? entry.recipientName : null,
				title: entry.title,
				description: entry.description,
				palette: entry.palette,
				status: entry.status === 'shared' ? 'active' : entry.status,
				sharedAt: entry.status === 'draft' ? null : sharedAt,
				archivedAt: archive ? new Date(now.getTime() - 30 * 24 * 3_600_000) : null,
				createdAt,
				eventDate,
			})
			.returning({ id: wishlist.id });
		if (!created) {
			throw new Error('Failed to create demo wishlist');
		}
		if (entry.role === 'managed') {
			await tx
				.insert(moderatorAssignment)
				.values({ wishlistId: created.id, userId: viewerUserId });
		}
		if (entry.role === 'followed') {
			await tx
				.insert(wishlistFollower)
				.values({ wishlistId: created.id, userId: viewerUserId });
		}
		const priorities = await tx
			.insert(priorityLevel)
			.values(
				DEFAULT_PRIORITY_LEVELS.map((level) => ({
					wishlistId: created.id,
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
					wishlistId: created.id,
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
					wishlistId: created.id,
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
					priorityLevelId:
						priorities[
							item.priority === 'high' ? 0 : item.priority === 'medium' ? 1 : 2
						]?.id ?? null,
					sortOrder,
					received: item.state === 'received',
				})),
			)
			.returning({ id: gift.id });
		const reserved = entry.gifts.flatMap((item, giftIndex) =>
			item.state === 'reserved'
				? [
						{
							giftId: gifts[giftIndex]!.id,
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
}
