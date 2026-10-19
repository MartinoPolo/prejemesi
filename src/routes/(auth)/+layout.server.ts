import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getActiveLocaleForUrl, localizeInternalHref } from '$lib/i18n/locale.js';
import { isOauthAuthorizationQuery } from '$lib/modules/access_tokens/oauth_authorization.js';
import { oauthPageLocaleHref } from '$lib/server/agent_access/oauth_locale.js';

export const load: LayoutServerLoad = async (event) => {
	const { locals, url } = event;
	if (isOauthAuthorizationQuery(url.searchParams)) {
		const localizedHref = await oauthPageLocaleHref(event);
		if (localizedHref !== null) {
			throw redirect(303, localizedHref);
		}
		// An app's authorization can ask a signed-in user to sign in again.
		return;
	}
	if (locals.session != null && locals.user != null) {
		throw redirect(303, localizeInternalHref(resolve('/home'), getActiveLocaleForUrl(url)));
	}
};
