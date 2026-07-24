import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { getAuthSigningKey } from '$lib/server/crypto/auth_signing_key.js';
import { verifyNotificationPreferencesToken } from '$lib/server/crypto/notification_preferences_token.js';
import {
	getNotificationPreferencesForUser,
	setNotificationPreferencesForUser,
	unsubscribeAllEmailForUser,
} from '$lib/modules/notifications/notification_preferences_public.js';
import {
	UpdateNotificationPreferencesInputSchema,
	type NotificationPreferences,
} from '$lib/modules/notifications/types.js';

/**
 * Public, no-login page (issue #206, REQ-2): scoped to exactly one user via a
 * signed token in `?token=`, never via `locals.session`/`locals.user`. Lives
 * outside the `(app)` route group so it is not subject to that layout's
 * login-redirect guard.
 */

interface InvalidTokenResult {
	valid: false;
	token: null;
	preferences: null;
}

interface ValidTokenResult {
	valid: true;
	token: string;
	preferences: NotificationPreferences;
}

const INVALID_TOKEN_RESULT: InvalidTokenResult = { valid: false, token: null, preferences: null };

export const load: PageServerLoad = async ({
	url,
}): Promise<InvalidTokenResult | ValidTokenResult> => {
	const token = url.searchParams.get('token');
	if (token === null || token === '') {
		return INVALID_TOKEN_RESULT;
	}

	const verified = await verifyNotificationPreferencesToken(token, getAuthSigningKey());
	if (verified === null) {
		return INVALID_TOKEN_RESULT;
	}

	const preferences = await getNotificationPreferencesForUser(verified.userId);
	if (preferences === null) {
		// User row no longer exists (deleted account) - treat like an invalid link.
		return INVALID_TOKEN_RESULT;
	}

	return { valid: true, token, preferences };
};

/** Re-verifies the token on every action - the load's verification does not carry over. */
async function resolveUserIdFromFormToken(
	tokenValue: FormDataEntryValue | null,
): Promise<string | null> {
	if (typeof tokenValue !== 'string' || tokenValue === '') {
		return null;
	}
	const verified = await verifyNotificationPreferencesToken(tokenValue, getAuthSigningKey());
	return verified?.userId ?? null;
}

export const actions: Actions = {
	save: async ({ request }) => {
		const formData = await request.formData();
		const userId = await resolveUserIdFromFormToken(formData.get('token'));
		if (userId === null) {
			return fail(403, { action: 'save' as const, error: 'invalid_token' as const });
		}

		const preferencesRaw = formData.get('preferences');
		if (typeof preferencesRaw !== 'string') {
			return fail(400, { action: 'save' as const, error: 'invalid_input' as const });
		}

		let parsedPreferences: unknown;
		try {
			parsedPreferences = JSON.parse(preferencesRaw);
		} catch {
			return fail(400, { action: 'save' as const, error: 'invalid_input' as const });
		}

		const validation = v.safeParse(UpdateNotificationPreferencesInputSchema, {
			preferences: parsedPreferences,
		});
		if (!validation.success) {
			return fail(400, { action: 'save' as const, error: 'invalid_input' as const });
		}

		await setNotificationPreferencesForUser(userId, validation.output.preferences);
		return { action: 'save' as const, success: true as const };
	},

	unsubscribeAll: async ({ request }) => {
		const formData = await request.formData();
		const userId = await resolveUserIdFromFormToken(formData.get('token'));
		if (userId === null) {
			return fail(403, {
				action: 'unsubscribeAll' as const,
				error: 'invalid_token' as const,
			});
		}

		const updated = await unsubscribeAllEmailForUser(userId);
		if (updated === null) {
			return fail(404, {
				action: 'unsubscribeAll' as const,
				error: 'user_not_found' as const,
			});
		}

		return { action: 'unsubscribeAll' as const, success: true as const, preferences: updated };
	},
};
