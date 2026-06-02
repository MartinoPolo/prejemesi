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

// ── Mock remote wrappers — attach .__  so init_remote_functions validator passes
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

// ── Mock drizzle-orm — used only as where-clause builders; no-ops are fine ───
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
		ownerId: 'wishlist.ownerId',
		shortId: 'wishlist.shortId',
		status: 'wishlist.status',
		sharedAt: 'wishlist.sharedAt',
		deletedAt: 'wishlist.deletedAt',
		createdAt: 'wishlist.createdAt',
		updatedAt: 'wishlist.updatedAt',
		ownerIsModerator: 'wishlist.ownerIsModerator',
		title: 'wishlist.title',
		description: 'wishlist.description',
		eventDate: 'wishlist.eventDate',
		theme: 'wishlist.theme',
		customThemeColor: 'wishlist.customThemeColor',
		bannerImageKey: 'wishlist.bannerImageKey',
		thumbnailImageKey: 'wishlist.thumbnailImageKey',
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
		wishlistId: 'moderatorAssignment.wishlistId',
		userId: 'moderatorAssignment.userId',
		deletedAt: 'moderatorAssignment.deletedAt',
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
	},
}));

// ── DB mock helper ────────────────────────────────────────────────────────────

interface MockDb {
	db: Record<string | symbol, unknown>;
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
					return (resolve: (value: unknown) => void) => resolve(result);
				}
				if (prop === 'transaction') {
					return vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
						callback(chain),
					);
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

// ── Mock getDb ────────────────────────────────────────────────────────────────

const mockDbInstance = createMockDb();

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(() => mockDbInstance.db),
}));

// ── Import the module under test (after all mocks are set up) ─────────────────

import {
	deleteWishlist,
	updateWishlist,
	archiveWishlist,
	createWishlist,
	followWishlist,
	unfollowWishlist,
	refollowWishlist,
	getWishlistByShortId,
} from './wishlists.remote.js';

// ── Test data factories ───────────────────────────────────────────────────────

const OWNER_ID = 'user-owner';
const OTHER_USER_ID = 'user-other';
const MODERATOR_ID = 'user-moderator';
const WISHLIST_ID = 'wishlist-1';
const WISHLIST_SHORT_ID = 'abc12345';

function makeWishlistRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: WISHLIST_ID,
		shortId: WISHLIST_SHORT_ID,
		ownerId: OWNER_ID,
		title: 'Test Wishlist',
		description: null,
		status: 'draft',
		sharedAt: null,
		deletedAt: null,
		archivedAt: null,
		eventDate: null,
		theme: 'default',
		customThemeColor: null,
		bannerImageKey: null,
		thumbnailImageKey: null,
		ownerIsModerator: false,
		createdAt: new Date('2024-01-01T00:00:00Z'),
		updatedAt: new Date('2024-01-01T00:00:00Z'),
		...overrides,
	};
}

