import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { User, Session } from 'better-auth';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(),
	query: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
	command: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

/**
 * Wrap a handler so it satisfies SvelteKit's init_remote_functions validator,
 * which requires `fn.__?.type` to be a recognised remote type, while still
 * being callable as a plain function in tests.
 */
function makeRemoteWrapper(
	type: string,
	handler: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	const wrapper = (...args: unknown[]) => handler(...args);
	(wrapper as unknown as Record<string, unknown>).__ = { type };
	return wrapper;
}

vi.mock('$lib/server/remote.js', () => ({
	// Single-flight refresh is a runtime-only concern (no-op outside remote requests).
	singleFlightRefresh: vi.fn(),
	publicCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('command', handler),
	),
	publicQuery: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('query', handler),
	),
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('command', handler),
	),
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('query', handler),
	),
}));

// Cross-module queries referenced only for single-flight refreshes (issue #108);
// mocked so this suite does not load the other module's schema graph.
vi.mock('$lib/modules/gifts/gifts.remote.js', () => ({
	getGiftsByWishlistShortId: vi.fn(),
}));

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(),
}));

vi.mock('$lib/server/turnstile.js', () => ({
	verifyTurnstileToken: vi.fn(),
}));

vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));

// admin@example.com is the app admin (issue #150 / #213). The visitor and moderator personas
// below deliberately do NOT match, so every pre-#213 case keeps its original meaning.
vi.mock('$env/dynamic/private', () => ({
	env: { ADMIN_EMAILS: 'admin@example.com' },
}));

// Drizzle ORM helpers are used only as column references in query builders.
// We don't need their real implementations – stub them so the module loads.
vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
	and: vi.fn(),
	isNull: vi.fn(),
	sql: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { getDb } from '$lib/server/db/index.js';
import { getRequestEvent } from '$app/server';
import { verifyTurnstileToken } from '$lib/server/turnstile.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import {
	reserveGift,
	unreserveGift,
	getReservationsForGift,
	getMyReservationsForGift,
} from './reservations.remote.js';
import type { ReserveGiftInput, UnreserveInput } from './types.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

const mockGetDb = vi.mocked(getDb);
const mockGetRequestEvent = vi.mocked(getRequestEvent);
const mockVerifyTurnstileToken = vi.mocked(verifyTurnstileToken);
const mockDispatchNotification = vi.mocked(dispatchNotification);

/** Stub getRequestEvent so the anon-visitor helper reads `cookieValue` from the cookie. */
function mockAnonCookie(cookieValue: string | undefined) {
	mockGetRequestEvent.mockReturnValue({
		cookies: { get: () => cookieValue },
	} as unknown as ReturnType<typeof getRequestEvent>);
}

const OWNER_ID = 'user-owner';
const VISITOR_ID = 'user-visitor';
const MODERATOR_ID = 'user-moderator';
const ADMIN_ID = 'user-admin';
const GIFT_ID = 'gift-1';
const GIFT_NAME = 'Kávovar';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc123';
const RESERVATION_ID = 'reservation-1';

const fakeOwnerUser = { id: OWNER_ID, email: 'owner@example.com' } as unknown as User;
/** Matches the mocked ADMIN_EMAILS — the app administrator (issue #213). */
const fakeAdminUser = {
	id: ADMIN_ID,
	name: 'Admin Adminová',
	email: 'admin@example.com',
} as unknown as User;
/** The app administrator signed in on a list where THEY are the obdarovaný (REQ-6). */
const fakeAdminRecipientUser = {
	id: OWNER_ID,
	name: 'Admin Adminová',
	email: 'admin@example.com',
} as unknown as User;
const fakeVisitorUser = { id: VISITOR_ID, email: 'visitor@example.com' } as unknown as User;
/** A visitor with a real display name — used to prove that name never reaches a dispatch payload. */
const fakeNamedVisitorUser = {
	id: VISITOR_ID,
	name: 'Petr Svoboda',
	email: 'visitor@example.com',
} as unknown as User;
const fakeModeratorUser = { id: MODERATOR_ID, email: 'mod@example.com' } as unknown as User;
const fakeSession = { id: 'session-1', userId: OWNER_ID } as unknown as Session;

function makeAuthContext(user: User) {
	return { user, session: fakeSession };
}

