import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.session != null && locals.user != null) {
		throw redirect(303, resolve('/my-lists'));
	}
};
