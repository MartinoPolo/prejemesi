import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
const assertWishlistBannerAssignment = vi.fn(
	async (userId: string, objectKey: string, token: string | undefined) => {
		if (token !== `proof:${userId}:${objectKey}`) {
			throw new Error('ACCESS_DENIED');
		}
	},
);
vi.mock('./wishlist_image_assignment.js', () => ({ assertWishlistBannerAssignment }));

async function bannerAssignmentToken(objectKey: string, userId = RECIPIENT_ID) {
	return `proof:${userId}:${objectKey}`;
}

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

// ── Mock remote wrappers – attach .__  so init_remote_functions validator passes
function wrapWithRemoteMarker(
	handler: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	(handler as unknown as Record<string, unknown>).__ = {};
	return handler;
}

vi.mock('$lib/server/remote.js', () => ({
	// Single-flight refresh is a runtime-only concern (no-op outside remote requests).
	singleFlightRefresh: vi.fn(),
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	publicQuery: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
	publicCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
}));

// ── Mock SvelteKit error so it throws with a .status property ────────────────
vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

// ── Mock drizzle-orm – inspectable where-clause builders ────────────────────
vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
	and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
	or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
	ne: vi.fn((...args: unknown[]) => ({ op: 'ne', args })),
	isNull: vi.fn((arg: unknown) => ({ op: 'isNull', args: [arg] })),
	// Tagged template used as `sql<T>` in subquery projections; the result is aliased via
	// `.as(...)`, so return a chainable stub instead of a bare undefined.
	sql: vi.fn(() => ({ as: vi.fn(() => 'sql_alias') })),
}));

// ── Mock schema imports ───────────────────────────────────────────────────────
vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'wishlist.id',
		recipientUserId: 'wishlist.recipientUserId',
		recipientName: 'wishlist.recipientName',
		recipientIsModerator: 'wishlist.recipientIsModerator',
		shortId: 'wishlist.shortId',
		status: 'wishlist.status',
		sharedAt: 'wishlist.sharedAt',
		eventDateEditedAt: 'wishlist.eventDateEditedAt',
		deletedAt: 'wishlist.deletedAt',
		createdAt: 'wishlist.createdAt',
		updatedAt: 'wishlist.updatedAt',
		title: 'wishlist.title',
		description: 'wishlist.description',
		eventDate: 'wishlist.eventDate',
		theme: 'wishlist.theme',
		customThemeColor: 'wishlist.customThemeColor',
		imageKey: 'wishlist.imageKey',
		imageSlots: 'wishlist.imageSlots',
		archivedAt: 'wishlist.archivedAt',
	},
	priorityLevel: {
		id: 'priorityLevel.id',
		wishlistId: 'priorityLevel.wishlistId',
		sortOrder: 'priorityLevel.sortOrder',
		label: 'priorityLevel.label',
	},
}));

vi.mock('$lib/server/db/moderator.schema.js', () => ({
	moderatorAssignment: {
		id: 'moderatorAssignment.id',
		wishlistId: 'moderatorAssignment.wishlistId',
		userId: 'moderatorAssignment.userId',
		deletedAt: 'moderatorAssignment.deletedAt',
		assignedAt: 'moderatorAssignment.assignedAt',
	},
}));

vi.mock('$lib/server/db/follower.schema.js', () => ({
	wishlistFollower: {
		wishlistId: 'wishlistFollower.wishlistId',
		userId: 'wishlistFollower.userId',
		unfollowedAt: 'wishlistFollower.unfollowedAt',
		lastVisitedAt: 'wishlistFollower.lastVisitedAt',
		createdAt: 'wishlistFollower.createdAt',
	},
}));

vi.mock('$lib/server/db/wishlist_visit.schema.js', () => ({
	wishlistVisit: {
		wishlistId: 'wishlistVisit.wishlistId',
		userId: 'wishlistVisit.userId',
		lastVisitedAt: 'wishlistVisit.lastVisitedAt',
	},
}));

vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: {
		id: 'gift.id',
		wishlistId: 'gift.wishlistId',
		deletedAt: 'gift.deletedAt',
	},
	reservation: {
		giftId: 'reservation.giftId',
		deletedAt: 'reservation.deletedAt',
		id: 'reservation.id',
		userId: 'reservation.userId',
		quantity: 'reservation.quantity',
	},
}));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: {
		id: 'user.id',
		name: 'user.name',
		image: 'user.image',
	},
}));

vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));

// ── DB mock helper ────────────────────────────────────────────────────────────

interface MockDb {
	db: Record<string | symbol, unknown>;
	pushResult: (result: unknown[]) => void;
	/** Payload passed to the most recent `.set(...)` call (e.g. drizzle update data). */
	lastSetPayload: () => Record<string, unknown> | undefined;
	/** Payload passed to the most recent `.values(...)` call (e.g. drizzle insert data). */
	lastValuesPayload: () => Record<string, unknown> | undefined;
	/** Payload passed to the Nth `.values(...)` call in order (0 = first insert in the tx). */
	valuesPayloadAt: (index: number) => Record<string, unknown> | undefined;
	/** Number of awaited query chains so far — i.e. statements sent to the database. */
	statementCount: () => number;
	/** Hold query results so tests can observe how many statements start before any settles. */
	deferStatements: () => void;
	releaseStatements: () => void;
	wherePayloads: () => readonly unknown[];
	transactionCount: () => number;
	forPayloads: () => readonly unknown[];
	reset: () => void;
}

function createMockDb(): MockDb {
	const results: unknown[][] = [];
	const indexRef = { value: 0 };
	const setPayloads: Record<string, unknown>[] = [];
	const valuesPayloads: Record<string, unknown>[] = [];
	const wherePayloads: unknown[] = [];
	const forPayloads: unknown[] = [];
	let transactionCount = 0;
	let statementsDeferred = false;
	const pendingStatementResolvers: Array<() => void> = [];

	const chain: Record<string | symbol, unknown> = new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'then') {
					const result = results[indexRef.value] ?? [];
					indexRef.value++;
					return (resolve: (value: unknown) => void) => {
						const settle = () => resolve(result);
						if (statementsDeferred) {
							pendingStatementResolvers.push(settle);
						} else {
							settle();
						}
					};
				}
				if (prop === 'transaction') {
					return vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
						transactionCount += 1;
						return callback(chain);
					});
				}
				if (prop === 'for') {
					return vi.fn((payload: unknown) => {
						forPayloads.push(payload);
						return chain;
					});
				}
				if (prop === 'set') {
					return vi.fn((payload: Record<string, unknown>) => {
						setPayloads.push(payload);
						return chain;
					});
				}
				if (prop === 'values') {
					return vi.fn((payload: Record<string, unknown>) => {
						valuesPayloads.push(payload);
						return chain;
					});
				}
				if (prop === 'where') {
					return vi.fn((payload: unknown) => {
						wherePayloads.push(payload);
						return chain;
					});
				}
				return vi.fn(() => chain);
			},
		},
	);

	return {
		db: chain,
		pushResult: (result: unknown[]) => results.push(result),
		lastSetPayload: () => setPayloads[setPayloads.length - 1],
		lastValuesPayload: () => valuesPayloads[valuesPayloads.length - 1],
		valuesPayloadAt: (index) => valuesPayloads[index],
		statementCount: () => indexRef.value,
		deferStatements: () => {
			statementsDeferred = true;
		},
		releaseStatements: () => {
			statementsDeferred = false;
			pendingStatementResolvers.splice(0).forEach((settle) => settle());
		},
		wherePayloads: () => [...wherePayloads],
		transactionCount: () => transactionCount,
		forPayloads: () => [...forPayloads],
		reset: () => {
			results.length = 0;
			indexRef.value = 0;
			setPayloads.length = 0;
			valuesPayloads.length = 0;
			wherePayloads.length = 0;
			transactionCount = 0;
			forPayloads.length = 0;
			statementsDeferred = false;
			pendingStatementResolvers.length = 0;
		},
	};
}

// ── Mock getDb ────────────────────────────────────────────────────────────────

const mockDbInstance = createMockDb();

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(() => mockDbInstance.db),
}));

// ── Mock R2 storage cleanup (issue #107, REQ-6) ──────────────────────────────

vi.mock('$lib/server/storage/r2.js', () => ({
	deleteObjectsBestEffort: vi.fn(() => Promise.resolve()),
}));

// ── Import the module under test (after all mocks are set up) ─────────────────

import * as v from 'valibot';
import {
	deleteWishlist,
	updateWishlist,
	archiveWishlist,
	createWishlist,
	renameRecipient,
	flipRecipientToFreeText,
	followWishlist,
	unfollowWishlist,
	refollowWishlist,
	getWishlistByShortId,
	setWishlistPalette,
	recordWishlistVisit,
	getMyWishlists,
	getModeratedWishlists,
	getFollowedWishlists,
} from './wishlists.remote.js';
import { getHomeOverview } from './home_overview_service.js';
import { CreateWishlistInputSchema, FlipRecipientToFreeTextInputSchema } from './types.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';

