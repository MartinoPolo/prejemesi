import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { RequestHandler } from './$types';
import { clearDemoCookie } from '$lib/server/demo/session.js';
import { localizeInternalHref, getActiveLocaleForUrl } from '$lib/i18n/locale.js';

export const POST: RequestHandler = async (event) => {
	clearDemoCookie(event);
	throw redirect(
		303,
		localizeInternalHref(
			(event.locals.realUser ?? event.locals.user) ? resolve('/home') : resolve('/'),
			getActiveLocaleForUrl(event.url),
		),
	);
};
