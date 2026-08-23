import { and, eq, gt, isNull } from 'drizzle-orm';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { newGiftDigestState, notification } from '$lib/server/db/notification.schema.js';
import { generateId } from '$lib/server/db/id.js';
import { NOTIFICATION_TYPE, normalizeNotificationPreferences } from './types.js';
import * as m from '$lib/paraglide/messages.js';
import type { SupportedLocale } from '$lib/i18n/locale.js';
import type { getDb } from '$lib/server/db/index.js';
import type { NotificationPreferences } from './types.js';

const NEW_GIFT_DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_WISHLISTS = 10;
const MAX_OVERFLOW_WISHLIST_IDS = 100;
const MAX_NAME_PREVIEWS = 3;
const MAX_PREVIEW_LENGTH = 80;

export interface NewGiftDigestWishlist {
	wishlistId: string;
	shortId: string;
	title: string;
	count: number;
	namePreviews: string[];
}

export interface NewGiftDigestPayload {
	version: 1;
	totalCount: number;
	/** Total represented wishlist count; `wishlists` contains at most ten detailed rows. */
	wishlistCount: number;
	wishlists: NewGiftDigestWishlist[];
	/** Compact identities for represented wishlists without display-detail rows. */
	overflowWishlistIds?: string[];
	/** `wishlistCount` is a lower bound because the bounded identity capacity was exceeded. */
	wishlistCountCapped?: true;
}

export function parseNewGiftDigestPayload(value: unknown): NewGiftDigestPayload | null {
	if (typeof value !== 'object' || value === null) {
		return null;
	}
	const candidate = value as Partial<NewGiftDigestPayload>;
	if (
		candidate.version !== 1 ||
		!Number.isInteger(candidate.totalCount) ||
		candidate.totalCount! < 1
	) {
		return null;
	}
	if (!Array.isArray(candidate.wishlists) || candidate.wishlists.length < 1) {
		return null;
	}
	const wishlists: NewGiftDigestWishlist[] = [];
	for (const item of candidate.wishlists.slice(0, MAX_WISHLISTS)) {
		if (typeof item !== 'object' || item === null) {
			return null;
		}
		const row = item as Partial<NewGiftDigestWishlist>;
		if (
			typeof row.wishlistId !== 'string' ||
			typeof row.shortId !== 'string' ||
			typeof row.title !== 'string' ||
			!Number.isInteger(row.count) ||
			row.count! < 1 ||
			!Array.isArray(row.namePreviews)
		) {
			return null;
		}
		wishlists.push({
			wishlistId: row.wishlistId,
			shortId: row.shortId,
			title: row.title.slice(0, 160),
			count: row.count!,
			namePreviews: row.namePreviews
				.filter((name): name is string => typeof name === 'string')
				.slice(0, MAX_NAME_PREVIEWS)
				.map((name) => name.slice(0, MAX_PREVIEW_LENGTH)),
		});
	}
	const detailedIds = new Set(wishlists.map(({ wishlistId }) => wishlistId));
	const overflowWishlistIds: string[] = [];
	if (Array.isArray(candidate.overflowWishlistIds)) {
		for (const wishlistId of candidate.overflowWishlistIds) {
			if (
				typeof wishlistId === 'string' &&
				!detailedIds.has(wishlistId) &&
				!overflowWishlistIds.includes(wishlistId)
			) {
				overflowWishlistIds.push(wishlistId);
				if (overflowWishlistIds.length === MAX_OVERFLOW_WISHLIST_IDS) {
					break;
				}
			}
		}
	}
	const representedWishlistCount = wishlists.length + overflowWishlistIds.length;
	const wishlistCount =
		Number.isInteger(candidate.wishlistCount) &&
		candidate.wishlistCount! >= representedWishlistCount
			? candidate.wishlistCount!
			: representedWishlistCount;
	return {
		version: 1,
		totalCount: candidate.totalCount!,
		wishlistCount,
		wishlists,
		...(overflowWishlistIds.length === 0 ? {} : { overflowWishlistIds }),
		...(candidate.wishlistCountCapped === true ? { wishlistCountCapped: true } : {}),
	};
}

export function getNewGiftDigestDisplay(
	payload: NewGiftDigestPayload,
	locale?: SupportedLocale,
): { message: string; href: string; wishlists: NewGiftDigestWishlist[] } {
	const oneWishlist = payload.wishlistCount === 1;
	return {
		message: oneWishlist
			? payload.totalCount === 1
				? m.notification_digest_heading_single({}, { locale })
				: m.notification_digest_heading_one({ giftCount: payload.totalCount }, { locale })
			: payload.wishlistCountCapped === true
				? m.notification_digest_heading_capped(
						{ giftCount: payload.totalCount, wishlistCount: payload.wishlistCount },
						{ locale },
					)
				: m.notification_digest_heading(
						{ giftCount: payload.totalCount, wishlistCount: payload.wishlistCount },
						{ locale },
					),
		href: oneWishlist ? `/w/${payload.wishlists[0]!.shortId}` : '/followed',
		wishlists: payload.wishlists,
	};
}

