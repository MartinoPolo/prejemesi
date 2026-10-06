import { dev } from '$app/environment';
import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { cookieName, getTextDirection, type Locale } from '$lib/paraglide/runtime';
import { getDb, isDatabaseConfigured, rememberDatabaseBinding } from '$lib/server/db/index.js';
import { DEMO_CLEANUP_INTERVAL_MS, DEMO_COOKIE_NAME } from '$lib/server/demo/constants.js';
import {
	DEV_AUTO_LOGIN_OPT_OUT_COOKIE_NAME,
	devAutoLoginOptOutChange,
	getDevAutoLoginEmail,
	signInForDevelopment,
} from '$lib/server/dev_auto_login.js';
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
const LANDING_PATHS = new Set(['/', '/en', '/en/']);

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
 * Decides which preferences need the authenticated user-row fallback. A demo always reads its
 * persona's palette and depth from the database (the visitor's cookies belong to their real
 * account) and keeps the visitor's current locale.
 */
function preferenceFallbacksFor(
	event: Parameters<Handle>[0]['event'],
	cookiePalette: string | undefined,
	cookieDepthStyle: string | undefined,
): { wantsLocale: boolean; wantsPalette: boolean; wantsDepthStyle: boolean } {
	if (event.locals.demoSession !== undefined) {
		return { wantsLocale: false, wantsPalette: true, wantsDepthStyle: true };
	}
	return {
		wantsLocale: !hasExplicitUrlLocale(event.url) && event.url.pathname !== '/',
		wantsPalette: !isPalette(cookiePalette),
		wantsDepthStyle: !isDepthStyle(cookieDepthStyle),
	};
}

/** The cookie mirror must keep reflecting the visitor's real account, never a demo persona. */
function mirrorDepthStyleCookie(event: Parameters<Handle>[0]['event'], depthStyle: DepthStyle) {
	if (event.locals.demoSession !== undefined) {
		return;
	}
	event.cookies.set(DEPTH_STYLE_COOKIE_NAME, depthStyle, {
		path: '/',
		maxAge: DEPTH_STYLE_COOKIE_MAX_AGE_SECONDS,
		httpOnly: false,
		sameSite: 'lax',
	});
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
		const { wantsLocale, wantsPalette, wantsDepthStyle } = preferenceFallbacksFor(
			event,
			cookiePalette,
			cookieDepthStyle,
		);

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
					mirrorDepthStyleCookie(event, depthStyle);
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

	const staleDemoCookie = await rejectLiveDemoAuthentication(event);
	const devAutoLoginEmail = getDevAutoLoginEmail();
	const attemptsDevAutoLogin =
		devAutoLoginEmail !== undefined &&
		isHtmlDocumentRequest(event) &&
		(event.cookies.get(DEV_AUTO_LOGIN_OPT_OUT_COOKIE_NAME) ?? '') === '' &&
		(event.cookies.get(DEMO_COOKIE_NAME) ?? '') === '';

	if (
		(event.request.method === 'GET' || event.request.method === 'HEAD') &&
		!event.isRemoteRequest &&
		!attemptsDevAutoLogin &&
		!hasBetterAuthSessionCookie(event.request.headers) &&
		(isPublicWishlistPath(event.url.pathname) ||
			(!event.isDataRequest && LANDING_PATHS.has(event.url.pathname)))
	) {
		return resolve(event);
	}

	const { createAuth, isReservedDemoEmail } = await import('$lib/server/auth.js');
	const { svelteKitHandler } = await import('better-auth/svelte-kit');
	const { building } = await import('$app/environment');
	const auth = createAuth(event);

	const sessionData = await auth.api.getSession({ headers: event.request.headers });

	if (sessionData) {
		if (!isReservedDemoEmail(sessionData.user.email)) {
			event.locals.session = sessionData.session;
			event.locals.user = sessionData.user;
		}
	} else if (
		attemptsDevAutoLogin &&
		(await signInForDevelopment(auth, devAutoLoginEmail, event.request.headers))
	) {
		redirect(303, event.url.pathname + event.url.search);
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });
	const appendedCookies: string[] = [];
	if (staleDemoCookie) {
		appendedCookies.push(
			event.cookies.serialize(DEMO_COOKIE_NAME, '', { path: '/', maxAge: 0 }),
		);
	}
	const optOutChange =
		devAutoLoginEmail === undefined ? undefined : devAutoLoginOptOutChange(event.url.pathname);
	if (optOutChange !== undefined) {
		appendedCookies.push(
			event.cookies.serialize(DEV_AUTO_LOGIN_OPT_OUT_COOKIE_NAME, optOutChange.value, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: optOutChange.maxAge,
			}),
		);
	}
	return withAppendedCookies(response, appendedCookies);
};

/** Returns whether the demo cookie is stale and must be deleted from the auth response. */
async function rejectLiveDemoAuthentication(
	event: Parameters<Handle>[0]['event'],
): Promise<boolean> {
	const demoToken = event.cookies.get(DEMO_COOKIE_NAME);
	if (
		!event.url.pathname.startsWith('/api/auth/') ||
		demoToken === undefined ||
		demoToken === ''
	) {
		return false;
	}
	const { findDemoSession } = await import('$lib/server/demo/session.js');
	if (await findDemoSession(demoToken)) {
		error(403, 'Leave the demo before signing in');
	}
	return true;
}

/** Auth API responses bypass SvelteKit's resolve, so `event.cookies` changes would not reach them. */
function withAppendedCookies(response: Response, serializedCookies: readonly string[]) {
	if (serializedCookies.length === 0) {
		return response;
	}
	const headers = new Headers(response.headers);
	for (const serializedCookie of serializedCookies) {
		headers.append('set-cookie', serializedCookie);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

let nextDemoCleanupAt = 0;

async function cleanDemosOnDocumentRequest(event: Parameters<Handle>[0]['event']) {
	if (!isHtmlDocumentRequest(event) || !isDatabaseConfigured(event)) {
		return;
	}
	const now = Date.now();
	if (now < nextDemoCleanupAt) {
		return;
	}
	// Claim the interval before awaiting: concurrent documents must not launch concurrent sweeps.
	nextDemoCleanupAt = now + DEMO_CLEANUP_INTERVAL_MS;
	// Captured before demoHandle can install this request's demo transaction on the event.
	const database = getDb(event);
	const cleanup = import('$lib/server/demo/session.js')
		.then(({ cleanExpiredDemos }) => cleanExpiredDemos(database))
		.catch((failure: unknown) => {
			console.error('[demoHandle] expired demo cleanup failed', failure);
		});
	if (event.platform?.ctx) {
		event.platform.ctx.waitUntil(cleanup);
		return;
	}
	await cleanup;
}

export const demoHandle: Handle = async ({ event, resolve }) => {
	await cleanDemosOnDocumentRequest(event);
	const token = event.cookies.get(DEMO_COOKIE_NAME);
	const requestedPath = new URL(event.request.url).pathname;
	if (
		token === undefined ||
		token === '' ||
		(!event.isRemoteRequest &&
			(requestedPath.startsWith('/demo/v1/') ||
				requestedPath.startsWith('/demo/playground/')))
	) {
		return resolve(event);
	}
	const { handleDemoRequest } = await import('$lib/server/demo/request.js');
	return handleDemoRequest(event, resolve, token);
};

const handles: Handle[] = [
	sentryInitializationHandle,
	Sentry.sentryHandle(),
	requestTelemetryHandle,
	securityHeadersHandle,
	canonicalHostHandle,
	botProbeHandle,
	authHandle,
	demoHandle,
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
