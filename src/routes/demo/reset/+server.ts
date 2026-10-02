import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { RequestHandler } from './$types';
import { resetDemo } from '$lib/server/demo/session.js';
import { getActiveLocaleForUrl, localizeInternalHref } from '$lib/i18n/locale.js';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.demoSession) {
		error(410, 'Demo has expired');
	}
	const form = await event.request.formData();
	const locale = form.get('locale') === 'en' ? 'en' : 'cs';
	await resetDemo(event.locals.demoSession.id, locale);
	throw redirect(303, localizeInternalHref(resolve('/home'), getActiveLocaleForUrl(event.url)));
};
