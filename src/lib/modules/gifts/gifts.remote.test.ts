import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Suppress SvelteKit's remote-function validator injected by the Vite transform
vi.mock('@sveltejs/kit/internal', () => ({
	init_remote_functions: vi.fn(),
}));

// ── Mock $app/server to prevent SvelteKit remote-function validation ─────────
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

// ── Mock remote wrappers — extract handlers directly ────────────────────────
// The Vite transform injects `fn.__.id = ...` for every export after calling
// init_remote_functions, so each returned handler must carry a `__` object.
function wrapWithRemoteMarker(
	handler: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	(handler as unknown as Record<string, unknown>).__ = {};
	return handler;
}

vi.mock('$lib/server/remote.js', () => ({
	publicQuery: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	publicCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	guardedQueryWithArgs: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
}));

// ── Mock SvelteKit error so it throws with a .status property ───────────────
vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

// ── Mock drizzle-orm — used only as where-clause builders; no-ops are fine ──
// `sql` is a tagged template literal whose return value needs `.as()`.
vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => args),
	and: vi.fn((...args: unknown[]) => args),
	isNull: vi.fn((arg: unknown) => arg),
	inArray: vi.fn((...args: unknown[]) => args),
	sql: vi.fn(() => ({ as: vi.fn(() => ({})) })),
	count: vi.fn(),
}));

// ── Mock schema imports — column references used in queries ─────────────────
vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: {
		id: 'gift.id',
		wishlistId: 'gift.wishlistId',
		name: 'gift.name',
		description: 'gift.description',
		url: 'gift.url',
		price: 'gift.price',
		currency: 'gift.currency',
		imageUrl: 'gift.imageUrl',
		imageKey: 'gift.imageKey',
		quantity: 'gift.quantity',
		sortOrder: 'gift.sortOrder',
		received: 'gift.received',
		createdAt: 'gift.createdAt',
		deletedAt: 'gift.deletedAt',
		priorityLevelId: 'gift.priorityLevelId',
	},
	reservation: {
		id: 'reservation.id',
		giftId: 'reservation.giftId',
		quantity: 'reservation.quantity',
		deletedAt: 'reservation.deletedAt',
	},
	giftLike: {
		id: 'giftLike.id',
		giftId: 'giftLike.giftId',
		deletedAt: 'giftLike.deletedAt',
	},
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'wishlist.id',
		shortId: 'wishlist.shortId',
		ownerId: 'wishlist.ownerId',
		ownerIsModerator: 'wishlist.ownerIsModerator',
		sharedAt: 'wishlist.sharedAt',
		deletedAt: 'wishlist.deletedAt',
	},
	priorityLevel: {
		id: 'priorityLevel.id',
		wishlistId: 'priorityLevel.wishlistId',
		label: 'priorityLevel.label',
		sortOrder: 'priorityLevel.sortOrder',
	},
}));

vi.mock('$lib/server/db/moderator.schema.js', () => ({
	moderatorAssignment: {
		id: 'moderatorAssignment.id',
		wishlistId: 'moderatorAssignment.wishlistId',
		userId: 'moderatorAssignment.userId',
		deletedAt: 'moderatorAssignment.deletedAt',
	},
}));

// ── DB mock helper ───────────────────────────────────────────────────────────

interface MockDb {
	db: unknown;
	pushResult: (result: unknown[]) => void;
	reset: () => void;
}

function createMockDb(): MockDb {
	const results: unknown[][] = [];
	const indexRef = { value: 0 };

	const chain: Record<string | symbol, unknown> = new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'then') {
					const result = results[indexRef.value] ?? [];
					indexRef.value++;
					return (resolve: (value: unknown[]) => unknown) => resolve(result);
				}
				return vi.fn(() => chain);
			},
		},
	);

	return {
		db: chain,
		pushResult: (result: unknown[]) => results.push(result),
		reset: () => {
			results.length = 0;
			indexRef.value = 0;
		},
	};
}

// ── Mock getDb ───────────────────────────────────────────────────────────────

const mockDbInstance = createMockDb();

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(() => mockDbInstance.db),
}));

// ── Import the module under test (after all mocks are set up) ────────────────

import {
	getGiftsByWishlistShortId,
	createGift,
	updateGift,
	deleteGift,
	markGiftReceived,
} from './gifts.remote.js';
import type { GiftForOwner, GiftForVisitor } from './types.js';

// ── Test data factories ───────────────────────────────────────────────────────

const OWNER_ID = 'user-owner';
const VISITOR_ID = 'user-visitor';
const MODERATOR_ID = 'user-moderator';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc12345';
const GIFT_ID = 'gift-1';

