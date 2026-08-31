import { error } from '@sveltejs/kit';
import { getHomeOverview } from '$lib/modules/wishlists/home_overview_service.js';
import { HOME_OVERVIEW_DEPENDENCY } from '$lib/modules/wishlists/home_overview_types.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ depends, parent }) => {
	depends(HOME_OVERVIEW_DEPENDENCY);
	const { user } = await parent();
	if (user === null) {
		error(500, 'Authenticated layout returned no user');
	}

	return { overview: await getHomeOverview(user.id) };
};
