import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { RequestHandler } from './$types';
import { createDemo, parseDemoCatalogLocale } from '$lib/server/demo/session.js';
import { localizeInternalHref } from '$lib/i18n/locale.js';

export const POST: RequestHandler = async (event) => {
	const form = await event.request.formData();
	const locale = parseDemoCatalogLocale(form.get('locale'));
	if (!event.locals.demoSession) {
		await createDemo(event, locale);
	}
	throw redirect(303, localizeInternalHref(resolve('/home'), locale));
};
