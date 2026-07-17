import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

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

// ── Mock drizzle-orm – used only as where-clause builders; no-ops are fine ───
vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => args),
	and: vi.fn((...args: unknown[]) => args),
	isNull: vi.fn((arg: unknown) => arg),
	sql: vi.fn(),
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
	reset: () => void;
}

function createMockDb(): MockDb {
	const results: unknown[][] = [];
	const indexRef = { value: 0 };
	const setPayloads: Record<string, unknown>[] = [];
	const valuesPayloads: Record<string, unknown>[] = [];

	const chain: Record<string | symbol, unknown> = new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'then') {
					const result = results[indexRef.value] ?? [];
					indexRef.value++;
					return (resolve: (value: unknown) => void) => resolve(result);
				}
				if (prop === 'transaction') {
					return vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
						callback(chain),
					);
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
				return vi.fn(() => chain);
			},
		},
	);

	return {
		db: chain,
		pushResult: (result: unknown[]) => results.push(result),
		lastSetPayload: () => setPayloads[setPayloads.length - 1],
		lastValuesPayload: () => valuesPayloads[valuesPayloads.length - 1],
		reset: () => {
			results.length = 0;
			indexRef.value = 0;
			setPayloads.length = 0;
			valuesPayloads.length = 0;
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
} from './wishlists.remote.js';
import { FlipRecipientToFreeTextInputSchema } from './types.js';
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
			const updatedRow = makeWishlistRow({ imageKey: 'wishlists/hero.jpg', imageSlots });
			// DB call 1: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				imageKey: 'wishlists/hero.jpg',
				imageSlots,
			});

			expect(result).toMatchObject({ imageKey: 'wishlists/hero.jpg', imageSlots });
		});

		it('deletes the replaced uploaded image from storage (issue #107 REQ-6)', async () => {
			mockDbInstance.pushResult([
				makeWishlistRow({ sharedAt: null, imageKey: 'wishlists/banners/old.jpg' }),
			]);
			mockDbInstance.pushResult([makeWishlistRow({ imageKey: 'wishlists/banners/new.jpg' })]);

			await callUpdateWishlist(makeRecipientAuthContext(), {
				id: WISHLIST_ID,
				imageKey: 'wishlists/banners/new.jpg',
			});

			expect(mockDeleteObjects).toHaveBeenCalledWith(['wishlists/banners/old.jpg']);
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