const SHARED_AT = new Date('2024-01-10T00:00:00Z');
const BEFORE_SHARING = new Date('2024-01-05T00:00:00Z');
const AFTER_SHARING = new Date('2024-01-15T00:00:00Z');

function makeWishlistRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: WISHLIST_ID,
		shortId: WISHLIST_SHORT_ID,
		ownerId: OWNER_ID,
		ownerIsModerator: false,
		sharedAt: null,
		deletedAt: null,
		title: 'Test Wishlist',
		...overrides,
	};
}

function makeGiftRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: GIFT_ID,
		wishlistId: WISHLIST_ID,
		name: 'Test Gift',
		description: null,
		url: null,
		price: null,
		currency: 'CZK',
		imageUrl: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: AFTER_SHARING,
		deletedAt: null,
		priorityLabel: null,
		prioritySortOrder: null,
		...overrides,
	};
}

function makeOwnerAuthContext(): { user: { id: string } } {
	return { user: { id: OWNER_ID } };
}

function makeVisitorAuthContext(): { user: { id: string } } {
	return { user: { id: VISITOR_ID } };
}

function makeModeratorAuthContext(): { user: { id: string } } {
	return { user: { id: MODERATOR_ID } };
}

// ── Typed handler aliases ─────────────────────────────────────────────────────

type GetGiftsHandler = (
	authContext: { user: { id: string } } | null,
	shortId: string,
) => Promise<{ role: string; gifts: unknown[] }>;

type CreateGiftHandler = (
	authContext: { user: { id: string } },
	input: Record<string, unknown>,
) => Promise<unknown>;

type UpdateGiftHandler = (
	authContext: { user: { id: string } },
	input: Record<string, unknown>,
) => Promise<unknown>;

type DeleteGiftHandler = (authContext: { user: { id: string } }, giftId: string) => Promise<void>;

type MarkReceivedHandler = (
	authContext: { user: { id: string } },
	input: { giftId: string; received: boolean },
) => Promise<unknown>;

const callGetGifts = getGiftsByWishlistShortId as unknown as GetGiftsHandler;
const callCreateGift = createGift as unknown as CreateGiftHandler;
const callUpdateGift = updateGift as unknown as UpdateGiftHandler;
const callDeleteGift = deleteGift as unknown as DeleteGiftHandler;
const callMarkReceived = markGiftReceived as unknown as MarkReceivedHandler;

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

