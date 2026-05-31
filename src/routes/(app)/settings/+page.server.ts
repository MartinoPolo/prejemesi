import type { PageServerLoad } from './$types.js';
import { getUserProfile } from '$lib/modules/settings/settings.remote.js';

export const load: PageServerLoad = async () => {
	const profile = await getUserProfile();

	return {
		profile,
	};
};