const mockDeleteObjects = vi.mocked(deleteObjectsBestEffort);
const mockDispatchNotification = vi.mocked(dispatchNotification);

// ── Test data factories ───────────────────────────────────────────────────────

/** The linked recipient of a self list — manages inherently, no moderatorAssignment row. */
const RECIPIENT_ID = 'user-recipient';
const OTHER_USER_ID = 'user-other';
const MODERATOR_ID = 'user-moderator';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc12345';

interface DrizzleExpression {
	op: string;
	args: unknown[];
}

function expression(op: string, ...args: unknown[]): DrizzleExpression {
	return { op, args };
}

function expressionTreeContains(value: unknown, expected: DrizzleExpression): boolean {
	if (JSON.stringify(value) === JSON.stringify(expected)) {
		return true;
	}
	if (Array.isArray(value)) {
		return value.some((child) => expressionTreeContains(child, expected));
	}
	if (value !== null && typeof value === 'object') {
		return Object.values(value).some((child) => expressionTreeContains(child, expected));
	}
	return false;
}

function expressionTreeReferences(
	value: unknown,
	expected: string | number | boolean | null,
): boolean {
	if (value === expected) {
		return true;
	}
	if (Array.isArray(value)) {
		return value.some((child) => expressionTreeReferences(child, expected));
	}
	if (value !== null && typeof value === 'object') {
		return Object.values(value).some((child) => expressionTreeReferences(child, expected));
	}
	return false;
}

function expectWhereToContain(wherePayload: unknown, op: string, ...args: unknown[]): void {
	expect(expressionTreeContains(wherePayload, expression(op, ...args))).toBe(true);
}

function expectWhereNotToContain(wherePayload: unknown, op: string, ...args: unknown[]): void {
	expect(expressionTreeContains(wherePayload, expression(op, ...args))).toBe(false);
}

function findWhereContaining(
	wherePayloads: readonly unknown[],
	op: string,
	...args: unknown[]
): unknown {
	const payload = wherePayloads.find((candidate) =>
		expressionTreeContains(candidate, expression(op, ...args)),
	);
	expect(payload).toBeDefined();
	return payload;
}

function latestWherePayload(): unknown {
	const payloads = mockDbInstance.wherePayloads();
	const payload = payloads[payloads.length - 1];
	expect(payload).toBeDefined();
	return payload;
}

/**
 * A "self" wishlist row: the linked recipient (`recipientUserId`) is the manager, there is no
 * free-text recipient name. Pass `recipientUserId: null` + `recipientName` for a for-someone list.
 */
function makeWishlistRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: WISHLIST_ID,
		shortId: WISHLIST_SHORT_ID,
		recipientUserId: RECIPIENT_ID,
		recipientName: null,
		recipientIsModerator: false,
		title: 'Test Wishlist',
		description: null,
		status: 'draft',
		sharedAt: null,
		eventDateEditedAt: null,
		deletedAt: null,
		archivedAt: null,
		eventDate: null,
		theme: 'default',
		customThemeColor: null,
		imageKey: null,
		imageSlots: null,
		createdAt: new Date('2024-01-01T00:00:00Z'),
		updatedAt: new Date('2024-01-01T00:00:00Z'),
		...overrides,
	};
}

/** For-someone list: no linked recipient, free-text `recipientName`, managed via moderatorAssignment. */
function makeForSomeoneWishlistRow(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return makeWishlistRow({
		recipientUserId: null,
		recipientName: 'Grandma',
		...overrides,
	});
}

/** Auth context for the linked recipient (manages a self list inherently). */
function makeRecipientAuthContext(): { user: { id: string } } {
	return { user: { id: RECIPIENT_ID } };
}

function makeOtherAuthContext(): { user: { id: string } } {
	return { user: { id: OTHER_USER_ID } };
}

function makeModeratorAuthContext(): { user: { id: string } } {
	return { user: { id: MODERATOR_ID } };
}

// ── Typed handler aliases ─────────────────────────────────────────────────────

interface AuthContext {
	user: { id: string };
}
type NullableAuthContext = AuthContext | null;

type DeleteWishlistHandler = (auth: AuthContext, wishlistId: string) => Promise<void>;
type UpdateWishlistHandler = (
	auth: AuthContext,
	input: Record<string, unknown>,
) => Promise<unknown>;
type ArchiveWishlistHandler = (auth: AuthContext, wishlistId: string) => Promise<unknown>;
type CreateWishlistHandler = (
	auth: AuthContext,
	input: Record<string, unknown>,
) => Promise<unknown>;
type FollowWishlistHandler = (
	auth: AuthContext,
	wishlistId: string,
) => Promise<{ followed: boolean; alreadyFollowing: boolean }>;
type GetWishlistByShortIdHandler = (
	authContext: NullableAuthContext,
	shortId: string,
) => Promise<unknown>;
type RenameRecipientHandler = (
	auth: AuthContext,
	input: { id: string; recipientName: string },
) => Promise<unknown>;
type FlipRecipientToFreeTextHandler = (
	auth: AuthContext & { user: { name?: string } },
	input: { id: string; recipientName: string },
) => Promise<unknown>;
type SetWishlistPaletteHandler = (
	auth: AuthContext,
	input: { wishlistId: string; palette: string },
) => Promise<unknown>;

const callDeleteWishlist = deleteWishlist as unknown as DeleteWishlistHandler;
const callUpdateWishlist = updateWishlist as unknown as UpdateWishlistHandler;
const callArchiveWishlist = archiveWishlist as unknown as ArchiveWishlistHandler;
const callCreateWishlist = createWishlist as unknown as CreateWishlistHandler;
const callRenameRecipient = renameRecipient as unknown as RenameRecipientHandler;
const callFlipRecipientToFreeText =
	flipRecipientToFreeText as unknown as FlipRecipientToFreeTextHandler;