export function addToNewGiftDigestPayload(
	current: NewGiftDigestPayload | null,
	addition: { wishlistId: string; shortId: string; title: string; giftNames: readonly string[] },
): NewGiftDigestPayload {
	const payload: NewGiftDigestPayload = current ?? {
		version: 1,
		totalCount: 0,
		wishlistCount: 0,
		wishlists: [],
	};
	const count = addition.giftNames.length;
	const overflowWishlistIds = payload.overflowWishlistIds ?? [];
	const existing = payload.wishlists.find((item) => item.wishlistId === addition.wishlistId);
	const existingOverflow = overflowWishlistIds.includes(addition.wishlistId);
	if (existing !== undefined) {
		existing.count += count;
		existing.namePreviews = [...existing.namePreviews, ...addition.giftNames]
			.slice(0, MAX_NAME_PREVIEWS)
			.map((name) => name.slice(0, MAX_PREVIEW_LENGTH));
	} else if (!existingOverflow && payload.wishlistCountCapped !== true) {
		payload.wishlistCount += 1;
		if (payload.wishlists.length < MAX_WISHLISTS) {
			payload.wishlists.push({
				wishlistId: addition.wishlistId,
				shortId: addition.shortId,
				title: addition.title.slice(0, 160),
				count,
				namePreviews: addition.giftNames
					.slice(0, MAX_NAME_PREVIEWS)
					.map((name) => name.slice(0, MAX_PREVIEW_LENGTH)),
			});
		} else if (overflowWishlistIds.length < MAX_OVERFLOW_WISHLIST_IDS) {
			if (payload.overflowWishlistIds === undefined) {
				payload.overflowWishlistIds = [addition.wishlistId];
			} else {
				payload.overflowWishlistIds.push(addition.wishlistId);
			}
		} else {
			payload.wishlistCountCapped = true;
		}
	}
	payload.totalCount += count;
	return payload;
}

type DigestTransaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

export async function coalesceNewGiftDigests(
	tx: DigestTransaction,
	input: {
		wishlist: { id: string; shortId: string; title: string; recipientUserId: string | null };
		actorId: string;
		giftNames: readonly string[];
		now: Date;
	},
): Promise<void> {
	if (input.giftNames.length === 0) {
		return;
	}
	const followerRows = await tx
		.select({ userId: wishlistFollower.userId, preferences: user.notificationPreferences })
		.from(wishlistFollower)
		.innerJoin(user, eq(user.id, wishlistFollower.userId))
		.where(
			and(
				eq(wishlistFollower.wishlistId, input.wishlist.id),
				isNull(wishlistFollower.unfollowedAt),
			),
		);
	const targets = followerRows
		.filter(
			(row: { userId: string; preferences: NotificationPreferences | null }) =>
				row.userId !== input.actorId &&
				row.userId !== input.wishlist.recipientUserId &&
				normalizeNotificationPreferences(row.preferences)[NOTIFICATION_TYPE.NEW_GIFT_ADDED]
					.inApp,
		)
		.toSorted((left, right) => left.userId.localeCompare(right.userId));
	for (const target of targets) {
		await coalesceRecipientDigest(tx, target.userId, input);
	}
}

async function coalesceRecipientDigest(
	tx: DigestTransaction,
	userId: string,
	input: {
		wishlist: { id: string; shortId: string; title: string };
		giftNames: readonly string[];
		now: Date;
	},
): Promise<void> {
	await tx.insert(newGiftDigestState).values({ userId }).onConflictDoNothing();
	const [state] = await tx
		.select()
		.from(newGiftDigestState)
		.where(eq(newGiftDigestState.userId, userId))
		.for('update');
	if (
		state?.activeNotificationId !== null &&
		state?.activeNotificationId !== undefined &&
		state.windowEndsAt instanceof Date &&
		state.windowEndsAt > input.now
	) {
		const [active] = await tx
			.select({ payload: notification.payload })
			.from(notification)
			.where(
				and(
					eq(notification.id, state.activeNotificationId),
					gt(notification.visibleAt, input.now),
				),
			)
			.limit(1);
		if (active !== undefined) {
			const payload = addToNewGiftDigestPayload(parseNewGiftDigestPayload(active.payload), {
				wishlistId: input.wishlist.id,
				shortId: input.wishlist.shortId,
				title: input.wishlist.title,
				giftNames: input.giftNames,
			});
			await tx
				.update(notification)
				.set({ payload })
				.where(eq(notification.id, state.activeNotificationId));
			return;
		}
	}

	const notificationId = generateId();
	const windowEndsAt = new Date(input.now.getTime() + NEW_GIFT_DIGEST_WINDOW_MS);
	const payload = addToNewGiftDigestPayload(null, {
		wishlistId: input.wishlist.id,
		shortId: input.wishlist.shortId,
		title: input.wishlist.title,
		giftNames: input.giftNames,
	});
	await tx.insert(notification).values({
		id: notificationId,
		userId,
		type: NOTIFICATION_TYPE.NEW_GIFT_ADDED,
		wishlistId: input.wishlist.id,
		payload,
		visibleAt: windowEndsAt,
		dedupeKey: `new-gift-digest:${userId}:${notificationId}`,
	});
	await tx
		.update(newGiftDigestState)
		.set({ activeNotificationId: notificationId, windowStartedAt: input.now, windowEndsAt })
		.where(eq(newGiftDigestState.userId, userId));
}
