import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { RequestHandler } from './$types';
import { createDemo } from '$lib/server/demo/session.js';

export const POST: RequestHandler = async (event) => {
	const form = await event.request.formData();
	const locale = form.get('locale') === 'en' ? 'en' : 'cs';
	if (!event.locals.demoSession) {
		await createDemo(event, locale);
	}
	throw redirect(303, locale === 'en' ? '/en/home' : resolve('/home'));
};
