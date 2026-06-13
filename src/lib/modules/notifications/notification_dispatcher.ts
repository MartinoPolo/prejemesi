import { env } from '$env/dynamic/private';
import { inArray, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { renderActionEmail, sendEmail } from '$lib/server/email.js';
import {
	DEFAULT_NOTIFICATION_PREFERENCES,
	EMAIL_NOTIFICATION_TYPES,
	NOTIFICATION_MESSAGES,
	type DispatchNotificationInput,
	type NotificationType,
} from './types.js';

function uniqueNonEmpty(values: readonly (string | null | undefined)[]): string[] {
	return [
		...new Set(
			values
				.map((value) => value?.trim())
				.filter((value): value is string => value !== undefined && value !== ''),
		),
	];
}

function canSendEmail(type: NotificationType): boolean {
	return (
		EMAIL_NOTIFICATION_TYPES.includes(type) &&
		DEFAULT_NOTIFICATION_PREFERENCES[type].email === true
	);
}

function getOrigin(): string {
	return (env.ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '');
}

function getNotificationUrl(wishlistShortId: string | null): string {
	if (wishlistShortId === null) {
		return getOrigin();
	}

	return `${getOrigin()}/w/${wishlistShortId}`;
}

function getEmailBody(input: {
	message: string;
	wishlistTitle: string | null;
	actorName: string | null | undefined;
}): string {
	const details = [
		input.wishlistTitle !== null ? `Wishlist: ${input.wishlistTitle}` : null,
		input.actorName != null && input.actorName !== '' ? `From: ${input.actorName}` : null,
	].filter((line): line is string => line !== null);

	if (details.length === 0) {
		return input.message;
	}

	return `${input.message}\n\n${details.join('\n')}`;
}

async function getWishlistContext(wishlistId: string | undefined): Promise<{
	title: string | null;
	shortId: string | null;
}> {
	if (wishlistId === undefined) {
		return { title: null, shortId: null };
	}

	const database = getDb();
	const rows = await database
		.select({ title: wishlist.title, shortId: wishlist.shortId })
		.from(wishlist)
		.where(eq(wishlist.id, wishlistId))
		.limit(1);

	const row = rows[0];
	return row === undefined ? { title: null, shortId: null } : row;
}

async function sendNotificationEmail(params: {
	to: string;
	type: NotificationType;
	message: string;
	body: string;
	url: string;
	notificationId?: string;
}): Promise<boolean> {
	try {
		await sendEmail({
			to: params.to,
			subject: params.message,
			html: renderActionEmail({
				heading: params.message,
				body: params.body,
				buttonLabel: 'Open wishlist',
				url: params.url,
			}),
			idempotencyKey:
				params.notificationId !== undefined
					? `notification:${params.notificationId}`
					: `notification:${params.type}:${params.to}:${params.url}`,
		});
		return true;
	} catch (error) {
		console.error(`[Notification] Failed to email ${params.type} to ${params.to}`, error);
		return false;
	}
}

export async function dispatchNotification(input: DispatchNotificationInput): Promise<void> {
	const targetUserIds = uniqueNonEmpty(input.targetUserIds ?? []);
	const targetEmails = uniqueNonEmpty(input.targetEmails ?? []);

	if (targetUserIds.length === 0 && targetEmails.length === 0) {
		return;
	}

	const database = getDb();
	const message = NOTIFICATION_MESSAGES[input.type]();
	const wishlistContext = await getWishlistContext(input.wishlistId);
	const url = getNotificationUrl(wishlistContext.shortId);
	const body = getEmailBody({
		message,
		wishlistTitle: wishlistContext.title,
		actorName: input.actorName,
	});

	const userRows =
		targetUserIds.length > 0
			? await database
					.select({ id: user.id, email: user.email })
					.from(user)
					.where(inArray(user.id, targetUserIds))
			: [];

	const insertedNotifications =
		DEFAULT_NOTIFICATION_PREFERENCES[input.type].inApp === true && userRows.length > 0
			? await database
					.insert(notification)
					.values(
						userRows.map((targetUser) => ({
							userId: targetUser.id,
							type: input.type,
							wishlistId: input.wishlistId ?? null,
							giftId: input.giftId ?? null,
							actorId: input.actorId ?? null,
							actorName: input.actorName ?? null,
						})),
					)
					.returning({ id: notification.id, userId: notification.userId })
			: [];

	if (!canSendEmail(input.type)) {
		return;
	}

	const notificationIdByUserId = new Map(
		insertedNotifications.map((row) => [row.userId, row.id] as const),
	);

	for (const targetUser of userRows) {
		const sent = await sendNotificationEmail({
			to: targetUser.email,
			type: input.type,
			message,
			body,
			url,
			notificationId: notificationIdByUserId.get(targetUser.id),
		});

		const notificationId = notificationIdByUserId.get(targetUser.id);
		if (sent && notificationId !== undefined) {
			await database
				.update(notification)
				.set({ emailSent: true })
				.where(eq(notification.id, notificationId));
		}
	}

	const userEmails = new Set(userRows.map((row) => row.email.toLowerCase()));
	for (const targetEmail of targetEmails) {
		if (userEmails.has(targetEmail.toLowerCase())) {
			continue;
		}

		await sendNotificationEmail({
			to: targetEmail,
			type: input.type,
			message,
			body,
			url,
		});
	}
}