describe('getGiftsByWishlistShortId', () => {
	describe('owner without moderator role gets GiftForOwner without reservation/like data', () => {
		it('returns role=owner and gifts without reservedCount/likeCount/isFullyReserved', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow({ ownerIsModerator: false })]);
			// DB call 2: gift rows
			mockDbInstance.pushResult([makeGiftRow()]);

			const result = await callGetGifts(makeOwnerAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('owner');
			expect(result.gifts).toHaveLength(1);

			const gift = result.gifts[0] as GiftForOwner & Partial<GiftForVisitor>;
			expect(gift.id).toBe(GIFT_ID);
			expect(gift.name).toBe('Test Gift');
			// Critical invariant: no reservation/like fields present
			expect('reservedCount' in gift).toBe(false);
			expect('likeCount' in gift).toBe(false);
			expect('isFullyReserved' in gift).toBe(false);
		});
	});

	describe('owner with ownerIsModerator=true gets GiftForVisitor with reservation/like counts', () => {
		it('returns role=owner and gifts with reservedCount, likeCount, isFullyReserved', async () => {
			// DB call 1: wishlist lookup (ownerIsModerator=true)
			mockDbInstance.pushResult([makeWishlistRow({ ownerIsModerator: true })]);
			// DB call 2: gift rows
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 3 })]);
			// DB call 3: reservation counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, totalQuantity: 2 }]);
			// DB call 4: like counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, count: 5 }]);

			const result = await callGetGifts(makeOwnerAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('owner');
			expect(result.gifts).toHaveLength(1);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(2);
			expect(gift.likeCount).toBe(5);
			expect(gift.isFullyReserved).toBe(false); // 2 reserved out of 3
		});
	});

	describe('visitor gets GiftForVisitor with reservation counts and like counts', () => {
		it('returns role=visitor with reservedCount, likeCount, isFullyReserved=true when fully reserved', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: moderator check (not a moderator)
			mockDbInstance.pushResult([]);
			// DB call 3: gift rows
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 2 })]);
			// DB call 4: reservation counts (fully reserved)
			mockDbInstance.pushResult([{ giftId: GIFT_ID, totalQuantity: 2 }]);
			// DB call 5: like counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, count: 3 }]);

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('visitor');
			expect(result.gifts).toHaveLength(1);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(2);
			expect(gift.likeCount).toBe(3);
			expect(gift.isFullyReserved).toBe(true);
		});

		it('sets reservedCount=0 and likeCount=0 when no reservations or likes exist', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]);
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			// No reservation counts returned
			mockDbInstance.pushResult([]);
			// No like counts returned
			mockDbInstance.pushResult([]);

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(0);
			expect(gift.likeCount).toBe(0);
			expect(gift.isFullyReserved).toBe(false);
		});
	});

	describe('moderator gets GiftForVisitor with reservation and like counts', () => {
		it('returns role=moderator and full gift data', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: moderator check (is a moderator)
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			// DB call 3: gift rows
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 5 })]);
			// DB call 4: reservation counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, totalQuantity: 1 }]);
			// DB call 5: like counts
			mockDbInstance.pushResult([{ giftId: GIFT_ID, count: 10 }]);

			const result = await callGetGifts(makeModeratorAuthContext(), WISHLIST_SHORT_ID);

			expect(result.role).toBe('moderator');
			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.reservedCount).toBe(1);
			expect(gift.likeCount).toBe(10);
			expect(gift.isFullyReserved).toBe(false);
		});
	});

	describe('wishlist not found', () => {
		it('throws 404 when wishlist does not exist', async () => {
			mockDbInstance.pushResult([]);

			await expect(callGetGifts(null, 'nonexistent')).rejects.toMatchObject({
				status: 404,
				message: 'Wishlist not found',
			});
		});
	});

	describe('unauthenticated visitor', () => {
		it('returns role=visitor with reservation data when not logged in', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: gift rows (no moderator check since authContext is null)
			mockDbInstance.pushResult([makeGiftRow()]);
			// DB call 3: reservation counts
			mockDbInstance.pushResult([]);
			// DB call 4: like counts
			mockDbInstance.pushResult([]);

			const result = await callGetGifts(null, WISHLIST_SHORT_ID);

			expect(result.role).toBe('visitor');
			const gift = result.gifts[0] as GiftForVisitor;
			expect('reservedCount' in gift).toBe(true);
		});
	});
});

describe('createGift', () => {
	const createInput = {
		wishlistId: WISHLIST_ID,
		name: 'New Gift',
	};

	describe('owner can create a gift', () => {
		it('returns the created gift row', async () => {
			// verifyOwnerOrModerator: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// maxSortOrder query
			mockDbInstance.pushResult([{ maxSort: 0 }]);
			// insert returning
			mockDbInstance.pushResult([{ id: 'new-gift-id', ...createInput, sortOrder: 1 }]);

			const result = await callCreateGift(makeOwnerAuthContext(), createInput);

			expect(result).toMatchObject({ id: 'new-gift-id', name: 'New Gift' });
		});
	});

	describe('moderator can create a gift', () => {
		it('returns the created gift row', async () => {
			// verifyOwnerOrModerator: wishlist lookup (moderator user, not owner)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// verifyOwnerOrModerator: moderator check
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			// maxSortOrder query
			mockDbInstance.pushResult([{ maxSort: 2 }]);
			// insert returning
			mockDbInstance.pushResult([{ id: 'new-gift-id', ...createInput, sortOrder: 3 }]);

			const result = await callCreateGift(makeModeratorAuthContext(), createInput);

			expect(result).toMatchObject({ id: 'new-gift-id' });
		});
	});

	describe('unauthorized user gets 403', () => {
		it('throws 403 when user is neither owner nor moderator', async () => {
			// verifyOwnerOrModerator: wishlist lookup (different owner)
			mockDbInstance.pushResult([makeWishlistRow({ ownerId: 'someone-else' })]);
			// moderator check returns empty
			mockDbInstance.pushResult([]);

			await expect(
				callCreateGift(makeVisitorAuthContext(), createInput),
			).rejects.toMatchObject({
				status: 403,
			});
		});
	});
});

