import * as v from 'valibot';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import * as m from '$lib/paraglide/messages.js';
import { getDb } from '$lib/server/db/index.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { user as userTable } from '$lib/server/db/auth.schema.js';
import { guardedQuery, guardedCommand, guardedCommandNoArgs } from '$lib/server/remote.js';
import { setNotificationPreferencesForUser } from './notification_preferences_public.js';
import {
	NOTIFICATION_MESSAGES,
	UpdateNotificationPreferencesInputSchema,
	normalizeNotificationPreferences,
	type Notification,
	type NotificationPreferences,
	type NotificationType,
} from './types.js';
import { getNewGiftDigestDisplay, parseNewGiftDigestPayload } from './new_gift_digest.js';
import { notificationIsVisible } from './notification_visibility.js';

// ── Queries ──────────────────────────────────────────────────────────────────

export const getNotifications = guardedQuery(async ({ user }) => {
	const database = getDb();

	// Left join so a notification whose wishlist was since deleted still returns (with a null
	// shortId) instead of vanishing from the inbox — the in-app link route needs the shortId
	// (not the wishlist UUID stored on the notification) to resolve `/w/[id]` (issue #204).
	const rows = await database
		.select({
			id: notification.id,
			type: notification.type,
			wishlistId: notification.wishlistId,
			wishlistShortId: wishlist.shortId,
			giftId: notification.giftId,
			actorName: notification.actorName,
			payload: notification.payload,
			read: notification.read,
			createdAt:
				sql<Date>`coalesce(${notification.visibleAt}, ${notification.createdAt})`.mapWith(
					notification.createdAt,
				),
		})
		.from(notification)
		.leftJoin(wishlist, eq(notification.wishlistId, wishlist.id))
		.where(and(eq(notification.userId, user.id), notificationIsVisible()))
		.orderBy(
			desc(sql<Date>`coalesce(${notification.visibleAt}, ${notification.createdAt})`),
			desc(notification.createdAt),
			desc(notification.id),
		)
		.limit(50);

	return rows.map((row): Notification => {
		const digest = parseNewGiftDigestPayload(row.payload);
		const digestDisplay = digest === null ? null : getNewGiftDigestDisplay(digest);
		return {
			id: row.id,
			type: row.type as NotificationType,
			// Unknown/legacy types fall back to a generic localized label instead of
			// leaking the raw DB string to users.
			message:
				digestDisplay?.message ??
				(
					NOTIFICATION_MESSAGES[row.type as NotificationType] ??
					m.notification_type_unknown
				)(),
			wishlistId: row.wishlistId,
			wishlistShortId: row.wishlistShortId ?? null,
			giftId: row.giftId,
			actorName: row.actorName,
			digest,
			href: digestDisplay?.href ?? null,
			read: row.read,
			createdAt: row.createdAt,
		};
	});
});

export const getUnreadCount = guardedQuery(async ({ user }) => {
	const database = getDb();

	const result = await database
		.select({ count: sql<number>`count(*)` })
		.from(notification)
		.where(
			and(
				eq(notification.userId, user.id),
				eq(notification.read, false),
				notificationIsVisible(),
			),
		);

	return Number(result[0]?.count ?? 0);
});

export const getNotificationPreferences = guardedQuery(
	async ({ user: authUser }): Promise<NotificationPreferences> => {
		const database = getDb();

		const rows = await database
			.select({ preferences: userTable.notificationPreferences })
			.from(userTable)
			.where(eq(userTable.id, authUser.id))
			.limit(1);

		// Merge over defaults so newer types missing from an older stored row are filled in;
		// NULL (never customized) yields the plain defaults.
		return normalizeNotificationPreferences(rows[0]?.preferences);
	},
);

// ── Commands ────────────────────────────────────────────────────────────────

export const markAsRead = guardedCommand(v.array(v.string()), async ({ user }, notificationIds) => {
	if (notificationIds.length === 0) {
		return;
	}

	const database = getDb();

	await database
		.update(notification)
		.set({ read: true })
		.where(
			and(
				inArray(notification.id, notificationIds),
				eq(notification.userId, user.id),
				notificationIsVisible(),
			),
		);
});

export const markAllAsRead = guardedCommandNoArgs(async ({ user }) => {
	const database = getDb();

	await database
		.update(notification)
		.set({ read: true })
		.where(
			and(
				eq(notification.userId, user.id),
				eq(notification.read, false),
				notificationIsVisible(),
			),
		);
});

export const updateNotificationPreferences = guardedCommand(
	UpdateNotificationPreferencesInputSchema,
	async ({ user: authUser }, input) => {
		await setNotificationPreferencesForUser(authUser.id, input.preferences);
	},
);
