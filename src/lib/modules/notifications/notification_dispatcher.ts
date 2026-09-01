import { env } from '$env/dynamic/private';
import { inArray, eq } from 'drizzle-orm';
import * as m from '$lib/paraglide/messages.js';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { renderActionEmailParts, sendEmail } from '$lib/server/email.js';
import { runAfterResponse } from '$lib/server/background.js';
import { getAuthSigningKey } from '$lib/server/crypto/auth_signing_key.js';
import { createNotificationPreferencesToken } from '$lib/server/crypto/notification_preferences_token.js';
import { localizeInternalHref, type SupportedLocale } from '$lib/i18n/locale.js';
import { resolveDevelopmentEnvironment } from '$lib/config/mpx_development.js';
import {
	EMAIL_NOTIFICATION_TYPES,
	getNotificationEmailBody,
	getNotificationEmailCopy,
	getNotificationEmailHeading,
	normalizeNotificationPreferences,
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

/** Whether this notification type is ever allowed to send email (critical types only). */
function emailTypeSupported(type: NotificationType): boolean {
	return EMAIL_NOTIFICATION_TYPES.includes(type);
}

function getOrigin(): string {
	return resolveDevelopmentEnvironment(env).origin.replace(/\/$/, '');
}

interface UnsubscribeFooter {
	footerText: string;
	unsubscribeLabel: string;
	unsubscribeUrl: string;
	headers: Record<string, string>;
}

/**
 * Builds the unsubscribe footer + `List-Unsubscribe` headers for an account
 * recipient (issue #206, REQ-1/REQ-2). Not localized to a `/en` URL prefix:
 * the page resolves its own copy locale from the token's user at load time
 * (see `/unsubscribe/+page.server.ts`), so a bare path works for every locale
 * and survives being pasted into any mail client.
 *
 * Returns `undefined` (never throws) on a missing/misconfigured signing key so
 * a footer-building failure degrades to a plain email instead of losing the
 * notification entirely.
 */
async function buildUnsubscribeFooter(
	userId: string,
	locale: SupportedLocale,
): Promise<UnsubscribeFooter | undefined> {
	let signingKey: string;
	try {
		signingKey = getAuthSigningKey();
	} catch (err) {
		console.error('[Notification] unsubscribe footer skipped', err);
		return undefined;
	}

	const { token } = await createNotificationPreferencesToken(userId, signingKey);
	const tokenQuery = new URLSearchParams({ token }).toString();
	const unsubscribeUrl = `${getOrigin()}/unsubscribe?${tokenQuery}`;

	// Only the human `List-Unsubscribe` (GET) header is advertised. RFC 8058
	// one-click (`List-Unsubscribe-Post` + POST to /unsubscribe/one-click) is
	// intentionally NOT emitted: SvelteKit's CSRF origin check runs before any
	// server hook and rejects the mail-provider POST (no Origin header, form
	// content-type) with 403 in production, so advertising it would only surface
	// failed one-click attempts to mailbox providers. True one-click needs a
	// pre-`server.respond()` interceptor (postbuild worker wrapper or a separate
	// Cloudflare Worker route) - tracked as a follow-up to issue #206.
	return {
		footerText: m.notification_email_footer_text({}, { locale }),
		unsubscribeLabel: m.notification_email_unsubscribe_label({}, { locale }),
		unsubscribeUrl,
		headers: {
			'List-Unsubscribe': `<${unsubscribeUrl}>`,
		},
	};
}

function getNotificationUrl(
	wishlistShortId: string | null,
	urlPathOverride: string | undefined,
	locale: SupportedLocale,
): string {
	const href =
		urlPathOverride !== undefined && urlPathOverride !== ''
			? urlPathOverride
			: wishlistShortId === null
				? '/'
				: `/w/${wishlistShortId}`;

	return href.startsWith('/') ? `${getOrigin()}${localizeInternalHref(href, locale)}` : href;
}

function getEmailBody(input: {
	bodyMessage: string;
	wishlistTitle: string | null;
	actorName: string | null | undefined;
	wishlistLabel: string;
	fromLabel: string;
}): string {
	const details = [
		input.wishlistTitle !== null ? `${input.wishlistLabel}: ${input.wishlistTitle}` : null,
		input.actorName != null && input.actorName !== ''
			? `${input.fromLabel}: ${input.actorName}`
			: null,
	].filter((line): line is string => line !== null);

	if (details.length === 0) {
		return input.bodyMessage;
	}

	return `${input.bodyMessage}\n\n${details.join('\n')}`;
}

async function getWishlistContext(
	input: DispatchNotificationInput,
): Promise<{ title: string | null; shortId: string | null }> {
	// Callers holding the wishlist row pass it along – no extra statement (issue #108).
	if (input.wishlist !== undefined) {
		return input.wishlist;
	}
	if (input.wishlistId === undefined) {
		return { title: null, shortId: null };
	}

	const database = getDb();
	const rows = await database
		.select({ title: wishlist.title, shortId: wishlist.shortId })
		.from(wishlist)
		.where(eq(wishlist.id, input.wishlistId))
		.limit(1);

	const row = rows[0];
	return row === undefined ? { title: null, shortId: null } : row;
}

async function sendNotificationEmail(params: {
	to: string;
	type: NotificationType;
	locale: SupportedLocale;
	wishlistTitle: string | null;
	wishlistShortId: string | null;
	urlPathOverride: string | undefined;
	actorName: string | null | undefined;
	giftName: string | undefined;
	notificationId?: string;
	/** Present only for registered-account recipients (issue #206) - external,
	 *  non-account emails have no user row to scope an unsubscribe token to, so
	 *  they get no footer/List-Unsubscribe headers. */
	userId?: string;
}): Promise<boolean> {
	const emailCopy = getNotificationEmailCopy(params.type, params.locale);
	const heading = getNotificationEmailHeading(params.type, params.locale);
	const bodyMessage = getNotificationEmailBody(params.type, params.locale, {
		giftName: params.giftName,
	});
	const url = getNotificationUrl(params.wishlistShortId, params.urlPathOverride, params.locale);
	const body = getEmailBody({
		bodyMessage,
		wishlistTitle: params.wishlistTitle,
		actorName: params.actorName,
		wishlistLabel: emailCopy.wishlistLabel,
		fromLabel: emailCopy.fromLabel,
	});

	try {
		const unsubscribe =
			params.userId !== undefined
				? await buildUnsubscribeFooter(params.userId, params.locale)
				: undefined;

		await sendEmail({
			to: params.to,
			subject: emailCopy.message,
			...renderActionEmailParts({
				heading,
				body,
				buttonLabel: emailCopy.buttonLabel,
				copyLinkText: emailCopy.copyLinkText,
				url,
				footerText: unsubscribe?.footerText,
				unsubscribeUrl: unsubscribe?.unsubscribeUrl,
				unsubscribeLabel: unsubscribe?.unsubscribeLabel,
			}),
			idempotencyKey:
				params.notificationId !== undefined
					? `notification:${params.notificationId}`
					: `notification:${params.type}:${params.to}:${url}`,
			headers: unsubscribe?.headers,
		});
		return true;
	} catch {
		console.error(`[Notification] email dispatch failed for ${params.type}`);
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
	const wishlistContext = await getWishlistContext(input);

	const directUserRows =
		targetUserIds.length > 0
			? await database
					.select({
						id: user.id,
						email: user.email,
						preferredLocale: user.preferredLocale,
						notificationPreferences: user.notificationPreferences,
					})
					.from(user)
					.where(inArray(user.id, targetUserIds))
			: [];
	const emailMatchedUserRows =
		targetEmails.length > 0
			? await database
					.select({
						id: user.id,
						email: user.email,
						preferredLocale: user.preferredLocale,
						notificationPreferences: user.notificationPreferences,
					})
					.from(user)
					.where(inArray(user.email, targetEmails))
			: [];
	const emailUserRows = [
		...new Map(
			[...directUserRows, ...emailMatchedUserRows].map((targetUser) => [
				targetUser.id,
				targetUser,
			]),
		).values(),
	];

	// Honor each recipient's in-app toggle: only insert a notification row for users
	// who have in-app enabled for this type (NULL preferences fall back to defaults).
	// In-app rows are the durable part of a dispatch and are committed before returning.
	const inAppUserRows = directUserRows.filter(
		(targetUser) =>
			normalizeNotificationPreferences(targetUser.notificationPreferences)[input.type]
				.inApp === true,
	);

	const insertedNotifications =
		inAppUserRows.length > 0
			? await database
					.insert(notification)
					.values(
						inAppUserRows.map((targetUser) => ({
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

	if (!emailTypeSupported(input.type)) {
		return;
	}

	const notificationIdByUserId = new Map(
		insertedNotifications.map((row) => [row.userId, row.id] as const),
	);

	// Honor each recipient's email toggle (within email-capable types only).
	const emailEnabledUserRows = emailUserRows.filter(
		(targetUser) =>
			normalizeNotificationPreferences(targetUser.notificationPreferences)[input.type]
				.email === true,
	);

	const userEmails = new Set(emailUserRows.map((row) => row.email.toLowerCase()));
	const externalEmails = targetEmails.filter(
		(targetEmail) => !userEmails.has(targetEmail.toLowerCase()),
	);

	if (emailEnabledUserRows.length === 0 && externalEmails.length === 0) {
		return;
	}

	// Email delivery happens after the response (issue #108, REQ-6): the user's
	// mutation never waits for Resend. A failed send is observable via the error
	// log and the notification row's emailSent flag staying false; it never rolls
	// back the mutation or the in-app rows committed above.
	runAfterResponse(async () => {
		for (const targetUser of emailEnabledUserRows) {
			const notificationId = notificationIdByUserId.get(targetUser.id);
			const sent = await sendNotificationEmail({
				to: targetUser.email,
				type: input.type,
				locale: targetUser.preferredLocale ?? 'cs',
				wishlistTitle: wishlistContext.title,
				wishlistShortId: wishlistContext.shortId,
				urlPathOverride: input.urlPathOverride,
				actorName: input.actorName,
				giftName: input.giftName,
				notificationId,
				userId: targetUser.id,
			});

			if (sent && notificationId !== undefined) {
				await database
					.update(notification)
					.set({ emailSent: true })
					.where(eq(notification.id, notificationId));
			}
		}

		for (const targetEmail of externalEmails) {
			await sendNotificationEmail({
				to: targetEmail,
				type: input.type,
				locale: 'cs',
				wishlistTitle: wishlistContext.title,
				wishlistShortId: wishlistContext.shortId,
				urlPathOverride: input.urlPathOverride,
				actorName: input.actorName,
				giftName: input.giftName,
			});
		}
	});
}
