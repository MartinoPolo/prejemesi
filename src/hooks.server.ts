import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getTextDirection } from '$lib/paraglide/runtime';
import { isDatabaseConfigured } from '$lib/server/db/index.js';

const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			preload: ({ type }) => type === 'js' || type === 'css' || type === 'font',
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale)),
		});
	});

const authHandle: Handle = async ({ event, resolve }) => {
	const { auth } = await import('$lib/server/auth.js');
	const { svelteKitHandler } = await import('better-auth/svelte-kit');
	const { building } = await import('$app/environment');

	const sessionData = await auth.api.getSession({ headers: event.request.headers });

	if (sessionData) {
		event.locals.session = sessionData.session;
		event.locals.user = sessionData.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const handles: Handle[] = [paraglideHandle];
if (isDatabaseConfigured()) {
	handles.push(authHandle);
}

export const handle = sequence(...handles);
