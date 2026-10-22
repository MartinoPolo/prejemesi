import {
	DB_READY,
	captureError,
	createGiftFixture,
	createWishlistFixture,
	expectRejection,
	outsiderActor,
	readGift,
	recipientActor,
	removeFixtureRows,
	revisionsForGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { giftCategory } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { DEFAULT_ENABLED_GIFT_CATEGORY_PRESET_KEYS } from '$lib/modules/gift-categories/presets.js';
import { executeOperation } from './runner.js';
import {
	createGiftCategoryOperation,
	readGiftCategoriesOperation,
} from './gift_grouping_operations.js';

const NEW_COLOR = '#0F766E';

function activeCategories(wishlistId: string) {
	return getDb()
		.select()
		.from(giftCategory)
		.where(and(eq(giftCategory.wishlistId, wishlistId), isNull(giftCategory.deletedAt)));
}

describe.skipIf(!DB_READY)('creating a category from a category picker [real DB]', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('creates the named, colored category and assigns it to every acting gift', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const giftIds = [await createGiftFixture(wishlistId), await createGiftFixture(wishlistId)];

		const { category } = await executeOperation(recipientActor, createGiftCategoryOperation, {
			wishlistId,
			label: '  Deskovky  ',
			color: NEW_COLOR,
			giftIds,
		});

		expect(category).toMatchObject({ customLabel: 'Deskovky', color: NEW_COLOR });
		for (const giftId of giftIds) {
			expect((await readGift(giftId)).categoryId).toBe(category.id);
			expect(await revisionsForGift(giftId)).toHaveLength(1);
		}
		const usage = await executeOperation(recipientActor, readGiftCategoriesOperation, {
			wishlistId,
		});
		expect(usage.find((row) => row.id === category.id)?.usedCount).toBe(giftIds.length);
	});

	it('only creates the category for the gift editor, leaving the gift to its save', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlistId);

		const { category } = await executeOperation(recipientActor, createGiftCategoryOperation, {
			wishlistId,
			label: 'Lego',
			color: NEW_COLOR,
			giftIds: [],
		});

		expect((await activeCategories(wishlistId)).map((row) => row.id)).toContain(category.id);
		expect((await readGift(giftId)).categoryId).toBeNull();
	});

	it('keeps the default categories of a wishlist whose categories were never read', async () => {
		const { id: wishlistId } = await createWishlistFixture();

		await executeOperation(recipientActor, createGiftCategoryOperation, {
			wishlistId,
			label: 'Lego',
			color: NEW_COLOR,
			giftIds: [],
		});

		const rows = await activeCategories(wishlistId);
		expect(rows.flatMap((row) => row.presetKey ?? []).sort()).toEqual(
			[...DEFAULT_ENABLED_GIFT_CATEGORY_PRESET_KEYS].sort(),
		);
		expect(rows.filter((row) => row.customLabel === 'Lego')).toHaveLength(1);
	});

	it('marks assigned gifts on a shared wishlist as edited after sharing', async () => {
		const { id: wishlistId } = await createWishlistFixture({
			sharedAt: new Date(Date.now() - 60 * 60 * 1000),
		});
		const giftId = await createGiftFixture(wishlistId, {
			createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
		});

		await executeOperation(recipientActor, createGiftCategoryOperation, {
			wishlistId,
			label: 'Lego',
			color: NEW_COLOR,
			giftIds: [giftId],
		});

		expect((await readGift(giftId)).editedAfterShareAt).not.toBeNull();
	});

	it('rejects a name that an existing or preset category already uses', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		await executeOperation(recipientActor, createGiftCategoryOperation, {
			wishlistId,
			label: 'Lego',
			color: NEW_COLOR,
			giftIds: [],
		});

		for (const label of ['lego', 'Knihy', 'Books']) {
			await expectRejection(
				executeOperation(recipientActor, createGiftCategoryOperation, {
					wishlistId,
					label,
					color: NEW_COLOR,
					giftIds: [],
				}),
				400,
				SERVER_ERROR.GIFT_CATEGORY_LABEL_CONFLICT,
			);
		}
		expect(
			(await activeCategories(wishlistId)).filter((row) => row.customLabel !== null),
		).toHaveLength(1);
	});

	it('creates nothing when an acting gift cannot be assigned', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const { id: otherWishlistId } = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlistId);
		const foreignGiftId = await createGiftFixture(otherWishlistId);

		await expectRejection(
			executeOperation(recipientActor, createGiftCategoryOperation, {
				wishlistId,
				label: 'Lego',
				color: NEW_COLOR,
				giftIds: [giftId, foreignGiftId],
			}),
			400,
			SERVER_ERROR.GIFT_WISHLIST_MISMATCH,
		);

		expect(
			(await activeCategories(wishlistId)).filter((row) => row.customLabel === 'Lego'),
		).toHaveLength(0);
		expect((await readGift(giftId)).categoryId).toBeNull();
	});

	it('is refused to viewers who cannot manage the wishlist and on archived wishlists', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const { id: archivedWishlistId } = await createWishlistFixture({ status: 'archived' });
		const input = { label: 'Lego', color: NEW_COLOR, giftIds: [] };

		const outsiderError = await captureError(
			executeOperation(outsiderActor, createGiftCategoryOperation, { wishlistId, ...input }),
		);
		expect(outsiderError).toMatchObject({ status: 403 });
		await expectRejection(
			executeOperation(recipientActor, createGiftCategoryOperation, {
				wishlistId: archivedWishlistId,
				...input,
			}),
			400,
			SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST,
		);
	});
});