function makeOwnerAuthContext(): { user: { id: string } } {
	return { user: { id: OWNER_ID } };
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

const callDeleteWishlist = deleteWishlist as unknown as DeleteWishlistHandler;
const callUpdateWishlist = updateWishlist as unknown as UpdateWishlistHandler;
const callArchiveWishlist = archiveWishlist as unknown as ArchiveWishlistHandler;
const callCreateWishlist = createWishlist as unknown as CreateWishlistHandler;
const callFollowWishlist = followWishlist as unknown as FollowWishlistHandler;
const callGetWishlistByShortId = getWishlistByShortId as unknown as GetWishlistByShortIdHandler;

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	mockDbInstance.reset();
	vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deleteWishlist', () => {
	describe('owner can delete an unshared wishlist', () => {
		it('resolves without throwing when owner deletes a draft wishlist', async () => {
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: soft-delete update
			mockDbInstance.pushResult([]);

			await expect(
				callDeleteWishlist(makeOwnerAuthContext(), WISHLIST_ID),
			).resolves.not.toThrow();
		});
	});

	describe('non-owner cannot delete', () => {
		it('throws 403 when caller is not the wishlist owner', async () => {
			// DB call 1: wishlist lookup (owned by OWNER_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);

			await expect(
				callDeleteWishlist(makeOtherAuthContext(), WISHLIST_ID),
			).rejects.toMatchObject({
				status: 403,
				message: 'Not authorized',
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
				callDeleteWishlist(makeOwnerAuthContext(), WISHLIST_ID),
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
				callDeleteWishlist(makeOwnerAuthContext(), 'ghost-wishlist'),
			).rejects.toMatchObject({
				status: 404,
				message: 'Wishlist not found',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('updateWishlist', () => {
	describe('owner can update title on an unshared wishlist', () => {
		it('returns updated wishlist row', async () => {
			const updatedRow = makeWishlistRow({ title: 'New Title' });
			// DB call 1: wishlist lookup (not shared)
			mockDbInstance.pushResult([makeWishlistRow({ sharedAt: null })]);
			// DB call 2: update returning
			mockDbInstance.pushResult([updatedRow]);

			const result = await callUpdateWishlist(makeOwnerAuthContext(), {
				id: WISHLIST_ID,
				title: 'New Title',
			});

			expect(result).toMatchObject({ id: WISHLIST_ID, title: 'New Title' });
		});
	});

	describe('non-owner cannot update', () => {
		it('throws 403 when caller is not the wishlist owner', async () => {
			// DB call 1: wishlist lookup (owned by OWNER_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);

			await expect(
				callUpdateWishlist(makeOtherAuthContext(), {
					id: WISHLIST_ID,
					title: 'Hacked Title',
				}),
			).rejects.toMatchObject({
				status: 403,
				message: 'Not authorized',
			});
		});
	});

	describe('archived wishlist cannot be updated', () => {
		it('throws 400 when wishlist status is archived', async () => {
			mockDbInstance.pushResult([makeWishlistRow({ status: 'archived' })]);

			await expect(
				callUpdateWishlist(makeOwnerAuthContext(), {
					id: WISHLIST_ID,
					title: 'Should Fail',
				}),
			).rejects.toMatchObject({
				status: 400,
				message: 'CANNOT_MODIFY_ARCHIVED_WISHLIST',
			});
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

			// Should NOT throw — eventDate change is silently dropped
			const result = await callUpdateWishlist(makeOwnerAuthContext(), {
				id: WISHLIST_ID,
				title: 'Updated Title',
				eventDate: new Date('2025-12-25T00:00:00Z'),
			});

			expect(result).toMatchObject({ id: WISHLIST_ID });
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('archiveWishlist', () => {
	describe('owner can archive', () => {
		it('returns the archived wishlist row', async () => {
			const archivedRow = makeWishlistRow({ status: 'archived', archivedAt: new Date() });
			// DB call 1: wishlist lookup
			mockDbInstance.pushResult([makeWishlistRow()]);
			// DB call 2: update returning
			mockDbInstance.pushResult([archivedRow]);

			const result = await callArchiveWishlist(makeOwnerAuthContext(), WISHLIST_ID);

			expect(result).toMatchObject({ id: WISHLIST_ID, status: 'archived' });
		});
	});

	describe('non-owner cannot archive', () => {
		it('throws 403 when caller is not the wishlist owner', async () => {
			// DB call 1: wishlist lookup (owned by OWNER_ID, caller is OTHER_USER_ID)
			mockDbInstance.pushResult([makeWishlistRow()]);

			await expect(
				callArchiveWishlist(makeOtherAuthContext(), WISHLIST_ID),
			).rejects.toMatchObject({
				status: 403,
				message: 'Not authorized',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('createWishlist', () => {
	describe('creates wishlist with default priority levels', () => {
		it('returns the created wishlist row after inserting default priority levels', async () => {
			const createdRow = makeWishlistRow({ id: 'new-wishlist-id', title: 'My Birthday' });
			// DB call 1: insert wishlist returning
			mockDbInstance.pushResult([createdRow]);
			// DB call 2: insert default priority levels (no returning needed)
			mockDbInstance.pushResult([]);

			const result = await callCreateWishlist(makeOwnerAuthContext(), {
				title: 'My Birthday',
			});

			expect(result).toMatchObject({ id: 'new-wishlist-id', title: 'My Birthday' });
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('followWishlist', () => {
	describe('owner cannot follow own wishlist', () => {
		it('returns { followed: false, alreadyFollowing: false } without creating a record', async () => {
			// DB call 1: wishlist lookup — owner is the caller
			mockDbInstance.pushResult([{ ownerId: OWNER_ID }]);

			const result = await callFollowWishlist(makeOwnerAuthContext(), WISHLIST_ID);

			expect(result).toEqual({ followed: false, alreadyFollowing: false });
		});
	});

	describe('new visitor follows for the first time', () => {
		it('creates a new follower record and returns { followed: true, alreadyFollowing: false }', async () => {
			// DB call 1: wishlist lookup — owner is different user
			mockDbInstance.pushResult([{ ownerId: OWNER_ID }]);
			// DB call 2: existing follower check — none found
			mockDbInstance.pushResult([]);
			// DB call 3: insert follower
			mockDbInstance.pushResult([]);

			const result = await callFollowWishlist(makeOtherAuthContext(), WISHLIST_ID);

			expect(result).toEqual({ followed: true, alreadyFollowing: false });
		});
	});

	describe('returning visitor updates lastVisitedAt', () => {
		it('returns { followed: false, alreadyFollowing: true } when record exists with unfollowedAt=null', async () => {
			// DB call 1: wishlist lookup — owner is different user
			mockDbInstance.pushResult([{ ownerId: OWNER_ID }]);
			// DB call 2: existing follower check — record found, not unfollowed
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
			mockDbInstance.pushResult([{ ownerId: OWNER_ID }]);
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
	describe('owner role', () => {
		it('returns role=owner when authenticated user is the wishlist owner', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user join
			mockDbInstance.pushResult([{ wishlist: wishlistRow, ownerName: 'Alice' }]);
			// No DB call 2: owner check skips moderator query

			const result = (await callGetWishlistByShortId(
				makeOwnerAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string };

			expect(result.role).toBe('owner');
		});
	});

	describe('moderator role', () => {
		it('returns role=moderator when user has an active moderator assignment', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user join
			mockDbInstance.pushResult([{ wishlist: wishlistRow, ownerName: 'Alice' }]);
			// DB call 2: moderator assignment found
			mockDbInstance.pushResult([{ wishlistId: WISHLIST_ID, userId: MODERATOR_ID }]);

			const result = (await callGetWishlistByShortId(
				makeModeratorAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string };

			expect(result.role).toBe('moderator');
		});
	});

	describe('visitor role — authenticated non-owner/non-moderator', () => {
		it('returns role=visitor when authenticated user has no special assignment', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user join
			mockDbInstance.pushResult([{ wishlist: wishlistRow, ownerName: 'Alice' }]);
			// DB call 2: moderator check — none found
			mockDbInstance.pushResult([]);

			const result = (await callGetWishlistByShortId(
				makeOtherAuthContext(),
				WISHLIST_SHORT_ID,
			)) as { role: string };

			expect(result.role).toBe('visitor');
		});
	});

	describe('visitor role — unauthenticated', () => {
		it('returns role=visitor when authContext is null', async () => {
			const wishlistRow = makeWishlistRow();
			// DB call 1: wishlist + user join
			mockDbInstance.pushResult([{ wishlist: wishlistRow, ownerName: 'Alice' }]);
			// No moderator check when unauthenticated

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
				callGetWishlistByShortId(makeOwnerAuthContext(), 'nonexistent'),
			).rejects.toMatchObject({
				status: 404,
				message: 'Wishlist not found',
			});
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('unfollowWishlist', () => {
	describe('sets unfollowedAt on the follower record', () => {
		it('resolves without error when follower record exists', async () => {
			// DB call 1: update wishlistFollower — row matched and updated
			mockDbInstance.pushResult([]);

			await expect(
				(unfollowWishlist as unknown as (...args: unknown[]) => unknown)(
					makeOtherAuthContext(),
					WISHLIST_ID,
				),
			).resolves.not.toThrow();
		});
	});

	describe('completes without error even if no follower record exists (no-op update)', () => {
		it('resolves without error when no matching follower record exists', async () => {
			// DB call 1: update wishlistFollower — no rows matched (no-op)
			mockDbInstance.pushResult([]);

			await expect(
				(unfollowWishlist as unknown as (...args: unknown[]) => unknown)(
					makeOtherAuthContext(),
					'nonexistent-wishlist',
				),
			).resolves.not.toThrow();
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('refollowWishlist', () => {
	describe('clears unfollowedAt and updates lastVisitedAt', () => {
		it('resolves without error when follower record exists', async () => {
			// DB call 1: update wishlistFollower — row matched and updated
			mockDbInstance.pushResult([]);

			await expect(
				(refollowWishlist as unknown as (...args: unknown[]) => unknown)(
					makeOtherAuthContext(),
					WISHLIST_ID,
				),
			).resolves.not.toThrow();
		});
	});

	describe('completes without error even if no follower record exists (no-op update)', () => {
		it('resolves without error when no matching follower record exists', async () => {
			// DB call 1: update wishlistFollower — no rows matched (no-op)
			mockDbInstance.pushResult([]);

			await expect(
				(refollowWishlist as unknown as (...args: unknown[]) => unknown)(
					makeOtherAuthContext(),
					'nonexistent-wishlist',
				),
			).resolves.not.toThrow();
		});
	});
});
