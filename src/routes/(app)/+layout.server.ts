import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

const PUBLIC_PATH_PREFIXES = ['/w/'];

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isPublicRoute = PUBLIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

	if (locals.session == null || locals.user == null) {
		if (!isPublicRoute) {
			const redirectParam = encodeURIComponent(url.pathname);
			throw redirect(303, resolve('/login') + `?redirect=${redirectParam}`);
		}
		return { user: null };
	}
	return { user: locals.user };
};
