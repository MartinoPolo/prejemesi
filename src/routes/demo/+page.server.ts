import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	hasLiveDemo: locals.demoSession !== undefined,
});
