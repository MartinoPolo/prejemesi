import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { cookieName, getTextDirection, type Locale } from '$lib/paraglide/runtime';
import { isDatabaseConfigured, rememberDatabaseBinding } from '$lib/server/db/index.js';
import { SITE_URL, WWW_HOSTNAME } from '$lib/config/site.js';
import { ROBOTS_NOINDEX_CONTENT, shouldNoindexPath } from '$lib/seo/robots.js';
import { requestTelemetryHandle } from '$lib/server/request_telemetry.js';
import { createSentryServerOptions } from '$lib/observability/sentry_server.js';
import {
	reportOperationalFailure,
	setOperationalDeployment,
} from '$lib/observability/operational_failures.js';
import {
	DEFAULT_PALETTE,
	PALETTE_COOKIE_NAME,
	isPalette,
	type Palette,
} from '$lib/theme/palettes.js';
import {
	DEFAULT_DEPTH_STYLE,
	DEPTH_STYLE_COOKIE_MAX_AGE_SECONDS,
	DEPTH_STYLE_COOKIE_NAME,
	isDepthStyle,
	type DepthStyle,
} from '$lib/theme/depth_styles.js';

let initializedSentryHandle: Handle | undefined;

function reportCriticalConfigurationFailures(event: Parameters<Handle>[0]['event']) {
	if (!isDatabaseConfigured(event)) {
		reportOperationalFailure('database', 'missing_connection');
	}
	if (env.AUTH_SECRET === undefined || env.AUTH_SECRET.trim() === '') {
		reportOperationalFailure('auth', 'missing_secret');
	}
}

const sentryInitializationHandle: Handle = ({ event, resolve }) => {
	setOperationalDeployment(event.platform?.env.CF_VERSION_METADATA?.id);
	const dsn = event.platform?.env.PUBLIC_SENTRY_DSN?.trim();
	if (dsn === undefined || dsn === '') {
		if (!dev) {
			reportOperationalFailure('sentry', 'missing_public_dsn');
		}
		reportCriticalConfigurationFailures(event);
		return resolve(event);
	}

	initializedSentryHandle ??= Sentry.initCloudflareSentryHandle(
		createSentryServerOptions({
			dsn,
			environment: dev ? 'development' : 'production',
			release: event.platform?.env.GIT_COMMIT_SHA,
		}),
	);
	return initializedSentryHandle({
		event,
		resolve: (resolvedEvent, options) => {
			reportCriticalConfigurationFailures(resolvedEvent);
			return resolve(resolvedEvent, options);
		},
	});
};

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

const PUBLIC_WISHLIST_PATH_PREFIXES = ['/w/', '/en/w/'] as const;

const BETTER_AUTH_SESSION_COOKIE_NAMES = new Set([
	'better-auth.session_token',
	'__Secure-better-auth.session_token',
	'better-auth-session_token',
	'__Secure-better-auth-session_token',
	'better-auth.session_data',
	'__Secure-better-auth.session_data',
	'better-auth-session_data',
	'__Secure-better-auth-session_data',
]);

const BOT_PROBE_EXACT_PATHS = new Set(['/xmlrpc.php', '/.env', '/phpinfo.php']);
const BOT_PROBE_PATH_PREFIXES = [
	'/wp-',
	'/wp/',
	'/wordpress/',
	'/phpmyadmin',
	'/pma/',
	'/.git/',
] as const;

