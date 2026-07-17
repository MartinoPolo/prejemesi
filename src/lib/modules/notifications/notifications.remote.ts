import * as v from 'valibot';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import * as m from '$lib/paraglide/messages.js';
import { getDb } from '$lib/server/db/index.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { user as userTable } from '$lib/server/db/auth.schema.js';
import { guardedQuery, guardedCommand, guardedCommandNoArgs } from '$lib/server/remote.js';
import {
	NOTIFICATION_MESSAGES,
	UpdateNotificationPreferencesInputSchema,
	normalizeNotificationPreferences,
	type Notification,
	type NotificationPreferences,
	type NotificationType,
} from './types.js';

// ── Queries ──────────────────────────────────────────────────────────────────

export const getNotifications = guardedQuery(async ({ user }) => {
	const database = getDb();

	const rows = await database
		.select()
		.from(notification)
		.where(eq(notification.userId, user.id))
		.orderBy(desc(notification.createdAt))
		.limit(50);

	return rows.map(
		(row): Notification => ({
			id: row.id,
			type: row.type as NotificationType,
			// Unknown/legacy types fall back to a generic localized label instead of
			// leaking the raw DB string to users.
			message: (
				NOTIFICATION_MESSAGES[row.type as NotificationType] ?? m.notification_type_unknown
			)(),
			wishlistId: row.wishlistId,
			giftId: row.giftId,
			actorName: row.actorName,
			read: row.read,
			createdAt: row.createdAt,
		}),
	);
});

export const getUnreadCount = guardedQuery(async ({ user }) => {
	const database = getDb();

	const result = await database
		.select({ count: sql<number>`count(*)` })
		.from(notification)
		.where(and(eq(notification.userId, user.id), eq(notification.read, false)));

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
		.where(and(inArray(notification.id, notificationIds), eq(notification.userId, user.id)));
});

export const markAllAsRead = guardedCommandNoArgs(async ({ user }) => {
	const database = getDb();

	await database
		.update(notification)
		.set({ read: true })
		.where(and(eq(notification.userId, user.id), eq(notification.read, false)));
});

export const updateNotificationPreferences = guardedCommand(
	UpdateNotificationPreferencesInputSchema,
	async ({ user: authUser }, input) => {
		const database = getDb();

		await database
			.update(userTable)
			.set({ notificationPreferences: input.preferences, updatedAt: new Date() })
			.where(eq(userTable.id, authUser.id));
	},
);
