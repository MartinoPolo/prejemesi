import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

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
		links: 'gift.links',
		price: 'gift.price',
		currency: 'gift.currency',
		imageUrl: 'gift.imageUrl',
		imageKey: 'gift.imageKey',
		imageMeta: 'gift.imageMeta',
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
		userId: 'reservation.userId',
		quantity: 'reservation.quantity',
		deletedAt: 'reservation.deletedAt',
		createdAt: 'reservation.createdAt',
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
		status: 'wishlist.status',
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
	calls: { method: string; args: unknown[] }[];
	pushResult: (result: unknown[]) => void;
	reset: () => void;
}

function createMockDb(): MockDb {
	const results: unknown[][] = [];
	const calls: { method: string; args: unknown[] }[] = [];
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
				return vi.fn((...args: unknown[]) => {
					if (typeof prop === 'string') {
						calls.push({ method: prop, args });
					}
					return chain;
				});
			},
		},
	);

	return {
		db: chain,
		calls,
		pushResult: (result: unknown[]) => results.push(result),
		reset: () => {
			results.length = 0;
			calls.length = 0;
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
	reorderGifts,
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
		status: 'draft',
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
		links: [],
		price: null,
		currency: 'CZK',
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
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
type ReorderGiftsHandler = (
	authContext: { user: { id: string } },
	items: { id: string; sortOrder: number }[],
) => Promise<void>;

type MarkReceivedHandler = (
	authContext: { user: { id: string } },
	input: { giftId: string; received: boolean },
) => Promise<unknown>;

const callGetGifts = getGiftsByWishlistShortId as unknown as GetGiftsHandler;
const callCreateGift = createGift as unknown as CreateGiftHandler;
const callUpdateGift = updateGift as unknown as UpdateGiftHandler;
const callDeleteGift = deleteGift as unknown as DeleteGiftHandler;
const callReorderGifts = reorderGifts as unknown as ReorderGiftsHandler;
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

		it('sets myReservationId to the current user active reservation for that gift', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			mockDbInstance.pushResult([{ giftId: GIFT_ID, totalQuantity: 1 }]); // reservation counts
			mockDbInstance.pushResult([]); // like counts
			// my active reservations for these gifts
			mockDbInstance.pushResult([{ id: 'res-mine', giftId: GIFT_ID }]);

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.myReservationId).toBe('res-mine');
		});

		it('sets myReservationId to null when the current user has no reservation', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ id: GIFT_ID, quantity: 1 })]);
			mockDbInstance.pushResult([]); // reservation counts
			mockDbInstance.pushResult([]); // like counts
			mockDbInstance.pushResult([]); // my reservations: none

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.myReservationId).toBeNull();
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
				message: 'WISHLIST_NOT_FOUND',
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

	describe('image metadata is returned to all roles without leaking reservations', () => {
		const imageMeta = {
			fitMode: 'cover-crop',
			cropRect: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
			focal: { x: 50, y: 40 },
			zoom: 1.5,
			bgColor: null,
		};

		it('owner (no self-promote) receives imageKey + imageMeta but no reservation data', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ ownerIsModerator: false })]);
			mockDbInstance.pushResult([makeGiftRow({ imageKey: 'gifts/cam.jpg', imageMeta })]);

			const result = await callGetGifts(makeOwnerAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForOwner & Partial<GiftForVisitor>;
			expect(gift.imageKey).toBe('gifts/cam.jpg');
			expect(gift.imageMeta).toEqual(imageMeta);
			expect('reservedCount' in gift).toBe(false);
			expect('likeCount' in gift).toBe(false);
		});

		it('visitor receives imageKey + imageMeta alongside reservation counts', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ imageKey: 'gifts/cam.jpg', imageMeta })]);
			mockDbInstance.pushResult([]); // reservation counts
			mockDbInstance.pushResult([]); // like counts

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.imageKey).toBe('gifts/cam.jpg');
			expect(gift.imageMeta).toEqual(imageMeta);
			expect(gift.reservedCount).toBe(0);
		});
	});

	describe('gift links are returned to all roles', () => {
		const links = [
			{ url: 'https://www.alza.cz/playstation-5' },
			{ url: 'https://www.datart.cz/playstation-5', label: 'Datart' },
		];

		it('owner (no self-promote) receives the full links array', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ ownerIsModerator: false })]);
			mockDbInstance.pushResult([makeGiftRow({ links })]);

			const result = await callGetGifts(makeOwnerAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForOwner;
			expect(gift.links).toEqual(links);
		});

		it('visitor receives the full links array alongside reservation counts', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([]); // not a moderator
			mockDbInstance.pushResult([makeGiftRow({ links })]);
			mockDbInstance.pushResult([]); // reservation counts
			mockDbInstance.pushResult([]); // like counts

			const result = await callGetGifts(makeVisitorAuthContext(), WISHLIST_SHORT_ID);

			const gift = result.gifts[0] as GiftForVisitor;
			expect(gift.links).toEqual(links);
			expect(gift.reservedCount).toBe(0);
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

		it('persists image metadata on create', async () => {
			const imageMeta = {
				fitMode: 'cover-crop',
				focal: { x: 60, y: 40 },
				zoom: 1.5,
			};
			const inputWithMeta = { ...createInput, imageKey: 'gifts/x.jpg', imageMeta };
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([{ maxSort: 0 }]);
			mockDbInstance.pushResult([{ id: 'new-gift-id', ...inputWithMeta, sortOrder: 1 }]);

			const result = await callCreateGift(makeOwnerAuthContext(), inputWithMeta);

			expect(result).toMatchObject({ id: 'new-gift-id', imageMeta });
		});

		it('drops links whose URL is not http or https when storing', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([{ maxSort: 0 }]);
			mockDbInstance.pushResult([{ id: 'new-gift-id', ...createInput, sortOrder: 1 }]);

			await callCreateGift(makeOwnerAuthContext(), {
				...createInput,
				links: [
					{ url: ' javascript://example.com/%0Aalert(1)' },
					{ url: 'https://example.com/ok' },
				],
			});

			const giftInsertValues = mockDbInstance.calls
				.filter((call) => call.method === 'values')
				.at(0)?.args[0] as { links: { url: string; label?: string }[] };
			expect(giftInsertValues.links).toEqual([{ url: 'https://example.com/ok' }]);
		});

		it('stores up to 10 links and drops the rest, preserving order and labels', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([{ maxSort: 0 }]);
			mockDbInstance.pushResult([{ id: 'new-gift-id', ...createInput, sortOrder: 1 }]);

			const inputLinks = Array.from({ length: 12 }, (_, i) => ({
				url: `https://example.com/${i}`,
				label: `Shop ${i}`,
			}));

			await callCreateGift(makeOwnerAuthContext(), { ...createInput, links: inputLinks });

			const giftInsertValues = mockDbInstance.calls
				.filter((call) => call.method === 'values')
				.at(0)?.args[0] as { links: { url: string; label?: string }[] };
			expect(giftInsertValues.links).toHaveLength(10);
			expect(giftInsertValues.links[0]).toEqual({
				url: 'https://example.com/0',
				label: 'Shop 0',
			});
			expect(giftInsertValues.links[9]).toEqual({
				url: 'https://example.com/9',
				label: 'Shop 9',
			});
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

	describe('archived wishlist', () => {
		it('rejects creating gifts on archived wishlists', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(callCreateGift(makeOwnerAuthContext(), createInput)).rejects.toMatchObject(
				{
					status: 400,
					message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
				},
			);
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

		it('persists updated image metadata', async () => {
			const imageMeta = { fitMode: 'contain-padded', bgColor: '#222222' };
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([{ id: GIFT_ID, imageMeta }]);

			const result = await callUpdateGift(makeOwnerAuthContext(), {
				id: GIFT_ID,
				imageMeta,
			});

			expect(result).toMatchObject({ id: GIFT_ID, imageMeta });
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

		it('normalizes updated gift links before persisting', async () => {
			mockDbInstance.pushResult([makeGiftRow({ createdAt: AFTER_SHARING })]);
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([
				{ id: GIFT_ID, links: [{ url: 'https://example.com/path' }] },
			]);

			await callUpdateGift(makeOwnerAuthContext(), {
				id: GIFT_ID,
				links: [{ url: ' https://example.com/path ' }],
			});

			const updateSetValues = mockDbInstance.calls
				.filter((call) => call.method === 'set')
				.at(0)?.args[0] as { links: { url: string; label?: string }[] };
			expect(updateSetValues.links).toEqual([{ url: 'https://example.com/path' }]);
		});

		it('rejects updates on archived wishlists', async () => {
			mockDbInstance.pushResult([makeGiftRow()]);
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(callUpdateGift(makeOwnerAuthContext(), updateInput)).rejects.toMatchObject(
				{
					status: 400,
					message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
				},
			);
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
					message: 'CANNOT_EDIT_AFTER_SHARING',
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
				message: 'CANNOT_DELETE_AFTER_SHARING',
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
				message: 'CANNOT_DELETE_RESERVED_GIFT',
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
				message: 'GIFT_NOT_FOUND',
			});
		});
	});

	describe('archived wishlist', () => {
		it('rejects deleting gifts from archived wishlists', async () => {
			mockDbInstance.pushResult([makeGiftRow()]);
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(callDeleteGift(makeOwnerAuthContext(), GIFT_ID)).rejects.toMatchObject({
				status: 400,
				message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
			});
		});
	});
});

