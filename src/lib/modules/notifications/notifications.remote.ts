import * as v from 'valibot';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { guardedQuery, guardedCommand, guardedCommandNoArgs } from '$lib/server/remote.js';
import { NOTIFICATION_MESSAGES, type Notification, type NotificationType } from './types.js';

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
			message: (NOTIFICATION_MESSAGES[row.type as NotificationType] ?? (() => row.type))(),
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
