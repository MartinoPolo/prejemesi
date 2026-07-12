/**
 * Shared configuration for the load-test harness (issue #110).
 *
 * Isolation invariant (REQ-6): every row the harness creates is identifiable by
 * the `loadtest-` id prefix (users, wishlists, gifts) or by belonging to such a
 * row (reservations, likes, followers, notifications reference loadtest gifts /
 * users / wishlists). Cleanup deletes exclusively by that ownership and can
 * never touch real user rows.
 */

export const LOADTEST_ID_PREFIX = 'loadtest-';

/** Reserved domain (RFC 2606 `.invalid`) — these addresses can never receive mail. */
export const LOADTEST_EMAIL_DOMAIN = 'loadtest.invalid';

/**
 * Password for all loadtest accounts. Not a secret — the accounts own no data,
 * exist only on explicitly targeted databases, and are removed by cleanup.
 */
export const LOADTEST_PASSWORD = 'LoadTest-123456';

/** Max virtual users any profile can request; fixtures are sized to this. */
export const MAX_VIRTUAL_USERS = 100;

/** Number of browse-only gifts on the shared arena wishlist. */
export const ARENA_VIEW_GIFT_COUNT = 12;

export const TARGETS = {
	local: 'http://localhost:5173',
	preview: 'http://localhost:4173',
	production: 'https://prejemesi.cz',
} as const;

export type TargetName = keyof typeof TARGETS;

export const PRODUCTION_GUARD_ENV = 'LOADTEST_ALLOW_PRODUCTION';
export const PRODUCTION_GUARD_VALUE = 'I_UNDERSTAND_THIS_RUNS_AGAINST_PRODUCTION';

export function isLocalHostname(hostname: string): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Guard for any non-local target (REQ-6/AC-8): requires both the CLI flag and
 * the env acknowledgment so a production run is always a double-explicit act.
 */
export function assertRemoteTargetAuthorized(url: string, allowProductionFlag: boolean): void {
	const hostname = new URL(url).hostname;
	if (isLocalHostname(hostname)) {
		return;
	}
	const envValue = process.env[PRODUCTION_GUARD_ENV];
	if (!allowProductionFlag || envValue !== PRODUCTION_GUARD_VALUE) {
		throw new Error(
			[
				`Target ${url} is not local. Runs against shared environments must be explicitly authorized:`,
				`  1. pass --allow-production`,
				`  2. set ${PRODUCTION_GUARD_ENV}=${PRODUCTION_GUARD_VALUE}`,
				'See docs/LOAD_TESTING.md.',
			].join('\n'),
		);
	}
}