/**
 * Creates a chainable Drizzle-like mock DB object that can serve multiple
 * sequential queries. Each call to `getDb()` returns a fresh chain whose
 * `then` (and `.returning()`) pops from `resultsQueue`.
 *
 * This handles the case where one `database` reference (obtained via a single
 * `getDb()` call) is reused for multiple `await database.select(...)` chains.
 */
function createMultiQueryChain(...resultsQueue: unknown[][]) {
	const queue = [...resultsQueue];

	const chain: Record<string, unknown> = {};
	const chainMethods = [
		'select',
		'from',
		'where',
		'innerJoin',
		'leftJoin',
		'limit',
		'orderBy',
		'groupBy',
		'as',
		'for',
		'insert',
		'values',
		'update',
		'set',
		'delete',
	] as const;

	for (const method of chainMethods) {
		chain[method] = vi.fn(() => chain);
	}

	// .returning() terminates insert chains – pops from queue
	chain['returning'] = vi.fn(() => Promise.resolve(queue.shift() ?? []));

	// transaction(cb) invokes the callback with the SAME chain so its queue
	// serves the in-transaction queries (locked gift select → count → insert).
	chain['transaction'] = vi.fn((cb: (tx: unknown) => unknown) => cb(chain));

	// Make the chain awaitable – each top-level await pops from queue
	// oxlint-disable-next-line no-thenable -- intentional: mock must be thenable to simulate Drizzle's await behavior
	chain['then'] = (resolve: (value: unknown) => unknown) => resolve(queue.shift() ?? []);

	return chain;
}

/** Shorthand: single-result chain (the common case). */
function createChain(returnValue: unknown[] = []) {
	return createMultiQueryChain(returnValue);
}

/** Fake wishlist row for an active (non-archived) list whose linked recipient is OWNER_ID. */
function makeActiveWishlistRow() {
	return {
		gift: {
			id: GIFT_ID,
			wishlistId: WISHLIST_ID,
			name: GIFT_NAME,
			quantity: 5,
			deletedAt: null,
		},
		wishlist: {
			id: WISHLIST_ID,
			recipientUserId: OWNER_ID,
			title: 'Narozeniny',
			shortId: WISHLIST_SHORT_ID,
			status: 'active',
			deletedAt: null,
		},
	};
}

// ── reserveGift ───────────────────────────────────────────────────────────────

