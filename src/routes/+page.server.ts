import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session != null && locals.user != null) {
		throw redirect(303, resolve('/my-lists'));
	}
};
