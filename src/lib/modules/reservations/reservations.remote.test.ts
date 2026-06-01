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
	publicCommand: vi.fn((handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('command', handler),
	),
	publicQuery: vi.fn((handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('query', handler),
	),
	guardedCommand: vi.fn((handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('command', handler),
	),
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) =>
		makeRemoteWrapper('query', handler),
	),
}));

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(),
}));

// Drizzle ORM helpers are used only as column references in query builders.
// We don't need their real implementations — stub them so the module loads.
vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
	and: vi.fn(),
	isNull: vi.fn(),
	sql: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { getDb } from '$lib/server/db/index.js';
import {
	reserveGift,
	unreserveGift,
	getReservationsForGift,
	getMyReservationsForGift,
} from './reservations.remote.js';
import type { ReserveGiftInput, UnreserveInput } from './types.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

const mockGetDb = vi.mocked(getDb);

const OWNER_ID = 'user-owner';
const VISITOR_ID = 'user-visitor';
const MODERATOR_ID = 'user-moderator';
const GIFT_ID = 'gift-1';
const WISHLIST_ID = 'wishlist-1';
const RESERVATION_ID = 'reservation-1';

const fakeOwnerUser = { id: OWNER_ID, email: 'owner@example.com' } as unknown as User;
const fakeVisitorUser = { id: VISITOR_ID, email: 'visitor@example.com' } as unknown as User;
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
		'insert',
		'values',
		'update',
		'set',
		'delete',
	] as const;

	for (const method of chainMethods) {
		chain[method] = vi.fn(() => chain);
	}

	// .returning() terminates insert chains — pops from queue
	chain['returning'] = vi.fn(() => Promise.resolve(queue.shift() ?? []));

	// Make the chain awaitable — each top-level await pops from queue
	// oxlint-ignore-next-line no-thenable -- intentional: mock must be thenable to simulate Drizzle's await behavior
	chain['then'] = (resolve: (value: unknown) => unknown) => resolve(queue.shift() ?? []);

	return chain;
}

/** Shorthand: single-result chain (the common case). */
function createChain(returnValue: unknown[] = []) {
	return createMultiQueryChain(returnValue);
}

