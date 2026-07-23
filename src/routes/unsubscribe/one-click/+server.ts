import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { error, text } from '@sveltejs/kit';
import { verifyNotificationPreferencesToken } from '$lib/server/crypto/notification_preferences_token.js';
import { unsubscribeAllEmailForUser } from '$lib/modules/notifications/notification_preferences_public.js';

/**
 * RFC 8058 one-click unsubscribe target (issue #206) - the URL mail clients
 * POST to when a recipient uses their inbox's built-in "Unsubscribe" button,
 * advertised via the `List-Unsubscribe` / `List-Unsubscribe-Post` headers on
 * every notification email. No confirmation step by design (that's the point
 * of one-click); disables email for every email-capable notification type and
 * leaves in-app preferences untouched.
 */

function getAuthSigningKey(): string {
	const key = env.AUTH_SECRET;
	if (key == null || key === '') {
		throw new Error(
			'AUTH_SECRET environment variable is required for notification preferences token verification',
		);
	}
	return key;
}

export const POST: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (token === null || token === '') {
		error(400, 'Missing token');
	}

	const verified = await verifyNotificationPreferencesToken(token, getAuthSigningKey());
	if (verified === null) {
		error(403, 'Invalid or expired token');
	}

	const updated = await unsubscribeAllEmailForUser(verified.userId);
	if (updated === null) {
		error(404, 'User not found');
	}

	return text('OK');
};
