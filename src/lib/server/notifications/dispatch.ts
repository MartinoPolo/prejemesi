import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import {
	EMAIL_NOTIFICATION_TYPES,
	type DispatchNotificationInput,
	type NotificationType,
} from '$lib/modules/notifications/types.js';
import { buildNotificationEmail, sendNotificationEmail } from './email.js';

// ── Create Single Notification ──────────────────────────────────────────────

export async function createNotification(
	userId: string,
	type: NotificationType,
	data: {
		wishlistId?: string;
		giftId?: string;
		actorId?: string;
		actorName?: string;
	} = {},
): Promise<string> {
	const database = getDb();

	const [row] = await database
		.insert(notification)
		.values({
			userId,
			type,
			wishlistId: data.wishlistId ?? null,
			giftId: data.giftId ?? null,
			actorId: data.actorId ?? null,
			actorName: data.actorName ?? null,
		})
		.returning({ id: notification.id });

	return row!.id;
}

// ── Dispatch Notification (in-app + optional email) ─────────────────────────

interface EmailTemplateData {
	wishlistTitle?: string;
	giftName?: string;
	actorName?: string;
	appUrl?: string;
}

export async function dispatchNotification(
	input: DispatchNotificationInput,
	emailData?: EmailTemplateData,
): Promise<void> {
	const database = getDb();
	const shouldSendEmail = EMAIL_NOTIFICATION_TYPES.includes(input.type);

	for (const targetUserId of input.targetUserIds) {
		// Create in-app notification
		const notificationId = await createNotification(targetUserId, input.type, {
			wishlistId: input.wishlistId,
			giftId: input.giftId,
			actorId: input.actorId,
			actorName: input.actorName,
		});

		// Send email for critical notification types
		if (shouldSendEmail && emailData !== undefined) {
			try {
				// Look up user email
				const userRows = await database
					.select({ email: user.email })
					.from(user)
					.where(eq(user.id, targetUserId))
					.limit(1);

				const userRow = userRows[0];
				if (userRow !== undefined) {
					const { subject, html } = buildNotificationEmail(input.type, {
						...emailData,
						actorName: input.actorName ?? emailData.actorName,
					});

					const sent = await sendNotificationEmail(userRow.email, subject, html);

					if (sent) {
						await database
							.update(notification)
							.set({ emailSent: true })
							.where(eq(notification.id, notificationId));
					}
				}
			} catch (error) {
				console.error(
					`[Notifications] Failed to send email for notification ${notificationId}:`,
					error,
				);
			}
		}
	}
}
