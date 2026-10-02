import { dev } from '$app/environment';
import { redirect, error } from '@sveltejs/kit';
import { resolve as resolvePath } from '$app/paths';
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
		const isDemo = event.locals.demoSession !== undefined;
		const wantsLocale =
			!isDemo && !hasExplicitUrlLocale(event.url) && event.url.pathname !== '/';
		const wantsPalette = isDemo || !isPalette(cookiePalette);
		const wantsDepthStyle = isDemo || !isDepthStyle(cookieDepthStyle);

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
					if (!isDemo) {
						event.cookies.set(DEPTH_STYLE_COOKIE_NAME, depthStyle, {
							path: '/',
							maxAge: DEPTH_STYLE_COOKIE_MAX_AGE_SECONDS,
							httpOnly: false,
							sameSite: 'lax',
						});
					}
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
	if (event.url.pathname.startsWith('/api/auth/') && event.cookies.get('prejemesi_demo')) {
		error(403, 'Leave the demo before signing in');
	}

	if (!isDatabaseConfigured(event)) {
		return resolve(event);
	}

	if (
		(event.request.method === 'GET' || event.request.method === 'HEAD') &&
		!event.isRemoteRequest &&
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
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const demoAppPaths =
	/^\/(?:en\/)?(?:home|my-lists|followed|moderated|settings|w\/[^/]+(?:\/settings)?)\/?$/;
const demoLifecyclePaths = /^\/(?:en\/)?demo(?:\/(?:start|reset|exit))?\/?$/;

class DemoRequestFailed extends Error {
	constructor(readonly response: Response) {
		super('Demo request rolled back');
	}
}

const DEMO_CLEANUP_INTERVAL_MS = 60_000;
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
	try {
		const { cleanExpiredDemos } = await import('$lib/server/demo/session.js');
		await cleanExpiredDemos();
	} catch (failure) {
		console.error('[demoHandle] expired demo cleanup failed', failure);
	}
}

export const demoHandle: Handle = async ({ event, resolve }) => {
	await cleanDemosOnDocumentRequest(event);
	const token = event.cookies.get('prejemesi_demo');
	const requestedPath = new URL(event.request.url).pathname;
	if (
		!token ||
		(!event.isRemoteRequest &&
			(requestedPath.startsWith('/demo/v1/') ||
				requestedPath.startsWith('/demo/playground/')))
	) {
		return resolve(event);
	}
	const { digestDemoToken } = await import('$lib/server/demo/session.js');
	const path =
		event.isDataRequest && event.url.pathname.endsWith('/__data.json')
			? event.url.pathname.slice(0, -'/__data.json'.length)
			: event.url.pathname;
	if (event.isRemoteRequest && demoLifecyclePaths.test(path)) {
		error(403, 'This route is unavailable in the demo');
	}
	if (
		!demoAppPaths.test(path) &&
		!demoLifecyclePaths.test(path) &&
		!(isHtmlDocumentRequest(event) && (path === '/' || path === '/en' || path === '/en/'))
	) {
		error(403, 'This route is unavailable in the demo');
	}
	if (path.endsWith('/demo/exit')) {
		return resolve(event);
	}
	const { getDb, withRequestDatabaseTransaction } = await import('$lib/server/db/index.js');
	const { demoSession, user } = await import('$lib/server/db/auth.schema.js');
	const { eq, sql } = await import('drizzle-orm');
	const tokenHash = digestDemoToken(token);
	if (!tokenHash) {
		error(403, 'Invalid demo session');
	}
	try {
		return await getDb(event).transaction(async (tx) => {
			const [session] = await tx
				.select()
				.from(demoSession)
				.where(eq(demoSession.tokenHash, tokenHash))
				.for(
					event.request.method === 'GET' || event.request.method === 'HEAD'
						? 'share'
						: 'update',
				);
			if (!session || session.expiresAt <= new Date()) {
				event.locals.demoExpired = true;
				if (!/^\/(?:en\/)?demo(?:\/start)?\/?$/.test(path)) {
					if (!isHtmlDocumentRequest(event) && !event.isDataRequest) {
						error(410, 'Demo has expired');
					}
					throw redirect(303, path.startsWith('/en') ? '/en/demo' : resolvePath('/demo'));
				}
				return resolve(event);
			}
			if (path === '/' || path === '/en' || path === '/en/') {
				throw redirect(303, path.startsWith('/en') ? '/en/home' : resolvePath('/home'));
			}
			return withRequestDatabaseTransaction(event, tx, async () => {
				if (
					event.request.method !== 'GET' &&
					event.request.method !== 'HEAD' &&
					!path.endsWith('/demo/start')
				) {
					if (
						session.editRequests >= 120 ||
						(path.endsWith('/demo/reset') && session.resets >= 5)
					) {
						error(429, 'Demo edit limit reached');
					}
					await tx
						.update(demoSession)
						.set({
							editRequests: sql`${demoSession.editRequests} + 1`,
							...(path.endsWith('/demo/reset')
								? { resets: sql`${demoSession.resets} + 1` }
								: {}),
						})
						.where(eq(demoSession.id, session.id));
				}
				const [viewer] = await tx
					.select()
					.from(user)
					.where(eq(user.id, session.viewerUserId))
					.limit(1);
				if (!viewer || viewer.demoSessionId !== session.id) {
					error(410, 'Demo has expired');
				}
				event.locals.realUser = event.locals.user;
				event.locals.demoSession = { id: session.id, expiresAt: session.expiresAt };
				event.locals.user = viewer;
				event.locals.session = {
					id: session.id,
					token: '',
					userId: viewer.id,
					expiresAt: session.expiresAt,
					createdAt: session.createdAt,
					updatedAt: session.createdAt,
				} as NonNullable<typeof event.locals.session>;
				const response = await resolve(event);
				if (response.status >= 400) {
					throw new DemoRequestFailed(response);
				}
				if (session.expiresAt <= new Date()) {
					error(410, 'Demo has expired');
				}
				return response;
			});
		});
	} catch (failure) {
		if (failure instanceof DemoRequestFailed) {
			return failure.response;
		}
		throw failure;
	}
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