describe('reorderGifts', () => {
	it('rejects cross-wishlist reorder items', async () => {
		mockDbInstance.pushResult([{ wishlistId: WISHLIST_ID }]);
		mockDbInstance.pushResult([makeWishlistRow()]);
		mockDbInstance.pushResult([
			{ id: GIFT_ID, wishlistId: WISHLIST_ID },
			{ id: 'gift-from-other-wishlist', wishlistId: 'other-wishlist' },
		]);

		await expect(
			callReorderGifts(makeOwnerAuthContext(), [
				{ id: GIFT_ID, sortOrder: 0 },
				{ id: 'gift-from-other-wishlist', sortOrder: 1 },
			]),
		).rejects.toMatchObject({
			status: 403,
			message: SERVER_ERROR.GIFT_WISHLIST_MISMATCH,
		});
	});

	it('rejects reorders on archived wishlists', async () => {
		mockDbInstance.pushResult([{ wishlistId: WISHLIST_ID }]);
		mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

		await expect(
			callReorderGifts(makeOwnerAuthContext(), [{ id: GIFT_ID, sortOrder: 0 }]),
		).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
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
				message: 'ONLY_OWNER_CAN_MARK_RECEIVED',
			});
		});
	});

	describe('archived wishlist', () => {
		it('rejects marking gifts as received on archived wishlists', async () => {
			mockDbInstance.pushResult([makeGiftRow()]);
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(callMarkReceived(makeOwnerAuthContext(), markInput)).rejects.toMatchObject(
				{
					status: 400,
					message: SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
				},
			);
		});
	});
});