const callFollowWishlist = followWishlist as unknown as FollowWishlistHandler;
const callGetWishlistByShortId = getWishlistByShortId as unknown as GetWishlistByShortIdHandler;
const callSetWishlistPalette = setWishlistPalette as unknown as SetWishlistPaletteHandler;
const callGetMyWishlists = getMyWishlists as unknown as (
	auth: AuthContext,
) => Promise<Record<string, unknown>[]>;
const callGetModeratedWishlists = getModeratedWishlists as unknown as (
	auth: AuthContext,
) => Promise<Record<string, unknown>[]>;
const callGetFollowedWishlists = getFollowedWishlists as unknown as (
	auth: AuthContext,
) => Promise<Record<string, unknown>[]>;

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deleteWishlist', () => {
	describe('recipient can delete an unshared wishlist', () => {
		it('resolves without throwing when the linked recipient deletes a draft wishlist', async () => {
			// DB call 1: requireWishlistRow (recipientUserId matches caller → manager, no mod query)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: gift image-key collection (issue #107 cleanup)
			mockDbInstance.pushResult([]);
			// DB call 3: soft-delete update
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteWishlist(makeRecipientAuthContext(), WISHLIST_ID),
			).resolves.not.toThrow();
		});

		it('deletes the wishlist image and its gifts’ images from storage (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: null, imageKey: 'wishlists/banners/w.jpg' }),
			]);
			mockDbInstance.pushResult([{ imageKey: 'gifts/a.jpg' }, { imageKey: null }]);
			mockDbInstance.pushResult([]);

			await callDeleteWishlist(makeRecipientAuthContext(), WISHLIST_ID);

			expect(mockDeleteObjects).toHaveBeenCalledWith([
				'wishlists/banners/w.jpg',
				'gifts/a.jpg',
				null,
			]);
		});
	});

	describe('non-manager cannot delete', () => {
		it('throws 403 ACCESS_DENIED when caller is neither recipient nor správce', async () => {
			// DB call 1: requireWishlistRow (recipient is RECIPIENT_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → none found
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteWishlist(makeOtherAuthContext(), WISHLIST_ID),
			).rejects.toMatchObject({
				status: 403,
				message: 'ACCESS_DENIED',
			});
		});
	});

	describe('shared wishlist cannot be deleted', () => {
		it('throws 400 when sharedAt is not null', async () => {
			// DB call 1: wishlist lookup with sharedAt set
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date('2024-01-10T00:00:00Z'), status: 'active' }),
			]);

			await expect(
				callDeleteWishlist(makeRecipientAuthContext(), WISHLIST_ID),
			).rejects.toMatchObject({
				status: 400,
				message: expect.stringContaining('Cannot delete a shared wishlist'),
			});
		});
	});

	describe('non-existent wishlist', () => {
		it('throws 404 when wishlist does not exist', async () => {
			// DB call 1: empty lookup result
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteWishlist(makeRecipientAuthContext(), 'ghost-wishlist'),
			).rejects.toMatchObject({
				status: 404,
				message: 'WISHLIST_NOT_FOUND',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('setWishlistPalette', () => {
	describe('non-manager cannot change the palette', () => {
		it('throws 403 ACCESS_DENIED when caller is neither recipient nor správce', async () => {
			// DB call 1: requireWishlistRow (recipient is RECIPIENT_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → none found
			mockDbInstance.pushResult([]);

			await expect(
				callSetWishlistPalette(makeOtherAuthContext(), {
					wishlistId: WISHLIST_ID,
					palette: 'mint',
				}),
			).rejects.toMatchObject({
				status: 403,
				message: 'ACCESS_DENIED',
			});
		});
	});

	describe('archived wishlist is read-only', () => {
		it('throws 400 even for the linked recipient (same rule as updateWishlist)', async () => {
			// DB call 1: requireWishlistRow — archived list, caller IS the linked recipient
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callSetWishlistPalette(makeRecipientAuthContext(), {
					wishlistId: WISHLIST_ID,
					palette: 'mint',
				}),
			).rejects.toMatchObject({
				status: 400,
				message: 'CANNOT_MODIFY_ARCHIVED_WISHLIST',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('updateWishlist', () => {
	describe('recipient can update title on an unshared wishlist', () => {
		it('returns updated wishlist row', async () => {
			const updatedRow = makeWishlistRow({ title: 'New Title' });
			// DB call 1: requireWishlistRow (recipient = manager, no mod query; not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				title: 'New Title',
			});

			expect(result).toMatchObject({ id: WISHLIST_ID, title: 'New Title' });
		});
	});

	describe('moderator (správce) can update title on a for-someone list', () => {
		it('returns updated wishlist row after the mod-assignment check passes', async () => {
			const updatedRow = makeForSomeoneWishlistRow({ title: 'New Title' });
			// DB call 1: requireWishlistRow (for-someone list, caller is not recipient)
			mockDbInstance.pushResult([makeForSomeoneWishlistRow({ sharedAt: null })]);
			// DB call 2: hasActiveModeratorAssignment → found → manager
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);
			// DB call 3: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeModeratorAuthContext(), {
				id: WISHLIST_ID,
				title: 'New Title',
			});

			expect(result).toMatchObject({ id: WISHLIST_ID, title: 'New Title' });
		});
	});

	describe('recipient can update image assignment + per-slot metadata', () => {
		it('persists imageKey and imageSlots', async () => {
			const imageSlots = {
				card: { fitMode: 'cover-crop', focal: { x: 50, y: 40 } },
				banner: { fitMode: 'cover-crop', cropRect: { x: 0, y: 0, w: 1, h: 0.5 } },
			};
			const imageKey = 'wishlists/banners/hero.jpg';
			const updatedRow = makeWishlistRow({ imageKey, imageSlots });
			// DB call 1: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				imageKey,
				imageSlots,
				imageAssignmentToken: await bannerAssignmentToken(imageKey),
			});

			expect(result).toMatchObject({ imageKey, imageSlots });
		});

		it('locks the mutable row in a transaction before replacing and cleaning up its image', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: null, imageKey: 'wishlists/banners/old.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ imageKey: 'wishlists/banners/new.jpg' })]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				imageKey: 'wishlists/banners/new.jpg',
				imageAssignmentToken: await bannerAssignmentToken('wishlists/banners/new.jpg'),
			});

			expect(mockDbInstance.transactionCount()).toBe(1);
			expect(mockDbInstance.forPayloads()).toEqual(['update']);
			expect(mockDeleteObjects).toHaveBeenCalledWith(['wishlists/banners/old.jpg']);
		});

		it('deletes the replaced uploaded image from storage (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: null, imageKey: 'wishlists/banners/old.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ imageKey: 'wishlists/banners/new.jpg' })]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				imageKey: 'wishlists/banners/new.jpg',
				imageAssignmentToken: await bannerAssignmentToken('wishlists/banners/new.jpg'),
			});

			expect(mockDeleteObjects).toHaveBeenCalledWith(['wishlists/banners/old.jpg']);
		});

		it('rejects planting another uploader’s banner key before it can later be deleted', async () => {
			const victimKey = 'wishlists/banners/victim.jpg';
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);

			await expect(
				callUpdateWishlist(makeRecipientAuthContext(), {
					id: WISHLIST_ID,
					imageKey: victimKey,
					imageAssignmentToken: await bannerAssignmentToken(victimKey, 'victim-user'),
				}),
			).rejects.toThrow('ACCESS_DENIED');
			expect(mockDeleteObjects).not.toHaveBeenCalled();
		});

		it('keeps storage untouched when only crop metadata changes (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: null, imageKey: 'wishlists/banners/same.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow()]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				imageSlots: { card: { fitMode: 'cover-crop' } },
			});

			expect(mockDeleteObjects).not.toHaveBeenCalled();
		});
	});

	describe('recipient can update description on an unshared wishlist', () => {
		it('returns updated wishlist row with new description', async () => {
			const updatedRow = makeWishlistRow({ description: 'A festive list' });
			// DB call 1: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				description: 'A festive list',
			});

			// The description must actually be written to the update payload, not just
			// echoed by the mock return value.
			expect(mockDbInstance.lastSetPayload()).toMatchObject({
				description: 'A festive list',
			});
			expect(result).toMatchObject({ id: WISHLIST_ID, description: 'A festive list' });
		});
	});

	describe('recipient can update event date on an unshared wishlist', () => {
		it('returns updated wishlist row with new event date', async () => {
			const eventDate = new Date('2026-12-24T00:00:00Z');
			const updatedRow = makeWishlistRow({ eventDate });
			// DB call 1: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				eventDate,
			});

			// The event date must reach the update payload on an unshared wishlist.
			expect(mockDbInstance.lastSetPayload()).toMatchObject({ eventDate });
			expect(result).toMatchObject({ id: WISHLIST_ID, eventDate });
		});
	});

	describe('non-manager cannot update', () => {
		it('throws 403 ACCESS_DENIED when caller is neither recipient nor správce', async () => {
			// DB call 1: requireWishlistRow (recipient is RECIPIENT_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → none found
			mockDbInstance.pushResult([]);

			await expect(
				callUpdateWishlist(makeOtherAuthContext(), {
					id: WISHLIST_ID,
					title: 'Hacked Title',
				}),
			).rejects.toMatchObject({
				status: 403,
				message: 'ACCESS_DENIED',
			});
		});
	});

	describe('archived wishlist cannot be updated', () => {
		it('throws 400 when wishlist status is archived', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callUpdateWishlist(makeRecipientAuthContext(), {
					id: WISHLIST_ID,
					title: 'Should Fail',
				}),
			).rejects.toMatchObject({
				status: 400,
				message: 'CANNOT_MODIFY_ARCHIVED_WISHLIST',
			});
		});
	});

	describe('event date grace window (issue #83)', () => {
		const nowFake = new Date('2024-03-01T12:00:00.000Z');

		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(nowFake);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('allows editing the event date while the window is open and bumps the debounce timestamp', async () => {
			const newDate = new Date('2026-12-24T00:00:00Z');
			// shared 60s ago, never re-edited → window open
			mockDbInstance.pushResult([
				makeWishlistRow({
					sharedAt: new Date(nowFake.getTime() - 60_000),
					eventDateEditedAt: null,
					status: 'active',
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ eventDate: newDate })]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				eventDate: newDate,
			});

			const payload = mockDbInstance.lastSetPayload();
			expect(payload).toMatchObject({ eventDate: newDate });
			expect(payload?.eventDateEditedAt).toBeInstanceOf(Date);
		});

		it('keeps the window open via a recent eventDateEditedAt even when sharedAt is old (debounce)', async () => {
			const newDate = new Date('2026-12-24T00:00:00Z');
			mockDbInstance.pushResult([
				makeWishlistRow({
					sharedAt: new Date(nowFake.getTime() - 10 * 60_000), // shared 10 min ago
					eventDateEditedAt: new Date(nowFake.getTime() - 30_000), // last date edit 30s ago
					status: 'active',
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ eventDate: newDate })]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				eventDate: newDate,
			});

			expect(mockDbInstance.lastSetPayload()).toMatchObject({ eventDate: newDate });
		});

		it('drops the event date once the window has closed (stale client cannot bypass server)', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({
					sharedAt: new Date(nowFake.getTime() - 3 * 60_000), // shared 3 min ago → closed
					eventDateEditedAt: null,
					status: 'active',
				}),
			]);
			mockDbInstance.pushResult([makeWishlistRow()]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				eventDate: new Date('2026-12-24T00:00:00Z'),
			});

			const payload = mockDbInstance.lastSetPayload();
			expect(payload && 'eventDate' in payload).toBe(false);
			expect(payload && 'eventDateEditedAt' in payload).toBe(false);
		});
	});

	describe('event date locked after sharing', () => {
		it('silently ignores eventDate change when wishlist is shared', async () => {
			const updatedRow = makeWishlistRow({
				sharedAt: new Date('2024-01-10T00:00:00Z'),
				title: 'Updated Title',
				// eventDate stays null (was not updated)
				eventDate: null,
			});
			// DB call 1: wishlist lookup (already shared)
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date('2024-01-10T00:00:00Z'), status: 'active' }),
			]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			// Should NOT throw – eventDate change is silently dropped
			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				title: 'Updated Title',
				eventDate: new Date('2025-12-25T00:00:00Z'),
			});

			expect(result).toMatchObject({ id: WISHLIST_ID });
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('renameRecipient', () => {
	describe('a správce can rename a for-someone recipient', () => {
		it('updates recipientName and returns the updated row', async () => {
			const renamedRow = makeForSomeoneWishlistRow({ recipientName: 'Aunt May' });
			// DB call 1: requireWishlistRow (for-someone list, caller not recipient)
			mockDbInstance.pushResult([makeForSomeoneWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → found → manager
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);
			// DB call 3: update returning
			mockDbInstance.pushResult([renamedRow]);

			const result = await callRenameRecipient(makeModeratorAuthContext(), {
				id: WISHLIST_ID,
				recipientName: 'Aunt May',
			});

			expect(mockDbInstance.lastSetPayload()).toMatchObject({ recipientName: 'Aunt May' });
			expect(result).toMatchObject({ id: WISHLIST_ID, recipientName: 'Aunt May' });
		});
	});

	describe('non-manager cannot rename', () => {
		it('throws 403 ACCESS_DENIED when caller is neither recipient nor správce', async () => {
			// DB call 1: requireWishlistRow (for-someone list)
			mockDbInstance.pushResult([makeForSomeoneWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → none
			mockDbInstance.pushResult([]);

			await expect(
				callRenameRecipient(makeOtherAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'Hacked Name',
				}),
			).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
		});
	});

	describe('rejects a self / linked-recipient list', () => {
		it('throws 400 RECIPIENT_RENAME_NOT_ALLOWED when recipientUserId is set (no free-text name to rename)', async () => {
			// DB call 1: requireWishlistRow (self list, recipient = caller → manager, no mod query)
			mockDbInstance.pushResult([makeWishlistRow()]);

			await expect(
				callRenameRecipient(makeRecipientAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'New Name',
				}),
			).rejects.toMatchObject({ status: 400, message: 'RECIPIENT_RENAME_NOT_ALLOWED' });
		});
	});

	describe('rejects an archived wishlist', () => {
		it('throws 400 CANNOT_MODIFY_ARCHIVED_WISHLIST before touching recipientName', async () => {
			// DB call 1: requireWishlistRow (for-someone + archived)
			mockDbInstance.pushResult([makeForSomeoneWishlistRow({ status: 'archived' })]);
			// DB call 2: hasActiveModeratorAssignment → found → manager
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);

			await expect(
				callRenameRecipient(makeModeratorAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'New Name',
				}),
			).rejects.toMatchObject({ status: 400, message: 'CANNOT_MODIFY_ARCHIVED_WISHLIST' });
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('flipRecipientToFreeText', () => {
	/** Auth context for the linked recipient incl. name (used as notification actorName). */
	function makeNamedRecipientAuthContext(): { user: { id: string; name: string } } {
		return { user: { id: RECIPIENT_ID, name: 'Recipient Alice' } };
	}

	describe('the linked recipient converts their own list', () => {
		it('clears recipientUserId, sets the free-text name, and resets recipientIsModerator', async () => {
			const flippedRow = makeForSomeoneWishlistRow({ recipientName: 'Rosie' });
			// DB call 1: requireWishlistRow (caller IS the linked recipient; self-promoted before)
			mockDbInstance.pushResult([makeWishlistRow({ recipientIsModerator: true })]);
			// DB call 2 (in tx): update wishlist returning
			mockDbInstance.pushResult([flippedRow]);
			// DB call 3 (in tx): insert moderatorAssignment
			mockDbInstance.pushResult([]);

			const result = await callFlipRecipientToFreeText(makeNamedRecipientAuthContext(), {
				id: WISHLIST_ID,
				recipientName: 'Rosie',
			});

			expect(mockDbInstance.lastSetPayload()).toMatchObject({
				recipientUserId: null,
				recipientName: 'Rosie',
				// The trust banner must disappear — the flag resets even when previously self-promoted.
				recipientIsModerator: false,
			});
			expect(result).toMatchObject({ recipientUserId: null, recipientName: 'Rosie' });
		});

		it('auto-inserts an active správce assignment for the ex-recipient (orphan guard stays satisfied)', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);
			mockDbInstance.pushResult([makeForSomeoneWishlistRow({ recipientName: 'Rosie' })]);
			mockDbInstance.pushResult([]);

			await callFlipRecipientToFreeText(makeNamedRecipientAuthContext(), {
				id: WISHLIST_ID,
				recipientName: 'Rosie',
			});

			expect(mockDbInstance.lastValuesPayload()).toMatchObject({
				wishlistId: WISHLIST_ID,
				userId: RECIPIENT_ID,
			});
		});
	});

	describe('actor gating: only the linked recipient may flip', () => {
		it('throws 403 ACCESS_DENIED for a správce (no evicting a linked recipient)', async () => {
			// DB call 1: requireWishlistRow — caller is MODERATOR_ID, recipient is RECIPIENT_ID.
			// Rejected before any moderator-assignment lookup: správce status is irrelevant.
			mockDbInstance.pushResult([makeWishlistRow()]);

			await expect(
				callFlipRecipientToFreeText(makeModeratorAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'Rosie',
				}),
			).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
		});

		it('throws 403 ACCESS_DENIED for a visitor', async () => {
			mockDbInstance.pushResult([makeWishlistRow()]);

			await expect(
				callFlipRecipientToFreeText(makeOtherAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'Rosie',
				}),
			).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
		});

		it('throws 403 ACCESS_DENIED on a for-someone list (no linked recipient to flip)', async () => {
			// A free-text list has recipientUserId = null — nobody matches, even a správce.
			mockDbInstance.pushResult([makeForSomeoneWishlistRow()]);

			await expect(
				callFlipRecipientToFreeText(makeModeratorAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'Rosie',
				}),
			).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
		});
	});

	describe('archived list is rejected', () => {
		it('throws 400 CANNOT_MODIFY_ARCHIVED_WISHLIST before touching the recipient', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callFlipRecipientToFreeText(makeNamedRecipientAuthContext(), {
					id: WISHLIST_ID,
					recipientName: 'Rosie',
				}),
			).rejects.toMatchObject({ status: 400, message: 'CANNOT_MODIFY_ARCHIVED_WISHLIST' });
		});
	});

	describe('notification: shared list notifies followers, draft stays silent', () => {
		it('dispatches the self-promote-channel notification to followers, excluding the actor', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: new Date('2024-01-10T00:00:00Z'), status: 'active' }),
			]);
			mockDbInstance.pushResult([makeForSomeoneWishlistRow({ recipientName: 'Rosie' })]);
			mockDbInstance.pushResult([]); // insert assignment
			// DB call 4: active followers — includes the actor, who must be filtered out
			mockDbInstance.pushResult([{ userId: OTHER_USER_ID }, { userId: RECIPIENT_ID }]);

			await callFlipRecipientToFreeText(makeNamedRecipientAuthContext(), {
				id: WISHLIST_ID,
				recipientName: 'Rosie',
			});

			expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
			expect(mockDispatchNotification).toHaveBeenCalledWith({
				type: NOTIFICATION_TYPE.RECIPIENT_SELF_PROMOTED,
				targetUserIds: [OTHER_USER_ID],
				wishlistId: WISHLIST_ID,
				actorId: RECIPIENT_ID,
				actorName: 'Recipient Alice',
			});
		});

		it('stays silent on a draft (sharedAt is null)', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			mockDbInstance.pushResult([makeForSomeoneWishlistRow({ recipientName: 'Rosie' })]);
			mockDbInstance.pushResult([]); // insert assignment

			await callFlipRecipientToFreeText(makeNamedRecipientAuthContext(), {
				id: WISHLIST_ID,
				recipientName: 'Rosie',
			});

			expect(mockDispatchNotification).not.toHaveBeenCalled();
		});
	});

	describe('input validation (FlipRecipientToFreeTextInputSchema)', () => {
		it('trims the recipient name', () => {
			const parsed = v.parse(FlipRecipientToFreeTextInputSchema, {
				id: WISHLIST_ID,
				recipientName: '  Rosie  ',
			});
			expect(parsed.recipientName).toBe('Rosie');
		});

		it('rejects an empty or whitespace-only name', () => {
			expect(
				v.safeParse(FlipRecipientToFreeTextInputSchema, {
					id: WISHLIST_ID,
					recipientName: '',
				}).success,
			).toBe(false);
			expect(
				v.safeParse(FlipRecipientToFreeTextInputSchema, {
					id: WISHLIST_ID,
					recipientName: '   ',
				}).success,
			).toBe(false);
		});

		it('rejects a name longer than 100 characters and accepts exactly 100', () => {
			expect(
				v.safeParse(FlipRecipientToFreeTextInputSchema, {
					id: WISHLIST_ID,
					recipientName: 'a'.repeat(101),
				}).success,
			).toBe(false);
			expect(
				v.safeParse(FlipRecipientToFreeTextInputSchema, {
					id: WISHLIST_ID,
					recipientName: 'a'.repeat(100),
				}).success,
			).toBe(true);
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('archiveWishlist', () => {
	describe('recipient can archive', () => {
		it('returns the archived wishlist row', async () => {
			const archivedRow = makeWishlistRow({ status: 'archived', archivedAt: new Date() });
			// DB call 1: requireWishlistRow (recipient = manager, no mod query)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: update returning
			mockDbInstance.pushResult([archivedRow]);
			// DB call 3: follower select (for archive notification)
			mockDbInstance.pushResult([]);
			// DB call 4: moderator select (for archive notification)
			mockDbInstance.pushResult([]);

			const result = await callArchiveWishlist(makeRecipientAuthContext(), WISHLIST_ID);

			expect(result).toMatchObject({ id: WISHLIST_ID, status: 'archived' });
		});
	});

	describe('non-manager cannot archive', () => {
		it('throws 403 ACCESS_DENIED when caller is neither recipient nor správce', async () => {
			// DB call 1: requireWishlistRow (recipient is RECIPIENT_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: hasActiveModeratorAssignment → none found
			mockDbInstance.pushResult([]);

			await expect(
				callArchiveWishlist(makeOtherAuthContext(), WISHLIST_ID),
			).rejects.toMatchObject({
				status: 403,
				message: 'ACCESS_DENIED',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('createWishlist', () => {
	describe('recipientKind: self (creator is the linked recipient)', () => {
		it('inserts the wishlist with recipientUserId = creator, recipientName = null, and NO moderatorAssignment', async () => {
			const createdRow = makeWishlistRow({
				id: 'new-wishlist-id',
				title: 'My Birthday',
				recipientUserId: RECIPIENT_ID,
				recipientName: null,
			});
			// DB call 1 (in tx): insert wishlist returning
			mockDbInstance.pushResult([createdRow]);
			// DB call 2 (in tx): insert default priority levels (no moderatorAssignment on self lists)
			mockDbInstance.pushResult([]);

			const result = await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'self',
				title: 'My Birthday',
			});

			// The wishlist insert must link the creator as recipient with no free-text name.
			expect(mockDbInstance.lastSetPayload).toBeDefined();
			expect(result).toMatchObject({
				id: 'new-wishlist-id',
				title: 'My Birthday',
				recipientUserId: RECIPIENT_ID,
				recipientName: null,
			});
		});
	});

	describe('recipientKind: other (free-text recipient, creator becomes first správce)', () => {
		it('inserts the wishlist with recipientName set, recipientUserId = null, plus a moderatorAssignment row', async () => {
			const createdRow = makeForSomeoneWishlistRow({
				id: 'new-wishlist-id',
				title: "Grandma's List",
				recipientName: 'Grandma',
			});
			// DB call 1 (in tx): insert wishlist returning
			mockDbInstance.pushResult([createdRow]);
			// DB call 2 (in tx): insert moderatorAssignment for the creator (for-someone list)
			mockDbInstance.pushResult([]);
			// DB call 3 (in tx): insert default priority levels
			mockDbInstance.pushResult([]);

			const result = await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'other',
				recipientName: 'Grandma',
				title: "Grandma's List",
			});

			expect(result).toMatchObject({
				id: 'new-wishlist-id',
				title: "Grandma's List",
				recipientUserId: null,
				recipientName: 'Grandma',
			});
		});
	});

	describe('optional palette + description at creation', () => {
		/** Push the two tx results a self-list create expects (wishlist insert, then priority levels). */
		function pushSelfCreateResults(): void {
			mockDbInstance.pushResult([makeWishlistRow({ id: 'new-wishlist-id' })]);
			mockDbInstance.pushResult([]);
		}

		it('defaults palette to "sky" and description to null when omitted (AC-1)', async () => {
			pushSelfCreateResults();

			await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'self',
				title: 'X',
			});

			// The wishlist insert is the FIRST `.values(...)` call in the transaction.
			expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({
				palette: 'sky',
				description: null,
			});
		});

		it('persists a chosen palette (AC-2)', async () => {
			pushSelfCreateResults();

			await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'self',
				title: 'X',
				palette: 'ruby',
			});

			expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({ palette: 'ruby' });
		});

		it('trims a provided description (AC-3)', async () => {
			pushSelfCreateResults();

			await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'self',
				title: 'X',
				description: '  Moje přání  ',
			});

			expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({ description: 'Moje přání' });
		});

		it('stores null for a whitespace-only description (AC-3)', async () => {
			pushSelfCreateResults();

			await callCreateWishlist(makeRecipientAuthContext(), {
				recipientKind: 'self',
				title: 'X',
				description: '   ',
			});

			expect(mockDbInstance.valuesPayloadAt(0)?.description).toBeNull();
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CreateWishlistInputSchema', () => {
	it('accepts an optional palette + description', () => {
		const result = v.parse(CreateWishlistInputSchema, {
			recipientKind: 'self',
			title: 'X',
			palette: 'mint',
			description: 'hi',
		});

		expect(result).toMatchObject({ palette: 'mint', description: 'hi' });
	});

	it('accepts input with palette + description omitted', () => {
		expect(() =>
			v.parse(CreateWishlistInputSchema, { recipientKind: 'self', title: 'X' }),
		).not.toThrow();
	});

	it('rejects an invalid palette value', () => {
		expect(() =>
			v.parse(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'X',
				palette: 'not-a-palette',
			}),
		).toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('followWishlist', () => {
	describe('recipient cannot follow own wishlist', () => {
		it('returns { followed: false, alreadyFollowing: false } without creating a record', async () => {
			// DB call 1: wishlist lookup – the linked recipient is the caller
			mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);

			const result = await callFollowWishlist(makeRecipientAuthContext(), WISHLIST_ID);

			expect(result).toEqual({ followed: false, alreadyFollowing: false });
		});
	});

	describe('new visitor follows for the first time', () => {
		it('creates a new follower record and returns { followed: true, alreadyFollowing: false }', async () => {
			// DB call 1: wishlist lookup – recipient is a different user
			mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
			// DB call 2: existing follower check – none found
			mockDbInstance.pushResult([]);
			// DB call 3: insert follower
			mockDbInstance.pushResult([]);

			const result = await callFollowWishlist(makeOtherAuthContext(), WISHLIST_ID);

			expect(result).toEqual({ followed: true, alreadyFollowing: false });
		});
	});

	describe('returning visitor updates lastVisitedAt', () => {
		it('returns { followed: false, alreadyFollowing: true } when record exists with unfollowedAt=null', async () => {
			// DB call 1: wishlist lookup – recipient is a different user
			mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
			// DB call 2: existing follower check – record found, not unfollowed
			mockDbInstance.pushResult([
				{ unfollowedAt: null, lastVisitedAt: new Date('2024-01-01') },
			]);
			// DB call 3: update lastVisitedAt
			mockDbInstance.pushResult([]);

			const result = await callFollowWishlist(makeOtherAuthContext(), WISHLIST_ID);

			expect(result).toEqual({ followed: false, alreadyFollowing: true });
		});

		it('returns { followed: false, alreadyFollowing: false } when record exists but unfollowedAt is set', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
			// DB call 2: existing follower with unfollowedAt set (previously unfollowed)
			mockDbInstance.pushResult([
				{ unfollowedAt: new Date('2024-01-05'), lastVisitedAt: new Date('2024-01-01') },
			]);
			// DB call 3: update lastVisitedAt
			mockDbInstance.pushResult([]);

			const result = await callFollowWishlist(makeOtherAuthContext(), WISHLIST_ID);

			expect(result).toEqual({ followed: false, alreadyFollowing: false });
		});
	});

	describe('wishlist not found', () => {
		it('throws 404 when wishlist does not exist', async () => {
			// DB call 1: empty wishlist lookup
			mockDbInstance.pushResult([]);

			await expect(
				callFollowWishlist(makeOtherAuthContext(), 'ghost-wishlist'),
			).rejects.toMatchObject({
				status: 404,
				message: 'Wishlist not found',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getWishlistByShortId', () => {
	describe('recipient role', () => {
		it('returns role=recipient when the authed user is the linked recipient (self list, no správci)', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user leftJoin → coalesced recipientDisplayName
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// No mod query (recipient match)
			// DB call 2: managerNames query (fetched for ALL lists, 2026-07-14 decision) → none
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(
				makeRecipientAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string; recipientDisplayName: string; managerNames: string[] };

			expect(result.role).toBe('recipient');
			expect(result.recipientDisplayName).toBe('Recipient Alice');
			// No správci and no self-promotion → no manager names, no „Spravuje" line.
			expect(result.managerNames).toEqual([]);
		});
	});

	describe('recipientImage (issue #158)', () => {
		it('exposes the linked recipient’s avatar (e.g. a connected Google account picture)', async () => {
			const wishlistRow = makeWishlistRow();
			mockDbInstance.pushResult([
				{
					wishlist: wishlistRow,
					recipientDisplayName: 'Recipient Alice',
					recipientImage: 'https://lh3.googleusercontent.com/a/abc123',
				},
			]);
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(
				makeRecipientAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { recipientImage: string | null };

			expect(result.recipientImage).toBe('https://lh3.googleusercontent.com/a/abc123');
		});

		it('resolves to null for a free-text (for-someone-else) recipient with no linked account', async () => {
			const wishlistRow = makeForSomeoneWishlistRow();
			// leftJoin on `user` finds no row → recipientImage comes back undefined/null.
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Grandma', recipientImage: null },
			]);
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);
			mockDbInstance.pushResult([{ name: 'Martin' }]);

			const result = (await callGetWishlistByShortId(
				makeModeratorAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { recipientImage: string | null };

			expect(result.recipientImage).toBeNull();
		});
	});

	describe('manager names on linked-recipient (self) lists — 2026-07-14 header decision', () => {
		it('fetches manager names even when recipientUserId is set (správci render on self lists too)', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user leftJoin
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// No mod query (recipient match)
			// DB call 2: managerNames query — a správce exists on this self list
			mockDbInstance.pushResult([{ name: 'Jana' }]);

			const result = (await callGetWishlistByShortId(
				makeRecipientAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { managerNames: string[] };

			expect(result.managerNames).toEqual(['Jana']);
		});

		it('includes the self-promoted recipient in managerNames despite no moderator_assignment row', async () => {
			const wishlistRow = makeWishlistRow({ recipientIsModerator: true });
			// DB call 1: wishlist + user leftJoin
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// No mod query (recipient match)
			// DB call 2: managerNames query — one regular správce
			mockDbInstance.pushResult([{ name: 'Jana' }]);

			const result = (await callGetWishlistByShortId(
				makeRecipientAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { managerNames: string[] };

			// recipientIsModerator=true counts the recipient as a správce in the header line.
			expect(result.managerNames).toEqual(['Recipient Alice', 'Jana']);
		});
	});

	describe('moderator role', () => {
		it('returns role=moderator when the user has an active moderator assignment', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user leftJoin
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// DB call 2: hasActiveModeratorAssignment → found
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);
			// DB call 3: managerNames query (runs for all lists) → none
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(
				makeModeratorAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string };

			expect(result.role).toBe('moderator');
		});
	});

	describe('for-someone list exposes managerNames', () => {
		it('returns coalesced recipientName as recipientDisplayName and the manager names list', async () => {
			const wishlistRow = makeForSomeoneWishlistRow();
			// DB call 1: wishlist + user leftJoin (no linked user → recipientName wins)
			mockDbInstance.pushResult([{ wishlist: wishlistRow, recipientDisplayName: 'Grandma' }]);
			// DB call 2: hasActiveModeratorAssignment → found (caller is a správce)
			mockDbInstance.pushResult([{ id: 'assignment-1' }]);
			// DB call 3: managerNames query (runs for all lists)
			mockDbInstance.pushResult([{ name: 'Martin' }, { name: 'Jana' }]);

			const result = (await callGetWishlistByShortId(
				makeModeratorAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string; recipientDisplayName: string; managerNames: string[] };

			expect(result.role).toBe('moderator');
			expect(result.recipientDisplayName).toBe('Grandma');
			expect(result.managerNames).toEqual(['Martin', 'Jana']);
		});
	});

	/**
	 * Issue #213, REQ-7: the release affordance must be decided on the server and shipped as a
	 * capability, because the administrator identity (`ADMIN_EMAILS`) is a private secret that
	 * must never reach the client. No `ADMIN_EMAILS` is configured in this suite, so these cases
	 * pin the non-administrator reach: a správce gets guest-only, everyone else nothing.
	 */
	describe('reservationReleaseCapability (issue #213)', () => {
		it('a správce gets guestOnly — today’s reach, computed server-side', async () => {
			const wishlistRow = makeWishlistRow();
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			mockDbInstance.pushResult([{ id: 'assignment-1' }]); // moderator assignment
			mockDbInstance.pushResult([]); // managerNames

			const result = (await callGetWishlistByShortId(
				makeModeratorAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { reservationReleaseCapability: string };

			expect(result.reservationReleaseCapability).toBe('guestOnly');
		});

		it('the obdarovaný gets none', async () => {
			const wishlistRow = makeWishlistRow();
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			mockDbInstance.pushResult([]); // managerNames

			const result = (await callGetWishlistByShortId(
				makeRecipientAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { reservationReleaseCapability: string };

			expect(result.reservationReleaseCapability).toBe('none');
		});

		it('a plain visitor gets none', async () => {
			const wishlistRow = makeWishlistRow();
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			mockDbInstance.pushResult([]); // no moderator assignment
			mockDbInstance.pushResult([]); // managerNames

			const result = (await callGetWishlistByShortId(
				makeOtherAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { reservationReleaseCapability: string };

			expect(result.reservationReleaseCapability).toBe('none');
		});
	});

	describe('visitor role – authenticated non-recipient/non-moderator', () => {
		it('returns role=visitor when the authed user has no special assignment', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user leftJoin
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// DB call 2: hasActiveModeratorAssignment → none found
			mockDbInstance.pushResult([]);
			// DB call 3: managerNames query (runs for all lists) → none
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(
				makeOtherAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string };

			expect(result.role).toBe('visitor');
		});
	});

	describe('visitor role – unauthenticated', () => {
		it('returns role=visitor when authContext is null', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user leftJoin
			mockDbInstance.pushResult([
				{ wishlist: wishlistRow, recipientDisplayName: 'Recipient Alice' },
			]);
			// No moderator check when unauthenticated
			// DB call 2: managerNames query (runs for all lists) → none
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(null, WISHLIST_SHORT_ID)) as {
				role: string;
			};

			expect(result.role).toBe('visitor');
		});
	});

	describe('wishlist not found', () => {
		it('throws 404 when no wishlist matches the shortId', async () => {
			// DB call 1: empty result
			mockDbInstance.pushResult([]);

			await expect(
				callGetWishlistByShortId(makeRecipientAuthContext(), 'nonexistent'),
			).rejects.toMatchObject({
				status: 404,
				message: 'Wishlist not found',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('unfollowWishlist', () => {
	describe('sets unfollowedAt on the follower record (no-op when no record matches)', () => {
		it('resolves without error regardless of whether a follower record matched', async () => {
			// DB call 1: update wishlistFollower – resolves whether or not a row matched
			mockDbInstance.pushResult([]);

			await expect(
				(unfollowWishlist as unknown as (...args: unknown[]) => unknown)(
					makeOtherAuthContext(),
					WISHLIST_ID,
				),
			).resolves.not.toThrow();
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('refollowWishlist', () => {
	describe('clears unfollowedAt and updates lastVisitedAt (no-op when no record matches)', () => {
		it('resolves without error regardless of whether a follower record matched', async () => {
			// DB call 1: update wishlistFollower – resolves whether or not a row matched
			mockDbInstance.pushResult([]);

			await expect(
				(refollowWishlist as unknown as (...args: unknown[]) => unknown)(
					makeOtherAuthContext(),
					WISHLIST_ID,
				),
			).resolves.not.toThrow();
		});
	});
});

// ── Statement budgets (issue #108, REQ-7) ─────────────────────────────────────

describe('statement budgets (issue #108, REQ-7)', () => {
	it('getWishlistByShortId (authed manager, self list) stays within 3 statements', async () => {
		// wishlist + user leftJoin, the moderator-assignment role check, and the manager-names
		// query (fetched for ALL lists — issue #158 "Spravuje {name}" header line). A draft list
		// skips the revert-capability reservation count (issue #150), so this is the floor.
		mockDbInstance.pushResult([
			{ wishlist: makeWishlistRow(), recipientDisplayName: 'Recipient Alice' },
		]);
		mockDbInstance.pushResult([{ id: 'assignment-1' }]);
		mockDbInstance.pushResult([]);

		await callGetWishlistByShortId(makeModeratorAuthContext(), WISHLIST_SHORT_ID);

		expect(mockDbInstance.statementCount()).toBeLessThanOrEqual(3);
	});
});

// ── recordWishlistVisit (issue #225) ─────────────────────────────────────────

type RecordWishlistVisitHandler = (auth: AuthContext, wishlistId: string) => Promise<void>;
const callRecordWishlistVisit = recordWishlistVisit as unknown as RecordWishlistVisitHandler;

describe('recordWishlistVisit', () => {
	it('throws 404 when the wishlist does not exist', async () => {
		mockDbInstance.pushResult([]); // wishlist lookup → none

		await expect(
			callRecordWishlistVisit(makeOtherAuthContext(), 'ghost'),
		).rejects.toMatchObject({ status: 404 });
	});

	it('upserts a visit for the linked recipient and never creates a follower row', async () => {
		// DB 1: wishlist lookup — caller IS the linked recipient
		mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
		// DB 2: visit upsert
		mockDbInstance.pushResult([]);

		await callRecordWishlistVisit(makeRecipientAuthContext(), WISHLIST_ID);

		// The visit is the ONLY insert — the recipient must never gain a follower row.
		expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({
			userId: RECIPIENT_ID,
			wishlistId: WISHLIST_ID,
		});
		expect(mockDbInstance.valuesPayloadAt(1)).toBeUndefined();
	});

	it('records a visit for a moderator without auto-following', async () => {
		// DB 1: wishlist lookup — caller is not the recipient
		mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
		// DB 2: visit upsert
		mockDbInstance.pushResult([]);
		// DB 3: active moderator-assignment check → found → manager
		mockDbInstance.pushResult([{ id: 'assignment-1' }]);

		await callRecordWishlistVisit(makeModeratorAuthContext(), WISHLIST_ID);

		// Visit recorded, but no follower insert for a manager.
		expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({
			userId: MODERATOR_ID,
			wishlistId: WISHLIST_ID,
		});
		expect(mockDbInstance.valuesPayloadAt(1)).toBeUndefined();
	});

	it('auto-follows a first-time visitor after recording the visit', async () => {
		// DB 1: wishlist lookup — caller is not the recipient
		mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
		// DB 2: visit upsert
		mockDbInstance.pushResult([]);
		// DB 3: moderator-assignment check → none
		mockDbInstance.pushResult([]);
		// DB 4: existing follower check → none
		mockDbInstance.pushResult([]);
		// DB 5: follower insert
		mockDbInstance.pushResult([]);

		await callRecordWishlistVisit(makeOtherAuthContext(), WISHLIST_ID);

		// First values() is the visit, second is the auto-follow follower row.
		expect(mockDbInstance.valuesPayloadAt(0)).toMatchObject({ userId: OTHER_USER_ID });
		expect(mockDbInstance.valuesPayloadAt(1)).toMatchObject({
			wishlistId: WISHLIST_ID,
			userId: OTHER_USER_ID,
		});
	});

	it('records a visit for an existing follower without inserting a duplicate follower', async () => {
		// DB 1: wishlist lookup
		mockDbInstance.pushResult([{ recipientUserId: RECIPIENT_ID }]);
		// DB 2: visit upsert
		mockDbInstance.pushResult([]);
		// DB 3: moderator check → none
		mockDbInstance.pushResult([]);
		// DB 4: existing follower check → found
		mockDbInstance.pushResult([{ unfollowedAt: null }]);

		await callRecordWishlistVisit(makeOtherAuthContext(), WISHLIST_ID);

		// Only the visit insert ran — no second follower insert.
		expect(mockDbInstance.valuesPayloadAt(1)).toBeUndefined();
	});
});

// ── Dashboard role predicates ────────────────────────────────────────────────

describe('dashboard role predicates', () => {
	it('attaches each role predicate while preserving archived dashboard history', async () => {
		mockDbInstance.pushResult([]);
		await callGetMyWishlists(makeRecipientAuthContext());
		const ownWhere = latestWherePayload();
		expectWhereToContain(ownWhere, 'eq', 'wishlist.recipientUserId', RECIPIENT_ID);
		expectWhereToContain(ownWhere, 'isNull', 'wishlist.deletedAt');
		expect(expressionTreeReferences(ownWhere, 'wishlist.status')).toBe(false);

		mockDbInstance.pushResult([]);
		await callGetModeratedWishlists(makeRecipientAuthContext());
		const moderatedWhere = latestWherePayload();
		expectWhereToContain(moderatedWhere, 'eq', 'moderatorAssignment.userId', RECIPIENT_ID);
		expectWhereToContain(moderatedWhere, 'isNull', 'moderatorAssignment.deletedAt');
		expectWhereToContain(moderatedWhere, 'isNull', 'wishlist.deletedAt');
		expect(expressionTreeReferences(moderatedWhere, 'wishlist.status')).toBe(false);

		mockDbInstance.pushResult([]);
		await callGetFollowedWishlists(makeRecipientAuthContext());
		const followedWhere = latestWherePayload();
		expectWhereToContain(followedWhere, 'eq', 'wishlistFollower.userId', RECIPIENT_ID);
		expectWhereToContain(
			followedWhere,
			'or',
			expression('isNull', 'wishlist.recipientUserId'),
			expression('ne', 'wishlist.recipientUserId', RECIPIENT_ID),
		);
		expectWhereToContain(followedWhere, 'isNull', 'wishlist.deletedAt');
		expectWhereNotToContain(followedWhere, 'isNull', 'wishlistFollower.unfollowedAt');
		expect(expressionTreeReferences(followedWhere, 'wishlist.status')).toBe(false);
	});
});

// ── getHomeOverview (issue #225) ─────────────────────────────────────────────

type GetHomeOverviewHandler = (userId: string) => Promise<{
	recent: unknown[];
	own: { items: Record<string, unknown>[]; total: number };
	moderated: { items: unknown[]; total: number };
	followed: { items: unknown[]; total: number };
}>;
const callGetHomeOverview = getHomeOverview as unknown as GetHomeOverviewHandler;

describe('getHomeOverview', () => {
	it('starts all three independent role queries before any query settles', async () => {
		mockDbInstance.pushResult([]);
		mockDbInstance.pushResult([]);
		mockDbInstance.pushResult([]);
		mockDbInstance.deferStatements();

		const overviewPromise = callGetHomeOverview(RECIPIENT_ID);
		await vi.waitFor(() => expect(mockDbInstance.statementCount()).toBe(3));
		mockDbInstance.releaseStatements();

		await expect(overviewPromise).resolves.toMatchObject({
			own: { total: 0 },
			moderated: { total: 0 },
			followed: { total: 0 },
		});
	});
	it('omits every reservation field from own dashboard and home results', async () => {
		const unsafeWishlist = makeWishlistRow({
			reservedGifts: 9,
			availableGifts: 8,
			myReservations: 7,
			myPurchased: 6,
		});
		mockDbInstance.pushResult([{ wishlist: unsafeWishlist, totalGifts: '3' }]); // dashboard own
		mockDbInstance.pushResult([
			{ wishlist: unsafeWishlist, totalGifts: '3', lastVisitedAt: null },
		]); // home own
		mockDbInstance.pushResult([]); // home moderated
		mockDbInstance.pushResult([]); // home followed

		const dashboard = await callGetMyWishlists(makeRecipientAuthContext());
		const home = await callGetHomeOverview(RECIPIENT_ID);

		for (const item of [dashboard[0]!, home.own.items[0]!]) {
			expect(item).not.toHaveProperty('reservedGifts');
			expect(item).not.toHaveProperty('availableGifts');
			expect(item).not.toHaveProperty('myReservations');
			expect(item).not.toHaveProperty('myPurchased');
		}
	});

	it('normalizes every role count to numbers in dashboard and home paths', async () => {
		const ownDbRow = { wishlist: makeWishlistRow(), totalGifts: '3' };
		const moderatedDbRow = {
			wishlist: makeForSomeoneWishlistRow(),
			recipientDisplayName: 'Grandma',
			totalGifts: '5',
			reservedGifts: '2',
		};
		const followedDbRow = {
			wishlist: makeForSomeoneWishlistRow(),
			recipientDisplayName: 'Grandma',
			availableGifts: '4',
			myReservations: '2',
			myPurchased: '1',
			unfollowedAt: null,
		};
		mockDbInstance.pushResult([ownDbRow]);
		mockDbInstance.pushResult([moderatedDbRow]);
		mockDbInstance.pushResult([followedDbRow]);
		mockDbInstance.pushResult([{ ...ownDbRow, lastVisitedAt: null }]);
		mockDbInstance.pushResult([{ ...moderatedDbRow, lastVisitedAt: null }]);
		mockDbInstance.pushResult([{ ...followedDbRow, followDate: null, lastVisitedAt: null }]);

		const dashboardOwn = await callGetMyWishlists(makeRecipientAuthContext());
		const dashboardModerated = await callGetModeratedWishlists(makeModeratorAuthContext());
		const dashboardFollowed = await callGetFollowedWishlists(makeOtherAuthContext());
		const home = await callGetHomeOverview(RECIPIENT_ID);

		expect(dashboardOwn[0]).toMatchObject({ totalGifts: 3 });
		expect(dashboardModerated[0]).toMatchObject({ totalGifts: 5, reservedGifts: 2 });
		expect(dashboardFollowed[0]).toMatchObject({
			availableGifts: 4,
			myReservations: 2,
			myPurchased: 1,
		});
		expect(home.own.items[0]).toMatchObject({ totalGifts: 3 });
		expect(home.moderated.items[0]).toMatchObject({ totalGifts: 5, reservedGifts: 2 });
		expect(home.followed.items[0]).toMatchObject({
			availableGifts: 4,
			myReservations: 2,
			myPurchased: 1,
		});
	});

	it('attaches each shared role predicate and home-only filter to its outer query', async () => {
		mockDbInstance.pushResult([]); // own
		mockDbInstance.pushResult([]); // moderated
		mockDbInstance.pushResult([]); // followed

		await callGetHomeOverview(RECIPIENT_ID);

		const wherePayloads = mockDbInstance.wherePayloads();
		const ownWhere = findWhereContaining(
			wherePayloads,
			'eq',
			'wishlist.recipientUserId',
			RECIPIENT_ID,
		);
		const moderatedWhere = findWhereContaining(
			wherePayloads,
			'eq',
			'moderatorAssignment.userId',
			RECIPIENT_ID,
		);
		const followedWhere = findWhereContaining(
			wherePayloads,
			'eq',
			'wishlistFollower.userId',
			RECIPIENT_ID,
		);

		expectWhereToContain(ownWhere, 'isNull', 'wishlist.deletedAt');
		expectWhereToContain(moderatedWhere, 'isNull', 'moderatorAssignment.deletedAt');
		expectWhereToContain(moderatedWhere, 'isNull', 'wishlist.deletedAt');
		expectWhereToContain(
			followedWhere,
			'or',
			expression('isNull', 'wishlist.recipientUserId'),
			expression('ne', 'wishlist.recipientUserId', RECIPIENT_ID),
		);
		expectWhereToContain(followedWhere, 'isNull', 'wishlistFollower.unfollowedAt');
		expectWhereToContain(followedWhere, 'isNull', 'wishlist.deletedAt');
	});

	function ownRow(overrides: Record<string, unknown> = {}) {
		return {
			wishlist: makeWishlistRow(overrides),
			totalGifts: 3,
			lastVisitedAt: null,
			...overrides,
		};
	}

	it('keeps dashboard history while home applies active-follow and non-archived filters', async () => {
		const archivedOwn = { wishlist: makeWishlistRow({ status: 'archived' }), totalGifts: '3' };
		const historicalFollow = {
			wishlist: makeForSomeoneWishlistRow({ status: 'archived' }),
			recipientDisplayName: 'Grandma',
			availableGifts: '1',
			myReservations: '0',
			myPurchased: '0',
			unfollowedAt: new Date('2026-01-01'),
		};
		mockDbInstance.pushResult([archivedOwn]);
		mockDbInstance.pushResult([historicalFollow]);

		const ownDashboard = await callGetMyWishlists(makeRecipientAuthContext());
		const ownDashboardWhere = latestWherePayload();
		expect(expressionTreeReferences(ownDashboardWhere, 'wishlist.status')).toBe(false);
		const followedDashboard = await callGetFollowedWishlists(makeRecipientAuthContext());
		const followedDashboardWhere = latestWherePayload();
		expect(ownDashboard).toHaveLength(1);
		expect(followedDashboard).toHaveLength(1);
		expectWhereNotToContain(followedDashboardWhere, 'isNull', 'wishlistFollower.unfollowedAt');
		expect(expressionTreeReferences(followedDashboardWhere, 'wishlist.status')).toBe(false);

		const homeWhereStart = mockDbInstance.wherePayloads().length;
		mockDbInstance.pushResult([{ ...archivedOwn, lastVisitedAt: null }]);
		mockDbInstance.pushResult([]);
		mockDbInstance.pushResult([]);
		const home = await callGetHomeOverview(RECIPIENT_ID);
		const homeWherePayloads = mockDbInstance.wherePayloads().slice(homeWhereStart);
		const followedHomeWhere = findWhereContaining(
			homeWherePayloads,
			'eq',
			'wishlistFollower.userId',
			RECIPIENT_ID,
		);

		expect(home.own.total).toBe(0);
		expectWhereToContain(followedHomeWhere, 'isNull', 'wishlistFollower.unfollowedAt');
	});

	it('caps each category at 10 items while reporting the true total, excluding archived', async () => {
		// Own: 11 active + 1 archived → total 11, items capped at 10.
		const ownRows = [
			...Array.from({ length: 11 }, (_unused, index) =>
				ownRow({ id: `own-${index}`, status: 'active' }),
			),
			ownRow({ id: 'own-archived', status: 'archived' }),
		];
		mockDbInstance.pushResult(ownRows); // own select
		mockDbInstance.pushResult([]); // moderated select
		mockDbInstance.pushResult([]); // followed select

		const result = await callGetHomeOverview(RECIPIENT_ID);

		expect(result.own.total).toBe(11);
		expect(result.own.items).toHaveLength(10);
	});

	it('own rows expose a gift count', async () => {
		mockDbInstance.pushResult([ownRow({ id: 'own-1', status: 'active' })]); // own
		mockDbInstance.pushResult([]); // moderated
		mockDbInstance.pushResult([]); // followed

		const result = await callGetHomeOverview(RECIPIENT_ID);

		expect(result.own.items[0]).toHaveProperty('totalGifts');
	});

	it('builds the Nedávné row across all roles, capped at 6', async () => {
		const ownRows = Array.from({ length: 4 }, (_unused, index) =>
			ownRow({
				id: `own-${index}`,
				status: 'active',
				lastVisitedAt: new Date(2026, 0, index + 1),
			}),
		);
		const moderatedRows = Array.from({ length: 4 }, (_unused, index) => ({
			wishlist: makeForSomeoneWishlistRow({ id: `mod-${index}`, status: 'active' }),
			recipientDisplayName: 'Grandma',
			totalGifts: 5,
			reservedGifts: 2,
			lastVisitedAt: new Date(2026, 1, index + 1),
		}));
		mockDbInstance.pushResult(ownRows); // own
		mockDbInstance.pushResult(moderatedRows); // moderated
		mockDbInstance.pushResult([]); // followed

		const result = await callGetHomeOverview(RECIPIENT_ID);

		// 8 candidates across two roles, Nedávné caps at 6.
		// Moderated rows (Feb) are strictly more recent than own rows (Jan), so all four
		// moderated survive plus the two most-recent own; least-recent own drop off.
		expect(result.recent).toHaveLength(6);
		expect(result.recent.map((item) => (item as { id: string }).id)).toEqual([
			'mod-3',
			'mod-2',
			'mod-1',
			'mod-0',
			'own-3',
			'own-2',
		]);
	});

	it('shows a wishlist held in multiple roles only once in Nedávné, keeping the higher-priority role', async () => {
		const shared = { id: 'wl-shared', status: 'active' };
		const visitedAt = new Date(2026, 5, 1);
		mockDbInstance.pushResult([]); // own
		mockDbInstance.pushResult([
			{
				wishlist: makeForSomeoneWishlistRow(shared),
				recipientDisplayName: 'Grandma',
				totalGifts: 5,
				reservedGifts: 2,
				lastVisitedAt: visitedAt,
			},
		]); // moderated
		mockDbInstance.pushResult([
			{
				wishlist: makeForSomeoneWishlistRow(shared),
				recipientDisplayName: 'Grandma',
				availableGifts: 3,
				myReservations: 1,
				myPurchased: 0,
				unfollowedAt: null,
				followDate: new Date(2026, 0, 1),
				lastVisitedAt: visitedAt,
			},
		]); // followed

		const result = await callGetHomeOverview(RECIPIENT_ID);

		// Nedávné is a per-list recency shortcut: one card per wishlist, even when the
		// caller both moderates and follows it. Moderator outranks follower.
		const sharedRecent = result.recent.filter(
			(item) => (item as { id: string }).id === 'wl-shared',
		);
		expect(sharedRecent).toHaveLength(1);
		expect((sharedRecent[0] as { role: string }).role).toBe('moderated');
		// The category rows still list it under each role independently.
		expect(result.moderated.total).toBe(1);
		expect(result.followed.total).toBe(1);
	});
});