/** Fake wishlist row for an active (non-archived) wishlist owned by OWNER_ID. */
function makeActiveWishlistRow() {
	return {
		gift: {
			id: GIFT_ID,
			wishlistId: WISHLIST_ID,
			quantity: 5,
			deletedAt: null,
		},
		wishlist: {
			id: WISHLIST_ID,
			ownerId: OWNER_ID,
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
	});

	// In reserveGift, getDb() is called once at line 88 and stored as `database`.
	// That same `database` reference is later used for the INSERT (.returning()).
	// getGiftWithWishlist and getActiveReservedCount each make their own getDb() calls.
	// So mock order: call #1 = insertDb (reused), call #2 = wishlistDb, call #3 = countDb.

	it('authenticated visitor can reserve a gift — returns { id }', async () => {
		// Call #1: stored as `database`, used later for INSERT — needs returning() result
		const insertDb = createMultiQueryChain([{ id: RESERVATION_ID }]);
		// Call #2: getGiftWithWishlist query
		const wishlistDb = createChain([makeActiveWishlistRow()]);
		// Call #3: getActiveReservedCount query
		const countDb = createChain([{ totalQuantity: 0 }]);

		mockGetDb
			.mockReturnValueOnce(insertDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(countDb as unknown as ReturnType<typeof getDb>);

		const result = await (reserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeVisitorUser),
			validInput,
		);

		expect(result).toEqual({ id: RESERVATION_ID });
	});

	it('owner cannot reserve their own gift — throws 403', async () => {
		// Call #1: insertDb (never used — throws before insert)
		const insertDb = createChain([]);
		// Call #2: wishlist lookup
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(insertDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeOwnerUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403 });
	});

	it('cannot reserve on an archived wishlist — throws 400', async () => {
		const archivedRow = {
			...makeActiveWishlistRow(),
			wishlist: { ...makeActiveWishlistRow().wishlist, status: 'archived' },
		};
		const insertDb = createChain([]);
		const wishlistDb = createChain([archivedRow]);

		mockGetDb
			.mockReturnValueOnce(insertDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeVisitorUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 400 });
	});

	it('anonymous user without a name — throws 400', async () => {
		const insertDb = createChain([]);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(insertDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(null, {
				...validInput,
				anonymousName: '',
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('anonymous user with only whitespace name — throws 400', async () => {
		const insertDb = createChain([]);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(insertDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(null, {
				...validInput,
				anonymousName: '   ',
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('quantity less than 1 — throws 400', async () => {
		const insertDb = createChain([]);
		const wishlistDb = createChain([makeActiveWishlistRow()]);

		mockGetDb
			.mockReturnValueOnce(insertDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(makeAuthContext(fakeVisitorUser), {
				...validInput,
				quantity: 0,
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('over-reservation rejected — throws 400', async () => {
		// Gift has quantity 5, all 5 already reserved — available = 0
		const insertDb = createChain([]);
		const wishlistDb = createChain([makeActiveWishlistRow()]);
		const countDb = createChain([{ totalQuantity: 5 }]);

		mockGetDb
			.mockReturnValueOnce(insertDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(countDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(reserveGift as (...args: unknown[]) => unknown)(makeAuthContext(fakeVisitorUser), {
				...validInput,
				quantity: 1,
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it('anonymous user with valid name can reserve — returns { id }', async () => {
		const insertDb = createMultiQueryChain([{ id: RESERVATION_ID }]);
		const wishlistDb = createChain([makeActiveWishlistRow()]);
		const countDb = createChain([{ totalQuantity: 0 }]);

		mockGetDb
			.mockReturnValueOnce(insertDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(wishlistDb as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(countDb as unknown as ReturnType<typeof getDb>);

		const result = await (reserveGift as (...args: unknown[]) => unknown)(null, {
			...validInput,
			anonymousName: 'Jan Novak',
		});

		expect(result).toEqual({ id: RESERVATION_ID });
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
	//   - gift wishlistId SELECT (query 2 on database, only for anonymous reservations)
	//   - soft-delete UPDATE (query 3 on database)
	// determineRole makes its own separate getDb() call (call #2) for the mod check.

	it('authenticated user can unreserve their own reservation — returns { success: true }', async () => {
		// Call #1: `database` — used for reservation SELECT then UPDATE
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

	it('authenticated user cannot unreserve someone else reservation — throws 403', async () => {
		// Reservation belongs to a different user — throws before any further queries
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

	it('anonymous user cannot unreserve — throws 403', async () => {
		// Anonymous reservation (userId is null) — throws because authContext is null
		const database = createChain([
			{ id: RESERVATION_ID, giftId: GIFT_ID, userId: null, deletedAt: null },
		]);

		mockGetDb.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(null, validInput),
		).rejects.toMatchObject({
			status: 403,
		});
	});

	it('moderator can unreserve an anonymous reservation — returns { success: true }', async () => {
		// Call #1: `database` — reservation SELECT, gift SELECT, then UPDATE
		const database = createMultiQueryChain(
			[{ id: RESERVATION_ID, giftId: GIFT_ID, userId: null, deletedAt: null }], // reservation
			[{ wishlistId: WISHLIST_ID }], // gift wishlistId lookup
			[], // update (unused)
		);
		// Call #2: determineRole's own getDb() — moderator assignment found
		const modDb = createChain([{ id: 'mod-assignment-1' }]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		const result = await (unreserveGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeModeratorUser),
			validInput,
		);

		expect(result).toEqual({ success: true });
	});

	it('non-moderator authenticated user cannot unreserve an anonymous reservation — throws 403', async () => {
		// Call #1: `database` — reservation SELECT, gift SELECT
		const database = createMultiQueryChain(
			[{ id: RESERVATION_ID, giftId: GIFT_ID, userId: null, deletedAt: null }], // reservation
			[{ wishlistId: WISHLIST_ID }], // gift wishlistId lookup
		);
		// Call #2: determineRole's own getDb() — no moderator assignment
		const modDb = createChain([]);

		mockGetDb
			.mockReturnValueOnce(database as unknown as ReturnType<typeof getDb>)
			.mockReturnValueOnce(modDb as unknown as ReturnType<typeof getDb>);

		await expect(
			(unreserveGift as (...args: unknown[]) => unknown)(
				makeAuthContext(fakeVisitorUser),
				validInput,
			),
		).rejects.toMatchObject({ status: 403 });
	});
});

// ── getReservationsForGift ────────────────────────────────────────────────────

describe('getReservationsForGift', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('owner gets empty reservations array — core privacy invariant', async () => {
		// getGiftWithWishlist
		const wishlistChain = createChain([makeActiveWishlistRow()]);
		// determineRole: userId === ownerId → short-circuits, no DB call needed
		mockGetDb.mockReturnValueOnce(wishlistChain as unknown as ReturnType<typeof getDb>);

		const result = (await (getReservationsForGift as (...args: unknown[]) => unknown)(
			makeAuthContext(fakeOwnerUser),
			GIFT_ID,
		)) as { reservations: unknown[]; role: string };

		expect(result.reservations).toEqual([]);
		expect(result.role).toBe('owner');
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

	it('moderator gets full reservation details', async () => {
		const reservationRows = [
			{
				id: RESERVATION_ID,
				giftId: GIFT_ID,
				quantity: 2,
				anonymousName: null,
				createdAt: new Date('2024-01-01'),
			},
			{
				id: 'reservation-2',
				giftId: GIFT_ID,
				quantity: 1,
				anonymousName: 'Jan Novak',
				createdAt: new Date('2024-01-02'),
			},
		];

		// getGiftWithWishlist
		const wishlistChain = createChain([makeActiveWishlistRow()]);
		// determineRole — moderator assignment found
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
			displayName: 'Authenticated user',
		});
		expect(result.reservations[1]).toMatchObject({
			id: 'reservation-2',
			displayName: 'Jan Novak',
		});
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
