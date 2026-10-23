import {
	DB_READY,
	captureError,
	createWishlistFixture,
	expectRejection,
	managerActor,
	outsiderActor,
	recipientActor,
	removeFixtureRows,
	seedFixtureUsers,
	MANAGER_ID,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { createUploadToken, TOKEN_PURPOSES } from '$lib/server/crypto/upload_token.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { RECIPIENT_KIND } from '$lib/modules/wishlists/types.js';
import {
	DEFAULT_WISHLIST_BACKGROUND,
	type WishlistBackground,
} from '$lib/theme/wishlist_themes.js';
import { executeOperation } from './runner.js';
import {
	createWishlistOperation,
	saveWishlistSettingsOperation,
} from './wishlist_detail_operations.js';
import { deleteWishlistOperation } from './wishlist_lifecycle_operations.js';
import { readWishlistOperation } from './wishlist_read_operations.js';

const SIGNING_KEY = 'wishlist-appearance-test-signing-secret';
vi.mock('$lib/server/crypto/auth_signing_key.js', () => ({
	getAuthSigningKey: () => 'wishlist-appearance-test-signing-secret',
}));

async function assignmentToken(objectKey: string, userId = MANAGER_ID): Promise<string> {
	return (await createUploadToken(objectKey, userId, SIGNING_KEY, TOKEN_PURPOSES.delete)).token;
}

function customBackground(imageKey: string): WishlistBackground {
	return { ...DEFAULT_WISHLIST_BACKGROUND, mode: 'custom', imageKey };
}

async function readAppearance(wishlistId: string) {
	const [row] = await getDb()
		.select({
			themeId: wishlist.themeId,
			styleTokens: wishlist.styleTokens,
			background: wishlist.background,
			palette: wishlist.palette,
		})
		.from(wishlist)
		.where(eq(wishlist.id, wishlistId));
	if (row === undefined) {
		throw new Error(`Missing wishlist ${wishlistId}`);
	}
	return row;
}

function deletedObjectKeys(): string[] {
	return vi
		.mocked(deleteObjectsBestEffort)
		.mock.calls.flatMap(([objectKeys]) =>
			objectKeys.filter((objectKey): objectKey is string => typeof objectKey === 'string'),
		);
}

describe.skipIf(!DB_READY)('wishlist appearance [real DB]', () => {
	beforeAll(seedFixtureUsers);

	beforeEach(() => {
		vi.mocked(deleteObjectsBestEffort).mockClear();
	});

	afterAll(removeFixtureRows);

	describe('settings save', () => {
		it('persists the theme, explicit token overrides and background, then clears them', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const background: WishlistBackground = {
				...DEFAULT_WISHLIST_BACKGROUND,
				mode: 'none',
				dim: 40,
			};

			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				palette: 'graphite',
				appearance: { themeId: 'minimal', styleTokens: { corners: 'round' }, background },
			});
			expect(await readAppearance(wishlistId)).toEqual({
				themeId: 'minimal',
				styleTokens: { corners: 'round' },
				background,
				palette: 'graphite',
			});

			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: { themeId: null, styleTokens: null, background: null },
			});
			expect(await readAppearance(wishlistId)).toMatchObject({
				themeId: null,
				styleTokens: null,
				background: null,
			});
		});

		it('stores an empty override set as no override', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			await executeOperation(recipientActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: { themeId: 'toys', styleTokens: {}, background: null },
			});
			expect(await readAppearance(wishlistId)).toMatchObject({
				themeId: 'toys',
				styleTokens: null,
			});
		});

		it('keeps the stored appearance when the draft has no appearance changes', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: { themeId: 'books', styleTokens: null, background: null },
			});
			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				details: { title: 'Renamed', description: null },
			});
			expect((await readAppearance(wishlistId)).themeId).toBe('books');
		});

		it.each([
			['an unknown theme', { themeId: 'halloween', styleTokens: null, background: null }],
			[
				'an unknown token',
				{ themeId: null, styleTokens: { glow: 'neon' }, background: null },
			],
			[
				'a dim above the maximum',
				{
					themeId: null,
					styleTokens: null,
					background: { ...DEFAULT_WISHLIST_BACKGROUND, dim: 90 },
				},
			],
		])('rejects %s', async (_label, appearance) => {
			const { id: wishlistId } = await createWishlistFixture();
			const thrown = await captureError(
				executeOperation(managerActor, saveWishlistSettingsOperation, {
					wishlistId,
					appearance,
				}),
			);
			expect(thrown).toMatchObject({ status: 400 });
			expect((await readAppearance(wishlistId)).themeId).toBeNull();
		});

		it('denies an outsider', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			await expectRejection(
				executeOperation(outsiderActor, saveWishlistSettingsOperation, {
					wishlistId,
					appearance: { themeId: 'toys', styleTokens: null, background: null },
				}),
				403,
				SERVER_ERROR.ACCESS_DENIED,
			);
		});
	});

	describe('custom background upload', () => {
		it('rejects a new background key without its assignment proof', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			await expectRejection(
				executeOperation(managerActor, saveWishlistSettingsOperation, {
					wishlistId,
					appearance: {
						themeId: null,
						styleTokens: null,
						background: customBackground('wishlists/backgrounds/planted.webp'),
					},
				}),
				403,
				SERVER_ERROR.ACCESS_DENIED,
			);
			expect((await readAppearance(wishlistId)).background).toBeNull();
		});

		it('rejects a key outside the background prefix even with a valid proof', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const bannerKey = 'wishlists/banners/owned.webp';
			await expectRejection(
				executeOperation(managerActor, saveWishlistSettingsOperation, {
					wishlistId,
					appearance: {
						themeId: null,
						styleTokens: null,
						background: customBackground(bannerKey),
						backgroundAssignmentToken: await assignmentToken(bannerKey),
					},
				}),
				403,
				SERVER_ERROR.ACCESS_DENIED,
			);
		});

		it('deletes the replaced background after commit, and the cleared one too', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const firstKey = `wishlists/backgrounds/${wishlistId}-first.webp`;
			const secondKey = `wishlists/backgrounds/${wishlistId}-second.webp`;

			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: {
					themeId: null,
					styleTokens: null,
					background: customBackground(firstKey),
					backgroundAssignmentToken: await assignmentToken(firstKey),
				},
			});
			expect((await readAppearance(wishlistId)).background).toMatchObject({
				imageKey: firstKey,
			});
			expect(deletedObjectKeys()).toEqual([]);

			// Switching mode keeps the stored upload, so no proof is needed and nothing is deleted.
			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: {
					themeId: 'space',
					styleTokens: null,
					background: { ...customBackground(firstKey), mode: 'theme' },
				},
			});
			expect(deletedObjectKeys()).toEqual([]);

			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: {
					themeId: 'space',
					styleTokens: null,
					background: customBackground(secondKey),
					backgroundAssignmentToken: await assignmentToken(secondKey),
				},
			});
			expect(deletedObjectKeys()).toEqual([firstKey]);

			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: { themeId: 'space', styleTokens: null, background: null },
			});
			expect(deletedObjectKeys()).toEqual([firstKey, secondKey]);
		});

		async function storeCustomBackground(wishlistId: string): Promise<string> {
			const backgroundKey = `wishlists/backgrounds/${wishlistId}-kept.webp`;
			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: {
					themeId: null,
					styleTokens: null,
					background: customBackground(backgroundKey),
					backgroundAssignmentToken: await assignmentToken(backgroundKey),
				},
			});
			return backgroundKey;
		}

		function withoutImageKey(
			background: WishlistBackground,
		): Omit<WishlistBackground, 'imageKey'> {
			const { imageKey: _omitted, ...backgroundWithoutImageKey } = background;
			return backgroundWithoutImageKey;
		}

		it('keeps the stored upload when a save omits the image key', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const backgroundKey = await storeCustomBackground(wishlistId);

			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: {
					themeId: 'books',
					styleTokens: null,
					background: { ...withoutImageKey(customBackground(backgroundKey)), dim: 40 },
				},
			});

			expect((await readAppearance(wishlistId)).background).toEqual({
				...customBackground(backgroundKey),
				dim: 40,
			});
			expect(deletedObjectKeys()).toEqual([]);
		});

		it('keeps the stored upload when a mode switch omits the image key', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const backgroundKey = await storeCustomBackground(wishlistId);

			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: {
					themeId: 'space',
					styleTokens: null,
					background: {
						...withoutImageKey(customBackground(backgroundKey)),
						mode: 'theme',
					},
				},
			});

			expect((await readAppearance(wishlistId)).background).toEqual({
				...customBackground(backgroundKey),
				mode: 'theme',
			});
			expect(deletedObjectKeys()).toEqual([]);
		});

		it('clears and deletes the stored upload when a save sends a null image key', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const backgroundKey = await storeCustomBackground(wishlistId);

			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: {
					themeId: null,
					styleTokens: null,
					background: { ...DEFAULT_WISHLIST_BACKGROUND, imageKey: null },
				},
			});

			expect((await readAppearance(wishlistId)).background).toEqual({
				...DEFAULT_WISHLIST_BACKGROUND,
				imageKey: null,
			});
			expect(deletedObjectKeys()).toEqual([backgroundKey]);
		});

		it('deletes the background upload with a deleted wishlist', async () => {
			const { id: wishlistId } = await createWishlistFixture();
			const backgroundKey = `wishlists/backgrounds/${wishlistId}.webp`;
			await executeOperation(managerActor, saveWishlistSettingsOperation, {
				wishlistId,
				appearance: {
					themeId: null,
					styleTokens: null,
					background: customBackground(backgroundKey),
					backgroundAssignmentToken: await assignmentToken(backgroundKey),
				},
			});

			await executeOperation(managerActor, deleteWishlistOperation, { wishlistId });

			expect(deletedObjectKeys()).toContain(backgroundKey);
		});
	});

	describe('read', () => {
		it('reads a retired theme id and unknown stored tokens as the default look', async () => {
			const { id: wishlistId, shortId } = await createWishlistFixture();
			await getDb()
				.update(wishlist)
				.set({
					themeId: sql`'retired-theme'`,
					styleTokens: sql`'{"corners":"wavy","border":"fine","glow":"neon"}'::jsonb`,
				})
				.where(eq(wishlist.id, wishlistId));

			const read = await executeOperation(managerActor, readWishlistOperation, {
				wishlistShortId: shortId,
			});

			expect(read.themeId).toBeNull();
			expect(read.styleTokens).toEqual({ border: 'fine' });
		});
	});

	describe('creation', () => {
		it('defaults an occasion theme and its palette from the title', async () => {
			const created = await executeOperation(recipientActor, createWishlistOperation, {
				recipientKind: RECIPIENT_KIND.self,
				title: 'Vánoce u babičky',
			});
			expect(created).toMatchObject({ themeId: 'christmas', palette: 'ruby' });
		});

		it('defaults the Christmas theme from a December event date', async () => {
			const created = await executeOperation(recipientActor, createWishlistOperation, {
				recipientKind: RECIPIENT_KIND.self,
				title: 'Přání',
				eventDate: new Date(Date.UTC(new Date().getUTCFullYear() + 1, 11, 23, 23)),
			});
			expect(created.themeId).toBe('christmas');
		});

		it('keeps a palette the creator chose explicitly', async () => {
			const created = await executeOperation(recipientActor, createWishlistOperation, {
				recipientKind: RECIPIENT_KIND.self,
				title: 'Svatba Jany',
				palette: 'mint',
			});
			expect(created).toMatchObject({ themeId: 'wedding', palette: 'mint' });
		});

		it('leaves a wishlist without an implied occasion unthemed', async () => {
			const created = await executeOperation(recipientActor, createWishlistOperation, {
				recipientKind: RECIPIENT_KIND.self,
				title: 'Narozeniny',
			});
			expect(created).toMatchObject({ themeId: null, palette: 'sky' });
		});
	});
});
