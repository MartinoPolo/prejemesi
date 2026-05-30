import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.session || !locals.user) {
		const redirectParam = encodeURIComponent(url.pathname);
		throw redirect(303, resolve('/login') + `?redirect=${redirectParam}`);
	}
	return { user: locals.user };
};