describe('reserveGift', () => {
	const validInput: ReserveGiftInput = {
		giftId: GIFT_ID,
		quantity: 1,
	};

	beforeEach(() => {
		vi.resetAllMocks();
		mockVerifyTurnstileToken.mockImplementation(async ({ token }) =>
			token == null || token === ''
				? { success: false, reason: 'missing' }
				: { success: true },
		);
	});

	// reserveGift now enforces capacity atomically inside database.transaction():
	//   - getDb() call #1 = `database`; used for database.transaction(cb). The mocked
	//     transaction invokes cb with the SAME chain, whose queue serves the in-tx
	//     queries in order: locked gift select (.for('update')) → active count → insert.
	//   - getDb() call #2 = getGiftWithWishlist's own getDb() (wishlist row).
	//   - getActiveReservedCount no longer calls getDb() – it runs on the passed tx.

	it('authenticated visitor can reserve a gift – returns { id }', async () => {
		// Call #1: `database` – transaction queue: locked gift, count, insert.returning()
		const database = createMultiQueryChain(
			[{ quantity: 5 }],
			[{ totalQuantity: 0 }],
			[{ id: RESERVATION_ID }],
		);
		// Call #2: getGiftWithWishlist query
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		const result = await (reserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		expect(result).toEqual({ id: RESERVATION_ID });
		expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
	});

	// Reserver identity is personal data (issue #198): the GIFT_RESERVED / LIKED_GIFT_RESERVED
	// dispatches must never carry the reserving user's name, only the server-side actorId.
	it("dispatches GIFT_RESERVED and LIKED_GIFT_RESERVED without actorName and never leaks the reserver's account name", async () => {
		const database = createMultiQueryChain(
			[{ quantity: 5 }],
			[{ totalQuantity: 0 }],
			[{ id: RESERVATION_ID }],
		);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await (reserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeNamedVisitorUser),
			validInput,
		);

		expect(mockDispatchNotification).toHaveBeenCalledTimes(2);
		for (const [payload] of mockDispatchNotification.mock.calls) {
			expect(payload.actorName).toBeUndefined();
			expect(payload.actorId).toBe(VISITOR_ID);
		}
		expect(JSON.stringify(mockDispatchNotification.mock.calls)).not.toContain('Petr Svoboda');
	});

	it('anonymous reservation rejects a missing Turnstile token before DB work', async () => {
		mockVerifyTurnstileToken.mockResolvedValue({ success: false, reason: 'missing' });

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(null, {
				...validInput,
				anonymousName: 'Jan Novak',
			}),
		).rejects.toMatchObject({ status: 400, message: SERVER_ERROR.TURNSTILE_REQUIRED });
		expect(mockGetDb).not.toHaveBeenCalled();
	});

	// A present-but-bad token is a positive bot signal → reject before any DB work.
	it.each([
		['invalid', 403, SERVER_ERROR.TURNSTILE_INVALID],
		['expired_or_replayed', 403, SERVER_ERROR.TURNSTILE_EXPIRED_OR_REPLAYED],
	] as const)(
		'anonymous reservation rejects %s Turnstile verification before DB work',
		async (reason, status, message) => {
			mockVerifyTurnstileToken.mockResolvedValue({ success: false, reason });

			await expect(
				(reserveGift as (...args: unknown[]) => unknown)(null, {
					...validInput,
					anonymousName: 'Jan Novak',
					turnstileToken: 'rejected-token',
				}),
			).rejects.toMatchObject({ status, message });
			expect(mockGetDb).not.toHaveBeenCalled();
		},
	);

	// The check could not RUN (secret unconfigured, or Siteverify unreachable) — an
	// operational failure, not a bot signal. Fail open: allow the reservation but log it,
	// so a Turnstile outage/misconfig never takes guest reservation fully offline.
	it.each(['configuration', 'unavailable'] as const)(
		'anonymous reservation fails open (proceeds + logs) when Turnstile cannot run: %s',
		async (reason) => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			mockVerifyTurnstileToken.mockResolvedValue({ success: false, reason });

			const database = createMultiQueryChain(
				[{ quantity: 5 }],
				[{ totalQuantity: 0 }],
				[{ id: RESERVATION_ID }],
			);
			const wishlistDb = createChain([makeActiveWishlistRow()]);
			mockGetDb
				.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
				.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

			const result = await (reserveGift as (...args: unknown[]) => unknown)(null, {
				...validInput,
				anonymousName: 'Jan Novak',
				turnstileToken: 'unverifiable-token',
			});

			expect(result).toEqual({ id: RESERVATION_ID });
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(reason));
			warnSpy.mockRestore();
		},
	);

	// CI-level regression guard for the atomic structure. The real proof that
	// concurrent reservations cannot overbook lives in reservations.race.test.ts
	// (real DB) – but those skip in CI, so this asserts the transaction + row lock
	// are still present, catching their accidental removal.
	it('capacity check runs inside a transaction that locks the gift row (FOR UPDATE)', async () => {
		const database = createMultiQueryChain(
			[{ quantity: 5 }],
			[{ totalQuantity: 0 }],
			[{ id: RESERVATION_ID }],
		);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await (reserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		const txChain = database as unknown as Record<string, ReturnType<typeof vi.fn>>;

		// The capacity check + insert run inside database.transaction(...).
		expect(txChain['transaction']).toHaveBeenCalledTimes(1);
		// The gift row is locked with FOR UPDATE so concurrent reservations serialize.
		expect(txChain['for']).toHaveBeenCalledWith('update');
	});

	it('linked recipient cannot reserve their own gift – throws 403', async () => {
		// Call #1: `database` – transaction never reached (throws on pre-check)
		const database = createChain([]);
		// Call #2: wishlist lookup – recipientUserId matches the caller
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeOwnerUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403 });
	});

	it('cannot reserve on an archived wishlist – throws 400', async () => {
		const archivedRow = {
			...makeActiveWishlistRow(),
			wishlist: { ...makeActiveWishlistRow().wishlist, status: 'archived' },
		};
		const database = createChain([]);
		const wishlistDb = createChain([archivedRow]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeVisitorUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 400 });
	});

	it('anonymous user without a name – throws 400', async () => {
		const database = createChain([]);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(null, {
				...validInput,
				anonymousName: '',
				turnstileToken: 'valid-token',
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('anonymous user with only whitespace name – throws 400', async () => {
		const database = createChain([]);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(null, {
				...validInput,
				anonymousName: '   ',
				turnstileToken: 'valid-token',
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('quantity less than 1 – throws 400', async () => {
		const database = createChain([]);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(makeAuthContext(fakeVisitorUser), {
				...validInput,
				quantity: 0,
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('over-reservation rejected – throws 400', async () => {
		// Gift has quantity 5, all 5 already reserved under the lock – available = 0.
		// Transaction queue: locked gift (quantity 5), count (5). Insert never reached.
		const database = createMultiQueryChain([{ quantity: 5 }], [{ totalQuantity: 5 }]);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(makeAuthContext(fakeVisitorUser), {
				...validInput,
				quantity: 1,
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('anonymous user with valid name can reserve – returns { id }', async () => {
		const database = createMultiQueryChain(
			[{ quantity: 5 }],
			[{ totalQuantity: 0 }],
			[{ id: RESERVATION_ID }],
		);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		const result = await (reserveGift as (...args: unknown[]) => unknown)(null, {
			...validInput,
			anonymousName: 'Jan Novak',
			turnstileToken: 'valid-token',
		});

		expect(result).toEqual({ id: RESERVATION_ID });
		expect(mockVerifyTurnstileToken).toHaveBeenCalledWith({ token: 'valid-token' });
	});
});

// ── unreserveGift ─────────────────────────────────────────────────────────────

describe('unreserveGift', () => {
	const validInput: UnreserveInput = { reservationId: RESERVATION_ID };

	beforeEach(() => {
		vi.resetAllMocks();
	});

	// unreserveGift stores ONE `database` from getDb() (call #1) and reuses it for:
	//   - reservation SELECT (query 1 on database)
	//   - soft-delete UPDATE (final query on database)
	// For an anonymous reservation cancelled by an authenticated user, the handler also:
	//   - getGiftWithWishlist(): its own getDb() call (call #2) → joined gift+wishlist row
	//   - resolveWishlistRole(): if not the recipient, hasActiveModeratorAssignment()
	//     makes its own getDb() call (call #3) for the mod check.

	it('authenticated user can unreserve their own reservation – returns { success: true }', async () => {
		// Call #1: `database` – used for reservation SELECT then UPDATE
		// Queue: [reservation row array, [] for update]
		const database = createMultiQueryChain(
			[{ id: RESERVATION_ID, giftId: GIFT_ID, userId: VISITOR_ID, deletedAt: null }],
			[], // update result (unused)
		);

		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		expect(result).toEqual({ success: true });
	});

	it('authenticated user cannot unreserve someone else reservation – throws 403', async () => {
		// Reservation belongs to a different user – throws before any further queries
		const database = createChain([
			{ id: RESERVATION_ID, giftId: GIFT_ID, userId: 'other-user', deletedAt: null },
		]);

		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeVisitorUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403 });
	});

	it('anonymous visitor with the matching cookie can unreserve their own reservation', async () => {
		// Anonymous reservation whose anonymousVisitorId matches the visitor's cookie.
		const database = createMultiQueryChain(
			[
				{
					id: RESERVATION_ID,
					giftId: GIFT_ID,
					userId: null,
					anonymousVisitorId: 'anon-token-1',
					deletedAt: null,
				},
			],
			[], // update result (unused)
		);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);
		mockAnonCookie('anon-token-1');

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(null, validInput);

		expect(result).toEqual({ success: true });
	});

	it('anonymous visitor with a mismatched cookie cannot unreserve – throws 403', async () => {
		const database = createChain([
			{
				id: RESERVATION_ID,
				giftId: GIFT_ID,
				userId: null,
				anonymousVisitorId: 'anon-token-1',
				deletedAt: null,
			},
		]);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);
		mockAnonCookie('a-different-token');

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(null, validInput),
		).rejects.toMatchObject({ status: 403 });
	});

	it('anonymous visitor without any cookie cannot unreserve – throws 403', async () => {
		const database = createChain([
			{
				id: RESERVATION_ID,
				giftId: GIFT_ID,
				userId: null,
				anonymousVisitorId: 'anon-token-1',
				deletedAt: null,
			},
		]);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);
		mockAnonCookie(undefined);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(null, validInput),
		).rejects.toMatchObject({ status: 403 });
	});

	it('moderator can unreserve an anonymous reservation – returns { success: true }', async () => {
		// Call #1: `database` – reservation SELECT, then UPDATE.
		const database = createMultiQueryChain(
			[{ id: RESERVATION_ID, giftId: GIFT_ID, userId: null, deletedAt: null }], // reservation
			[], // update (unused)
		);
		// Call #2: getGiftWithWishlist's own getDb() – joined gift+wishlist row (recipient ≠ mod)
		const giftDb = createChain([makeActiveWishlistRow()]);
		// Call #3: resolveWishlistRole → hasActiveModeratorAssignment's getDb() – assignment found
		const modDb = createChain([{ id: 'mod-assignment-1' }]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeModeratorUser),
			validInput,
		);

		expect(result).toEqual({ success: true });
	});

	it('non-moderator authenticated user cannot unreserve an anonymous reservation – throws 403', async () => {
		// Call #1: `database` – reservation SELECT (update never reached).
		const database = createMultiQueryChain(
			[{ id: RESERVATION_ID, giftId: GIFT_ID, userId: null, deletedAt: null }], // reservation
		);
		// Call #2: getGiftWithWishlist's own getDb() – joined gift+wishlist row (recipient ≠ visitor)
		const giftDb = createChain([makeActiveWishlistRow()]);
		// Call #3: resolveWishlistRole → hasActiveModeratorAssignment's getDb() – no assignment
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeVisitorUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403 });
	});
});

// ── unreserveGift: administrator release override (issue #213) ────────────────

/**
 * Expected truths derive from issue #213's requirements, not from the implementation:
 *   REQ-1  an app administrator releases ANY reservation on ANY wishlist;
 *   REQ-2  a správce keeps guest-only reach — a signed-in gifter's row is rejected;
 *   REQ-6  the obdarovaný gets nothing, even when they are the administrator;
 *   REQ-9  the released gifter is notified; releasing one's OWN reservation notifies nobody;
 *   REQ-10 every cancellation path records who released it.
 */
describe('unreserveGift — administrator release (issue #213)', () => {
	const validInput: UnreserveInput = { reservationId: RESERVATION_ID };

	/** A reservation held by a signed-in gifter (VISITOR_ID). */
	const signedInGifterReservation = {
		id: RESERVATION_ID,
		giftId: GIFT_ID,
		userId: VISITOR_ID,
		anonymousName: null,
		anonymousEmail: null,
		deletedAt: null,
	};

	/** A guest reservation, optionally with a contact address. */
	function guestReservation(anonymousEmail: string | null) {
		return {
			id: RESERVATION_ID,
			giftId: GIFT_ID,
			userId: null,
			anonymousName: 'Babička',
			anonymousEmail,
			anonymousVisitorId: 'anon-token-1',
			deletedAt: null,
		};
	}

	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("an app administrator releases a signed-in gifter's reservation (REQ-1)", async () => {
		// Call #1: reservation SELECT + soft-delete UPDATE.
		const database = createMultiQueryChain([signedInGifterReservation], []);
		// Call #2: getGiftWithWishlist. Call #3: moderator lookup (admin manages nothing here).
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(result).toEqual({ success: true });
	});

	it('an app administrator releases a guest reservation on a list they neither own nor moderate (REQ-1)', async () => {
		const database = createMultiQueryChain([guestReservation(null)], []);
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]); // no moderator assignment → plain visitor role

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(result).toEqual({ success: true });
	});

	// The rejection must cost NO extra query: a správce is indistinguishable from any other
	// non-administrator here, and the administrator check is a pure env read.
	it("a správce cannot release a signed-in gifter's reservation (REQ-2)", async () => {
		const database = createChain([signedInGifterReservation]);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeModeratorUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403, message: SERVER_ERROR.RELEASE_REQUIRES_ADMIN });
		expect(mockGetDb).toHaveBeenCalledTimes(1);
	});

	it('the obdarovaný cannot release, even when they are the app administrator (REQ-6)', async () => {
		const database = createChain([signedInGifterReservation]);
		// The wishlist's linked recipient IS the caller.
		const giftDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeAdminRecipientUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403, message: SERVER_ERROR.ACCESS_DENIED });
	});

	it('notifies the released signed-in gifter, naming the gift (REQ-9)', async () => {
		const database = createMultiQueryChain([signedInGifterReservation], []);
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
				targetUserIds: [VISITOR_ID],
				giftId: GIFT_ID,
				giftName: GIFT_NAME,
				actorId: ADMIN_ID,
			}),
		);
	});

	it('emails a released guest who left an address (REQ-9)', async () => {
		const database = createMultiQueryChain([guestReservation('babicka@example.com')], []);
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
				targetEmails: ['babicka@example.com'],
				giftName: GIFT_NAME,
			}),
		);
	});

	it('notifies nobody when the released guest left no address (REQ-9)', async () => {
		const database = createMultiQueryChain([guestReservation(null)], []);
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('dispatches no notification when a gifter cancels their OWN reservation (REQ-9)', async () => {
		const database = createMultiQueryChain([signedInGifterReservation], []);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('records the cancelling user on a self-cancel (REQ-10)', async () => {
		const database = createMultiQueryChain([signedInGifterReservation], []);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		expect(database['set']).toHaveBeenCalledWith(
			expect.objectContaining({ cancelledByUserId: VISITOR_ID }),
		);
	});

	it('records the administrator as the canceller on a release (REQ-10)', async () => {
		const database = createMultiQueryChain([signedInGifterReservation], []);
		const giftDb = createChain([makeActiveWishlistRow()]);
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(giftDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			validInput,
		);

		expect(database['set']).toHaveBeenCalledWith(
			expect.objectContaining({ cancelledByUserId: ADMIN_ID }),
		);
	});

	// A guest self-cancel has no account to record — the NULL is what makes an override
	// (`cancelledByUserId !== null && !== userId`) distinguishable from a self-cancel.
	it('leaves the canceller NULL on a guest self-cancel (REQ-10)', async () => {
		const database = createMultiQueryChain([guestReservation(null)], []);
		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);
		mockAnonCookie('anon-token-1');

		await (unreserveGift as (...args: unknown[]) => unknown)(null, validInput);

		expect(database['set']).toHaveBeenCalledWith(
			expect.objectContaining({ cancelledByUserId: null }),
		);
	});
});

// ── getReservationsForGift ────────────────────────────────────────────────────

describe('getReservationsForGift', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('linked recipient gets empty reservations array – core privacy invariant', async () => {
		// getGiftWithWishlist
		const wishlistChain = createChain([makeActiveWishlistRow()]);
		// resolveWishlistRole: userId === recipientUserId → short-circuits, no mod DB call needed
		mockGetDb.mockReturnValueOnce(wishlistChain as unknown as ReturnType<typeof getDb>);

		const result = (await (getReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeOwnerUser),
			GIFT_ID,
		)) as { reservations: unknown[]; role: string };

		expect(result.reservations).toEqual([]);
		expect(result.role).toBe('recipient');
	});

	it('anonymous visitor gets empty reservations array', async () => {
		// getGiftWithWishlist
		const wishlistChain = createChain([makeActiveWishlistRow()]);
		// determineRole: userId is null → returns 'visitor' without DB call
		mockGetDb.mockReturnValueOnce(wishlistChain as unknown as ReturnType<typeof getDb>);

		const result = (await (getReservationsForGift as (...args: unknown[]) => unknown)(
			null,
			GIFT_ID,
		)) as { reservations: unknown[]; role: string };

		expect(result.reservations).toEqual([]);
		expect(result.role).toBe('visitor');
	});

	it('authenticated non-moderator visitor gets empty reservations array', async () => {
		const wishlistChain = createChain([makeActiveWishlistRow()]);
		// Moderator lookup returns no rows → visitor
		const modChain = createChain([]);
		mockGetDb
			.mockReturnValueOnce(wishlistChain as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modChain as unknown as ReturnType<typeof getDb>);

		const result = (await (getReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			GIFT_ID,
		)) as { reservations: unknown[]; role: string };

		expect(result.reservations).toEqual([]);
		expect(result.role).toBe('visitor');
	});

	// REQ-4: the ledger must name the gifter. A signed-in gifter's row carries their account
	// name (joined from `user`), NOT the „Authenticated user" placeholder the pre-#213
	// implementation emitted — the picker cannot identify a row without a real name.
	it('moderator gets full reservation details, with the real name of a signed-in gifter', async () => {
		const reservationRows = [
			{
				id: RESERVATION_ID,
				giftId: GIFT_ID,
				quantity: 2,
				userId: VISITOR_ID,
				anonymousName: null,
				gifterName: 'Petr Svoboda',
				createdAt: new Date('2024-01-01'),
			},
			{
				id: 'reservation-2',
				giftId: GIFT_ID,
				quantity: 1,
				userId: null,
				anonymousName: 'Jan Novak',
				gifterName: null,
				createdAt: new Date('2024-01-02'),
			},
		];

		// getGiftWithWishlist
		const wishlistChain = createChain([makeActiveWishlistRow()]);
		// determineRole – moderator assignment found
		const modChain = createChain([{ id: 'mod-assignment-1' }]);
		// Fetch reservations list
		const reservationsChain = createChain(reservationRows);

		mockGetDb
			.mockReturnValueOnce(wishlistChain as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modChain as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(reservationsChain as unknown as ReturnType<typeof getDb>);

		const result = (await (getReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeModeratorUser),
			GIFT_ID,
		)) as { reservations: Record<string, unknown>[]; role: string };

		expect(result.role).toBe('moderator');
		expect(result.reservations).toHaveLength(2);
		expect(result.reservations[0]).toMatchObject({
			id: RESERVATION_ID,
			giftId: GIFT_ID,
			quantity: 2,
			displayName: 'Petr Svoboda',
		});
		expect(result.reservations[1]).toMatchObject({
			id: 'reservation-2',
			displayName: 'Jan Novak',
		});
	});
});

