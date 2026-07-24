import type { RequestHandler } from './$types';
import { text } from '@sveltejs/kit';
import { getAuthSigningKey } from '$lib/server/crypto/auth_signing_key.js';
import { verifyNotificationPreferencesToken } from '$lib/server/crypto/notification_preferences_token.js';
import { unsubscribeAllEmailForUser } from '$lib/modules/notifications/notification_preferences_public.js';

/**
 * RFC 8058 one-click unsubscribe target (issue #206) - the URL mail clients
 * POST to when a recipient uses their inbox's built-in "Unsubscribe" button,
 * advertised via the `List-Unsubscribe` / `List-Unsubscribe-Post` headers on
 * every notification email. No confirmation step by design (that's the point
 * of one-click); disables email for every email-capable notification type and
 * leaves in-app preferences untouched.
 *
 * Always responds 200 `OK` (RFC 8058): mail providers poll this endpoint
 * unattended, and a non-2xx status hurts sender reputation. Failure paths are
 * logged server-side and treated as a no-op instead of erroring.
 */

export const POST: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (token === null || token === '') {
		console.warn('[Unsubscribe] one-click no-op: missing token');
		return text('OK');
	}

	const verified = await verifyNotificationPreferencesToken(token, getAuthSigningKey());
	if (verified === null) {
		console.warn('[Unsubscribe] one-click no-op: invalid or expired token');
		return text('OK');
	}

	const updated = await unsubscribeAllEmailForUser(verified.userId);
	if (updated === null) {
		console.warn('[Unsubscribe] one-click no-op: user not found');
		return text('OK');
	}

	return text('OK');
};