function isPublicWishlistPath(pathname: string) {
	return PUBLIC_WISHLIST_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function hasBetterAuthSessionCookie(headers: Headers) {
	const cookieHeader = headers.get('cookie');
	if (cookieHeader === null || cookieHeader.length === 0) {
		return false;
	}

	return cookieHeader.split(';').some((cookiePart) => {
		const cookieName = cookiePart.trim().split('=', 1)[0];
		return BETTER_AUTH_SESSION_COOKIE_NAMES.has(cookieName);
	});
}

function isBotProbePath(pathname: string) {
	const lowerPathname = pathname.toLowerCase();
	return (
		BOT_PROBE_EXACT_PATHS.has(lowerPathname) ||
		BOT_PROBE_PATH_PREFIXES.some((prefix) => lowerPathname.startsWith(prefix))
	);
}

const botProbeHandle: Handle = ({ event, resolve }) => {
	if (isBotProbePath(event.url.pathname)) {
		return new Response('Not found', { status: 404 });
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

function hasExplicitUrlLocale(url: URL) {
	return url.pathname === '/en' || url.pathname.startsWith('/en/');
}

function setRequestLocaleCookie(request: Request, locale: Locale) {
	const headers = new Headers(request.headers);
	const existingCookie = headers.get('cookie') ?? '';
	const cookieParts = existingCookie
		.split(';')
		.map((part) => part.trim())
		.filter((part) => part.length > 0 && !part.startsWith(`${cookieName}=`));
	cookieParts.push(`${cookieName}=${locale}`);
	headers.set('cookie', cookieParts.join('; '));
	return new Request(request, { headers });
}

/**
 * Only HTML document loads depend on the viewer's presentation preferences
 * (locale-aware SSR markup, the `%app.palette%` shell placeholder). Remote
 * function calls, SvelteKit data requests, uploads and API routes must never
 * pay a preference lookup (issue #108, REQ-1).
 */
function isHtmlDocumentRequest(event: Parameters<Handle>[0]['event']): boolean {
	return (
		event.request.method === 'GET' &&
		!event.isDataRequest &&
		!event.isRemoteRequest &&
		(event.request.headers.get('accept')?.includes('text/html') ?? false)
	);
}

/**
 * Resolves the viewer's locale, app palette, and depth style for HTML document
 * loads only. Locale starts from the request cookie and an authenticated account
 * preference can override it; palette and depth use their cookie mirrors as fast
 * paths, with missing authenticated values falling back to the user row. All
 * required authenticated fallbacks are fetched in the same combined database
 * statement (at most one per document request; issue #108, REQ-1/REQ-2).
 *
 * Palette and depth are written to the root <html> data attributes server-side,
 * so both styles are correct before paint. Sequencing after authHandle provides
 * `locals.user`, while sequencing before paraglideHandle exposes the resolved
 * locale to SSR.
 */
const userPreferencesHandle: Handle = async ({ event, resolve }) => {
	let palette: Palette = DEFAULT_PALETTE;
	let depthStyle: DepthStyle = DEFAULT_DEPTH_STYLE;

	const cookiePalette = event.cookies.get(PALETTE_COOKIE_NAME);
	if (isPalette(cookiePalette)) {
		palette = cookiePalette;
	}
	const cookieDepthStyle = event.cookies.get(DEPTH_STYLE_COOKIE_NAME);
	if (isDepthStyle(cookieDepthStyle)) {
		depthStyle = cookieDepthStyle;
	}

	if (event.locals.user != null && isDatabaseConfigured(event) && isHtmlDocumentRequest(event)) {
		const wantsLocale = !hasExplicitUrlLocale(event.url) && event.url.pathname !== '/';
		const wantsPalette = !isPalette(cookiePalette);
		const wantsDepthStyle = !isDepthStyle(cookieDepthStyle);

		if (wantsLocale || wantsPalette || wantsDepthStyle) {
			try {
				const { getDb } = await import('$lib/server/db/index.js');
				const { user } = await import('$lib/server/db/auth.schema.js');
				const { eq } = await import('drizzle-orm');

				const rows = await getDb(event)
					.select({
						preferredLocale: user.preferredLocale,
						palette: user.palette,
						depthStyle: user.depthStyle,
					})
					.from(user)
					.where(eq(user.id, event.locals.user.id))
					.limit(1);

				const preferences = rows[0];
				if (wantsLocale && preferences?.preferredLocale != null) {
					event.request = setRequestLocaleCookie(
						event.request,
						preferences.preferredLocale,
					);
				}
				if (wantsPalette && isPalette(preferences?.palette)) {
					palette = preferences.palette;
				}
				if (wantsDepthStyle && isDepthStyle(preferences?.depthStyle)) {
					depthStyle = preferences.depthStyle;
					event.cookies.set(DEPTH_STYLE_COOKIE_NAME, depthStyle, {
						path: '/',
						maxAge: DEPTH_STYLE_COOKIE_MAX_AGE_SECONDS,
						httpOnly: false,
						sameSite: 'lax',
					});
				}
			} catch (err) {
				console.error('[userPreferencesHandle] failed to read user preferences', err);
			}
		}
	}

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replaceAll('%app.palette%', palette).replaceAll('%app.depth%', depthStyle),
	});
};

const authHandle: Handle = async ({ event, resolve }) => {
	rememberDatabaseBinding(event);

	if (!isDatabaseConfigured(event)) {
		return resolve(event);
	}

	if (
		isPublicWishlistPath(event.url.pathname) &&
		!hasBetterAuthSessionCookie(event.request.headers)
	) {
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
	sentryInitializationHandle,
	Sentry.sentryHandle(),
	requestTelemetryHandle,
	securityHeadersHandle,
	canonicalHostHandle,
	botProbeHandle,
	authHandle,
	userPreferencesHandle,
	paraglideHandle,
];

export const handle = sequence(...handles);

const logServerError: HandleServerError = ({ error, event, status, message }) => {
	console.error({
		event: 'server_error',
		routeId: event.route.id ?? 'unmatched',
		method: event.request.method,
		status,
		deploymentVersionId: event.platform?.env.CF_VERSION_METADATA?.id ?? 'local',
		// The thrown value itself — without it, 500s are undiagnosable in Workers logs.
		error: error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error),
	});

	return { message };
};

export const handleError = Sentry.handleErrorWithSentry(logServerError);
