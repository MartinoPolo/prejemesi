import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getActiveLocaleForUrl, localizeInternalHref } from '$lib/i18n/locale.js';
import { isOauthAuthorizationQuery } from '$lib/modules/access_tokens/oauth_authorization.js';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// An app's authorization can ask a signed-in user to sign in again.
	if (
		locals.session != null &&
		locals.user != null &&
		!isOauthAuthorizationQuery(url.searchParams)
	) {
		throw redirect(303, localizeInternalHref(resolve('/home'), getActiveLocaleForUrl(url)));
	}
};
