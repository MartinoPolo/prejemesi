import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { user as userTable } from '$lib/server/db/auth.schema.js';
import {
	EMAIL_NOTIFICATION_TYPES,
	normalizeNotificationPreferences,
	type NotificationPreferences,
} from './types.js';

/**
 * Token-scoped (no-session) reads/writes of `user.notificationPreferences`,
 * used by the public `/unsubscribe` page and its one-click endpoint
 * (issue #206). Every caller here has already verified a signed
 * `NotificationPreferencesToken` for `userId` before calling in – these
 * helpers touch nothing else on the account (REQ-4).
 */

export async function getNotificationPreferencesForUser(
	userId: string,
): Promise<NotificationPreferences | null> {
	const database = getDb();
	const rows = await database
		.select({ preferences: userTable.notificationPreferences })
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1);

	if (rows.length === 0) {
		return null;
	}

	return normalizeNotificationPreferences(rows[0].preferences);
}

export async function setNotificationPreferencesForUser(
	userId: string,
	preferences: NotificationPreferences,
): Promise<void> {
	const database = getDb();
	await database
		.update(userTable)
		.set({ notificationPreferences: preferences, updatedAt: new Date() })
		.where(eq(userTable.id, userId));
}

/**
 * One-click "unsubscribe from all" (RFC 8058): disables email for every
 * email-capable notification type but leaves in-app toggles untouched.
 * Returns `null` if the token's userId no longer resolves to a user row.
 */
export async function unsubscribeAllEmailForUser(
	userId: string,
): Promise<NotificationPreferences | null> {
	const current = await getNotificationPreferencesForUser(userId);
	if (current === null) {
		return null;
	}

	const updated: NotificationPreferences = { ...current };
	for (const type of EMAIL_NOTIFICATION_TYPES) {
		updated[type] = { ...updated[type], email: false };
	}

	await setNotificationPreferencesForUser(userId, updated);
	return updated;
}
