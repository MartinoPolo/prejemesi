import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getActiveLocaleForUrl, localizeInternalHref } from '$lib/i18n/locale.js';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (locals.session != null && locals.user != null) {
		throw redirect(303, localizeInternalHref(resolve('/my-lists'), getActiveLocaleForUrl(url)));
	}
};
