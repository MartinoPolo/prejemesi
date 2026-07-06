import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getTextDirection } from '$lib/paraglide/runtime';
import { isDatabaseConfigured, rememberDatabaseBinding } from '$lib/server/db/index.js';
import { SITE_URL, WWW_HOSTNAME } from '$lib/config/site.js';
import { ROBOTS_NOINDEX_CONTENT, shouldNoindexPath } from '$lib/seo/robots.js';
import type { BackgroundTheme } from '$lib/components/base/theme/types.js';

function setSecurityHeaders(headers: Headers, url: URL) {
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('X-Frame-Options', 'DENY');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()');
	headers.set(
		'Content-Security-Policy',
		[
			"base-uri 'self'",
			"object-src 'none'",
			"frame-ancestors 'none'",
			"form-action 'self'",
			...(dev ? [] : ['upgrade-insecure-requests']),
		].join('; '),
	);

	if (!dev) {
		headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	if (shouldNoindexPath(url.pathname)) {
		headers.set('X-Robots-Tag', ROBOTS_NOINDEX_CONTENT);
	}
}

const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	try {
		setSecurityHeaders(response.headers, event.url);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		setSecurityHeaders(headers, event.url);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
};

const canonicalHostHandle: Handle = ({ event, resolve }) => {
	if (!dev && event.url.hostname === WWW_HOSTNAME) {
		const target = new URL(event.url.pathname + event.url.search, SITE_URL);
		return new Response(null, {
			status: 308,
			headers: {
				Location: target.toString(),
			},
		});
	}

	return resolve(event);
};

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

const DEFAULT_BACKGROUND_THEME: BackgroundTheme = 'default';

/**
 * Applies the user's persisted app background theme to the root <html> element
 * server-side (REQ-3), so the chosen tint is present on first paint with no
 * flash. Anonymous users (and unconfigured DB) fall back to the neutral default.
 * Sequenced after authHandle so `locals.user` is populated when the DB is
 * configured; without a DB authHandle is absent and this falls back to default.
 */
const backgroundThemeHandle: Handle = async ({ event, resolve }) => {
	let bgTheme: BackgroundTheme = DEFAULT_BACKGROUND_THEME;

	if (event.locals.user != null && isDatabaseConfigured(event)) {
		try {
			const { getDb } = await import('$lib/server/db/index.js');
			const { user } = await import('$lib/server/db/auth.schema.js');
			const { eq } = await import('drizzle-orm');

			const rows = await getDb(event)
				.select({ appBackgroundTheme: user.appBackgroundTheme })
				.from(user)
				.where(eq(user.id, event.locals.user.id))
				.limit(1);

			const stored = rows[0]?.appBackgroundTheme;
			if (stored != null) {
				bgTheme = stored;
			}
		} catch (err) {
			console.error(
				'[backgroundThemeHandle] failed to read app background theme, using default',
				err,
			);
		}
	}

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replaceAll('%app.bgTheme%', bgTheme),
	});
};

const authHandle: Handle = async ({ event, resolve }) => {
	rememberDatabaseBinding(event);

	if (!isDatabaseConfigured(event)) {
		return resolve(event);
	}

	const { createAuth } = await import('$lib/server/auth.js');
	const { svelteKitHandler } = await import('better-auth/svelte-kit');
	const { building } = await import('$app/environment');
	const auth = createAuth(event);

	const sessionData = await auth.api.getSession({ headers: event.request.headers });

	if (sessionData) {
		event.locals.session = sessionData.session;
		event.locals.user = sessionData.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const handles: Handle[] = [
	securityHeadersHandle,
	canonicalHostHandle,
	paraglideHandle,
	authHandle,
	backgroundThemeHandle,
];

export const handle = sequence(...handles);
