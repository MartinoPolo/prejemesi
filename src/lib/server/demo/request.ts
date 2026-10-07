import { error, redirect, type Handle, type RequestEvent } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { resolve as resolveRoute } from '$app/paths';
import {
	getDb,
	withRequestDatabaseTransaction,
	type DatabaseTransaction,
} from '$lib/server/db/index.js';
import { demoSession, user } from '$lib/server/db/auth.schema.js';
import { getActiveLocaleForUrl } from '$lib/i18n/locale.js';
import { localizeUrl } from '$lib/paraglide/runtime.js';
import { clearDemoCookie, digestDemoToken } from './session.js';
import { DEMO_EDIT_REQUEST_LIMIT, DEMO_RESET_LIMIT } from './constants.js';

type ResolveRequest = Parameters<Handle>[0]['resolve'];
type DemoSessionRow = typeof demoSession.$inferSelect;
interface DemoEditCharge {
	sessionId: string;
	isReset: boolean;
}

const demoAppPaths =
	/^\/(?:en\/)?(?:home|my-lists|followed|moderated|settings|w\/[^/]+(?:\/settings)?)\/?$/;
const demoLifecyclePaths = /^\/(?:en\/)?demo(?:\/(?:start|reset|exit))?\/?$/;
const demoEntryPaths = /^\/(?:en\/)?demo(?:\/start)?\/?$/;
const demoExitPath = /^\/(?:en\/)?demo\/exit\/?$/;
const demoResetPath = /^\/(?:en\/)?demo\/reset\/?$/;
const demoStartPath = /^\/(?:en\/)?demo\/start\/?$/;
const publicWishlistPaths = /^\/(?:en\/)?w\//;
const landingPaths = new Set(['/', '/en', '/en/']);

class DemoRequestFailed extends Error {
	constructor(readonly response: Response) {
		super('Demo request rolled back');
	}
}

function isReadRequest(event: RequestEvent): boolean {
	return event.request.method === 'GET' || event.request.method === 'HEAD';
}

function isPageNavigation(event: RequestEvent): boolean {
	return (
		isReadRequest(event) &&
		!event.isRemoteRequest &&
		(event.isDataRequest ||
			(event.request.headers.get('accept')?.includes('text/html') ?? false))
	);
}

function requestedPagePath(event: RequestEvent): string {
	return event.isDataRequest && event.url.pathname.endsWith('/__data.json')
		? event.url.pathname.slice(0, -'/__data.json'.length)
		: event.url.pathname;
}

/** Runs before the Paraglide middleware, so `localizeHref` would lack its request origin and locale. */
function localizedRoute(event: RequestEvent, route: '/demo' | '/home'): string {
	return localizeUrl(new URL(resolveRoute(route), event.url), {
		locale: getActiveLocaleForUrl(event.url),
	}).pathname;
}

/**
 * Shared wishlist links reuse the demo `/w/` routes, so an expired cookie must not hijack them;
 * the remaining playground surfaces keep offering a fresh playground (REQ-7).
 */
function offersFreshPlayground(path: string): boolean {
	return (
		landingPaths.has(path) ||
		demoLifecyclePaths.test(path) ||
		(demoAppPaths.test(path) && !publicWishlistPaths.test(path))
	);
}

function resolveExpiredDemo(event: RequestEvent, resolve: ResolveRequest, path: string) {
	if (!offersFreshPlayground(path)) {
		clearDemoCookie(event);
		return resolve(event);
	}
	event.locals.demoExpired = true;
	if (demoEntryPaths.test(path)) {
		return resolve(event);
	}
	if (!isPageNavigation(event)) {
		error(410, 'Demo has expired');
	}
	redirect(303, localizedRoute(event, '/demo'));
}

/** The pathname of a remote call is client-supplied, so remote calls are never redirected by it. */
function assertLiveDemoPath(event: RequestEvent, path: string): void {
	if (event.isRemoteRequest) {
		if (demoLifecyclePaths.test(path) || !demoAppPaths.test(path)) {
			error(403, 'This route is unavailable in the demo');
		}
		return;
	}
	if (landingPaths.has(path)) {
		redirect(303, localizedRoute(event, '/home'));
	}
	if (demoAppPaths.test(path) || demoLifecyclePaths.test(path)) {
		return;
	}
	if (isPageNavigation(event)) {
		redirect(303, localizedRoute(event, '/demo'));
	}
	error(403, 'This route is unavailable in the demo');
}

function chargeDemoEdit(
	database: DatabaseTransaction | ReturnType<typeof getDb>,
	charge: DemoEditCharge,
) {
	return database
		.update(demoSession)
		.set({
			editRequests: sql`${demoSession.editRequests} + 1`,
			...(charge.isReset ? { resets: sql`${demoSession.resets} + 1` } : {}),
		})
		.where(eq(demoSession.id, charge.sessionId));
}

function demoEditCharge(event: RequestEvent, path: string, session: DemoSessionRow) {
	if (isReadRequest(event) || demoStartPath.test(path)) {
		return undefined;
	}
	const isReset = demoResetPath.test(path);
	if (
		session.editRequests >= DEMO_EDIT_REQUEST_LIMIT ||
		(isReset && session.resets >= DEMO_RESET_LIMIT)
	) {
		error(429, 'Demo edit limit reached');
	}
	return { sessionId: session.id, isReset };
}

async function resolveAsDemoViewer(
	event: RequestEvent,
	resolve: ResolveRequest,
	transaction: DatabaseTransaction,
	session: DemoSessionRow,
): Promise<Response> {
	const [viewer] = await transaction
		.select()
		.from(user)
		.where(eq(user.id, session.viewerUserId))
		.limit(1);
	if (viewer === undefined || viewer.demoSessionId !== session.id) {
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
}

export async function handleDemoRequest(
	event: RequestEvent,
	resolve: ResolveRequest,
	token: string,
): Promise<Response> {
	const path = requestedPagePath(event);
	if (!event.isRemoteRequest && demoExitPath.test(path)) {
		return resolve(event);
	}
	const tokenHash = digestDemoToken(token);
	if (tokenHash === null) {
		clearDemoCookie(event);
		return resolve(event);
	}
	let charge: DemoEditCharge | undefined;
	try {
		const liveResponse = await getDb(event).transaction(async (transaction) => {
			const [session] = await transaction
				.select()
				.from(demoSession)
				.where(eq(demoSession.tokenHash, tokenHash))
				.for(isReadRequest(event) ? 'share' : 'update');
			// Cleanup deletes expired rows, so an unknown well-formed token is an expired visit.
			if (session === undefined || session.expiresAt <= new Date()) {
				return null;
			}
			assertLiveDemoPath(event, path);
			charge = demoEditCharge(event, path, session);
			if (charge) {
				await chargeDemoEdit(transaction, charge);
			}
			return withRequestDatabaseTransaction(event, transaction, () =>
				resolveAsDemoViewer(event, resolve, transaction, session),
			);
		});
		return liveResponse ?? (await resolveExpiredDemo(event, resolve, path));
	} catch (failure) {
		if (charge) {
			// The failed request rolled back its charge; edits must still count against the limit.
			await chargeDemoEdit(getDb(event), charge);
		}
		if (failure instanceof DemoRequestFailed) {
			return failure.response;
		}
		throw failure;
	}
}
