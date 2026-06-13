import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

// The playground is a dev-only component/design-token showcase.
// Block it in production so it isn't reachable on the live site.
export function load() {
	if (!dev) {
		error(404, 'Not found');
	}
}