// ── getReservationsForGift: release ledger (issue #213) ───────────────────────

/**
 * REQ-4/REQ-5/REQ-6: the ledger is the picker's data source, so it must reach the app
 * administrator on any wishlist, mark per-row releasability (a správce may act on guest rows
 * only), stay empty for the obdarovaný, and leave the viewer's OWN reservation out — that one
 * is cancelled through the existing single-click path, not the release path.
 */
describe('getReservationsForGift — release ledger (issue #213)', () => {
	const signedInRow = {
		id: RESERVATION_ID,
		giftId: GIFT_ID,
		quantity: 2,
		userId: VISITOR_ID,
		anonymousName: null,
		gifterName: 'Petr Svoboda',
		createdAt: new Date('2024-01-01'),
	};
	const guestRow = {
		id: 'reservation-2',
		giftId: GIFT_ID,
		quantity: 1,
		userId: null,
		anonymousName: 'Babička',
		gifterName: null,
		createdAt: new Date('2024-01-02'),
	};

	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('an app administrator reads the ledger on a list they neither own nor moderate (REQ-5)', async () => {
		const wishlistChain = createChain([makeActiveWishlistRow()]);
		const modChain = createChain([]); // no moderator assignment → plain visitor role
		const reservationsChain = createChain([signedInRow, guestRow]);

		mockGetDb
			.mockReturnValueOnce(wishlistChain as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modChain as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(reservationsChain as unknown as ReturnType<typeof getDb>);

		const result = (await (getReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminUser),
			GIFT_ID,
		)) as { reservations: Record<string, unknown>[]; role: string };

		expect(result.role).toBe('visitor');
		expect(result.reservations).toEqual([
			expect.objectContaining({ id: RESERVATION_ID, releasable: true }),
			expect.objectContaining({ id: 'reservation-2', releasable: true }),
		]);
	});

	it("a správce sees a signed-in gifter's row but cannot release it (REQ-2)", async () => {
		const wishlistChain = createChain([makeActiveWishlistRow()]);
		const modChain = createChain([{ id: 'mod-assignment-1' }]);
		const reservationsChain = createChain([signedInRow, guestRow]);

		mockGetDb
			.mockReturnValueOnce(wishlistChain as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modChain as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(reservationsChain as unknown as ReturnType<typeof getDb>);

		const result = (await (getReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeModeratorUser),
			GIFT_ID,
		)) as { reservations: Record<string, unknown>[]; role: string };

		expect(result.reservations).toEqual([
			expect.objectContaining({ id: RESERVATION_ID, releasable: false }),
			expect.objectContaining({ id: 'reservation-2', releasable: true }),
		]);
	});

	it('the obdarovaný gets an empty ledger even when they are the app administrator (REQ-6)', async () => {
		// resolveWishlistRole short-circuits on the linked recipient – no further queries.
		const wishlistChain = createChain([makeActiveWishlistRow()]);
		mockGetDb.mockReturnValueOnce(wishlistChain as unknown as ReturnType<typeof getDb>);

		const result = (await (getReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeAdminRecipientUser),
			GIFT_ID,
		)) as { reservations: unknown[]; role: string };

		expect(result.reservations).toEqual([]);
		expect(result.role).toBe('recipient');
	});

	it("omits the viewer's own reservation from the ledger", async () => {
		const wishlistChain = createChain([makeActiveWishlistRow()]);
		const modChain = createChain([{ id: 'mod-assignment-1' }]);
		// The správce is themselves a gifter on this gift.
		const ownRow = {
			...guestRow,
			id: 'reservation-3',
			userId: MODERATOR_ID,
			gifterName: 'Mod',
		};
		const reservationsChain = createChain([signedInRow, ownRow]);

		mockGetDb
			.mockReturnValueOnce(wishlistChain as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modChain as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(reservationsChain as unknown as ReturnType<typeof getDb>);

		const result = (await (getReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeModeratorUser),
			GIFT_ID,
		)) as { reservations: Record<string, unknown>[]; role: string };

		expect(result.reservations.map((row) => row.id)).toEqual([RESERVATION_ID]);
	});
});