describe('updateGift', () => {
	const updateInput = { id: GIFT_ID, name: 'Updated Name' };

	describe('owner can update gifts created after sharing (or unshared)', () => {
		it('returns updated gift when wishlist is not yet shared', async () => {
			// gift lookup
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			// verifyOwnerOrModerator: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Updated Name' }]);

			const result = await callUpdateGift(makeOwnerAuthContext(), updateInput);

			expect(result).toMatchObject({ id: GIFT_ID, name: 'Updated Name' });
		});

		it('owner can update gifts created after sharing date', async () => {
			// gift lookup — created AFTER sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			// verifyOwnerOrModerator: wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Updated Name' }]);

			const result = await callUpdateGift(makeOwnerAuthContext(), updateInput);

			expect(result).toMatchObject({ id: GIFT_ID });
		});
	});

	describe('owner CANNOT update gifts created before sharing (edit lock)', () => {
		it('throws 403 when gift was created before wishlist was shared', async () => {
			// gift lookup — created BEFORE sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING })]);
			// verifyOwnerOrModerator: wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);

			await expect(callUpdateGift(makeOwnerAuthContext(), updateInput)).rejects.toMatchObject(
				{
					status: 403,
					message: expect.stringContaining('Cannot edit existing gifts'),
				},
			);
		});
	});

	describe('moderator can always update', () => {
		it('moderator bypasses the edit lock and updates the gift', async () => {
			// gift lookup — created BEFORE sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING })]);
			// verifyOwnerOrModerator: wishlist lookup (shared, moderator user)
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: SHARED_AT, ownerId: 'someone-else' }),
			]);
			// moderator check
			mockDbInstance.pushResult([{ id: 'mod-assignment-1' }]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, name: 'Updated Name' }]);

			const result = await callUpdateGift(makeModeratorAuthContext(), updateInput);

			expect(result).toMatchObject({ id: GIFT_ID });
		});
	});
});

describe('deleteGift', () => {
	describe('owner can delete unreserved gifts created after sharing', () => {
		it('soft-deletes a gift with no reservations', async () => {
			// gift lookup — created AFTER sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			// verifyOwnerOrModerator: wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			// reservation check — no reservations
			mockDbInstance.pushResult([]);
			// soft-delete update (returns nothing meaningful)
			mockDbInstance.pushResult([]);

			await expect(callDeleteGift(makeOwnerAuthContext(), GIFT_ID)).resolves.not.toThrow();
		});
	});

	describe('owner CANNOT delete gifts created before sharing (edit lock)', () => {
		it('throws 403 when gift was created before wishlist was shared', async () => {
			// gift lookup — created BEFORE sharing
			mockDbInstance.pushResult([makeGiftRow({ createdAt: BEFORE_SHARING })]);
			// verifyOwnerOrModerator: wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);

			await expect(callDeleteGift(makeOwnerAuthContext(), GIFT_ID)).rejects.toMatchObject({
				status: 403,
				message: expect.stringContaining('Cannot delete existing gifts'),
			});
		});
	});

	describe('cannot delete reserved gifts', () => {
		it('throws 400 when gift has active reservations', async () => {
			// gift lookup — created AFTER sharing (so edit lock does not trigger)
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			// verifyOwnerOrModerator: wishlist lookup (shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: SHARED_AT })]);
			// reservation check — has a reservation
			mockDbInstance.pushResult([{ id: 'reservation-1' }]);

			await expect(callDeleteGift(makeOwnerAuthContext(), GIFT_ID)).rejects.toMatchObject({
				status: 400,
				message: expect.stringContaining('Cannot delete a reserved gift'),
			});
		});
	});

	describe('returns 404 for non-existent gift', () => {
		it('throws 404 when gift does not exist', async () => {
			// gift lookup — empty
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteGift(makeOwnerAuthContext(), 'ghost-gift'),
			).rejects.toMatchObject({
				status: 404,
				message: 'Gift not found',
			});
		});
	});
});

describe('markGiftReceived', () => {
	const markInput = { giftId: GIFT_ID, received: true };

	describe('owner can mark as received', () => {
		it('returns updated gift with received=true', async () => {
			// gift lookup
			mockDbInstance.pushResult([makeGiftRow()]);
			// wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// update returning
			mockDbInstance.pushResult([{ id: GIFT_ID, received: true }]);

			const result = await callMarkReceived(makeOwnerAuthContext(), markInput);

			expect(result).toMatchObject({ id: GIFT_ID, received: true });
		});
	});

	describe('non-owner gets 403', () => {
		it('throws 403 when caller is not the wishlist owner', async () => {
			// gift lookup
			mockDbInstance.pushResult([makeGiftRow()]);
			// wishlist lookup (owned by OWNER_ID, caller is VISITOR_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);

			await expect(
				callMarkReceived(makeVisitorAuthContext(), markInput),
			).rejects.toMatchObject({
				status: 403,
				message: expect.stringContaining('Only the owner'),
			});
		});
	});
});
