import { getRequestEvent } from '$app/server';

/**
 * Per-browser identity for anonymous visitors.
 *
 * Anonymous users have no account, so the app cannot recognise "their own"
 * reservations across requests. We mint an opaque random id the first time an
 * anonymous visitor reserves a gift, store it in an httpOnly cookie, and persist
 * it on the reservation row (`reservation.anonymous_visitor_id`). Whoever holds
 * the cookie can later cancel that reservation — a capability token scoped to the
 * browser. UUIDv4 (122 bits of randomness) is unguessable, so a leaked id is the
 * only way to act on someone else's anonymous reservation.
 *
 * Trade-off: clearing cookies or switching device loses the handle (a moderator
 * can still cancel, and registering with a matching email auto-links). This keeps
 * the "anonymous = no persistence" decision while making own-reservation cancel
 * work, per CONTEXT.md ("a Visitor can reserve, unreserve, and like gifts").
 */

const ANON_VISITOR_COOKIE = 'darecky_anon_id';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Reads the anonymous visitor id from the request cookie, or null if absent.
 * Safe to call from queries and commands. Returns null outside a request context
 * (e.g. in unit tests where there is no request event).
 */
export function getAnonVisitorId(): string | null {
	try {
		return getRequestEvent().cookies.get(ANON_VISITOR_COOKIE) ?? null;
	} catch {
		return null;
	}
}

/**
 * Returns the existing anonymous visitor id, or mints + sets a new one.
 * MUST be called from a `command`/`form` handler — only those may write cookies.
 * Returns null outside a request context (unit tests), in which case the caller
 * simply persists a null visitor id (the reservation still succeeds).
 */
export function getOrCreateAnonVisitorId(): string | null {
	try {
		const event = getRequestEvent();
		const existing = event.cookies.get(ANON_VISITOR_COOKIE);
		if (existing != null && existing !== '') {
			return existing;
		}
		const id = crypto.randomUUID();
		event.cookies.set(ANON_VISITOR_COOKIE, id, {
			path: '/',
			maxAge: ONE_YEAR_SECONDS,
		});
		return id;
	} catch {
		return null;
	}
}