// ── getMyReservationsForGift ──────────────────────────────────────────────────

describe('getMyReservationsForGift', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('anonymous user gets empty array without hitting the DB', async () => {
		const result = await (getMyReservationsForGift as (...args: unknown[]) => unknown)(
			null,
			GIFT_ID,
		);

		expect(result).toEqual([]);
		expect(mockGetDb).not.toHaveBeenCalled();
	});

	it('authenticated user gets their own reservations', async () => {
		const ownReservations = [
			{ id: RESERVATION_ID, quantity: 2, createdAt: new Date('2024-01-01') },
		];
		const reservationsChain = createChain(ownReservations);
		mockGetDb.mockReturnValueOnce(reservationsChain as unknown as ReturnType<typeof getDb>);

		const result = await (getMyReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			GIFT_ID,
		);

		expect(result).toEqual(ownReservations);
	});

	it('authenticated user with no reservations gets empty array', async () => {
		const reservationsChain = createChain([]);
		mockGetDb.mockReturnValueOnce(reservationsChain as unknown as ReturnType<typeof getDb>);

		const result = await (getMyReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			GIFT_ID,
		);

		expect(result).toEqual([]);
	});
});

// ── Statement budgets (issue #108, REQ-7) ─────────────────────────────────────

describe('statement budgets (issue #108, REQ-7)', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('reserveGift (no likers/followers to notify) stays within 6 statements', async () => {
		// Call #1: `database` – tx queue: locked gift, count, insert; then likers +
		// followers pop empty defaults, so both notification dispatches early-return.
		const database = createMultiQueryChain(
			[{ quantity: 5 }],
			[{ totalQuantity: 0 }],
			[{ id: RESERVATION_ID }],
		);
		// Call #2: getGiftWithWishlist query
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await (reserveGift as (...args: unknown[]) => unknown)(makeAuthContext(fakeVisitorUser), {
			giftId: GIFT_ID,
			quantity: 1,
		});

		const chains = [database, wishlistDb] as unknown as Record<
			string,
			ReturnType<typeof vi.fn>
		>[];
		const statements = chains
			.flatMap((chain) =>
				['select', 'insert', 'update', 'delete'].map(
					(method) => chain[method]!.mock.calls.length,
				),
			)
			.reduce((sum, count) => sum + count, 0);

		// gift+wishlist lookup, locked gift, active count, insert, likers, followers —
		// the gift-list refresh rides back single-flight and email work is backgrounded.
		expect(statements).toBeLessThanOrEqual(6);
	});
});
