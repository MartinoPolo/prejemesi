import {
	DB_READY,
	createGiftFixture,
	createWishlistFixture,
	expectRejection,
	readGift,
	recipientActor,
	removeFixtureRows,
	revisionsForGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { giftCategory } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	GIFT_CATEGORY_PRESETS,
	GIFT_CATEGORY_PRESET_BY_KEY,
	type GiftCategoryPresetKey,
} from '$lib/modules/gift-categories/presets.js';
import type { SaveGiftCategorySettingsInput } from '$lib/modules/gift-categories/types.js';
import { executeOperation } from './runner.js';
import {
	readGiftCategoriesOperation,
	saveGiftCategorySettingsOperation,
} from './gift_grouping_operations.js';

// Issue #534: presets and custom categories form one ordered list; any category may be renamed,
// recolored, reordered or removed, and a preset label is free once no active category claims it.

type CategoryItem = NonNullable<SaveGiftCategorySettingsInput['categories']>[number];

const NEW_COLOR = '#0F766E';

function activeCategories(wishlistId: string) {
	return getDb()
		.select()
		.from(giftCategory)
		.where(and(eq(giftCategory.wishlistId, wishlistId), isNull(giftCategory.deletedAt)))
		.orderBy(asc(giftCategory.sortOrder));
}

async function readCategory(categoryId: string) {
	const [row] = await getDb().select().from(giftCategory).where(eq(giftCategory.id, categoryId));
	if (row === undefined) {
		throw new Error(`Missing category ${categoryId}`);
	}
	return row;
}

/** A wishlist with the default presets, read the way the settings editor reads them. */
async function wishlistWithDefaultCategories() {
	const { id: wishlistId } = await createWishlistFixture();
	const categories = await executeOperation(recipientActor, readGiftCategoriesOperation, {
		wishlistId,
	});
	const presetId = (key: GiftCategoryPresetKey) =>
		categories.find((category) => category.presetKey === key)!.id;
	return { wishlistId, categories, presetId };
}

/** The current list as the editor submits it unchanged: presets under their Czech label. */
function unchangedItems(
	categories: Awaited<ReturnType<typeof wishlistWithDefaultCategories>>['categories'],
): CategoryItem[] {
	return categories.map((category) => ({
		id: category.id,
		label:
			category.customLabel ?? GIFT_CATEGORY_PRESET_BY_KEY.get(category.presetKey!)!.labels.cs,
		color: category.color,
	}));
}

function saveCategories(
	wishlistId: string,
	categories: CategoryItem[],
	confirmedRemovalCategoryIds: string[] = [],
) {
	return executeOperation(recipientActor, saveGiftCategorySettingsOperation, {
		wishlistId,
		categories,
		confirmedRemovalCategoryIds,
	});
}

describe.skipIf(!DB_READY)('saving the ordered category list [real DB]', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('keeps the existing order and presets when the list is saved unchanged', async () => {
		const { wishlistId, categories } = await wishlistWithDefaultCategories();

		await saveCategories(wishlistId, unchangedItems(categories));

		const rows = await activeCategories(wishlistId);
		expect(rows.map((row) => row.id)).toEqual(categories.map((category) => category.id));
		expect(rows.map((row) => row.presetKey)).toEqual(
			GIFT_CATEGORY_PRESETS.map((preset) => preset.key),
		);
		expect(rows.every((row) => row.customLabel === null)).toBe(true);
	});

	it('persists a mixed preset and custom order exactly as given', async () => {
		const { wishlistId, categories, presetId } = await wishlistWithDefaultCategories();
		const items = unchangedItems(categories);
		const books = items.find((item) => item.id === presetId('books'))!;
		const games = items.find((item) => item.id === presetId('games'))!;
		const rest = items.filter((item) => item !== books && item !== games);

		await saveCategories(wishlistId, [
			books,
			{ id: null, label: 'Lego', color: NEW_COLOR },
			...rest,
			games,
		]);

		const rows = await activeCategories(wishlistId);
		expect(rows.map((row) => row.customLabel ?? row.presetKey)).toEqual([
			'books',
			'Lego',
			...rest.map(
				(item) => categories.find((category) => category.id === item.id)!.presetKey,
			),
			'games',
		]);
		expect(rows.map((row) => row.sortOrder)).toEqual(rows.map((_row, index) => index));
	});

	it('renames a preset into a custom category with the same id, color and gifts', async () => {
		const { wishlistId, categories, presetId } = await wishlistWithDefaultCategories();
		const booksId = presetId('books');
		const giftId = await createGiftFixture(wishlistId, { categoryIds: [booksId] });
		const items = unchangedItems(categories).map((item) =>
			item.id === booksId ? { ...item, label: 'Četba' } : item,
		);

		await saveCategories(wishlistId, items);

		expect(await readCategory(booksId)).toMatchObject({
			presetKey: null,
			customLabel: 'Četba',
			color: GIFT_CATEGORY_PRESET_BY_KEY.get('books')!.color,
			deletedAt: null,
		});
		expect((await readGift(giftId)).categoryIds).toEqual([booksId]);
		expect(await revisionsForGift(giftId)).toHaveLength(0);
	});

	it('keeps a preset following the locale when it is saved under its own label in either language', async () => {
		const { wishlistId, categories, presetId } = await wishlistWithDefaultCategories();
		const items = unchangedItems(categories).map((item) => {
			if (item.id === presetId('books')) {
				return { ...item, label: 'Books', color: NEW_COLOR };
			}
			return item.id === presetId('games') ? { ...item, label: '  Hry  ' } : item;
		});

		await saveCategories(wishlistId, items);

		expect(await readCategory(presetId('books'))).toMatchObject({
			presetKey: 'books',
			customLabel: null,
			color: NEW_COLOR,
		});
		expect(await readCategory(presetId('games'))).toMatchObject({
			presetKey: 'games',
			customLabel: null,
		});
	});

	it('removes an unused preset left out of the list without confirmation', async () => {
		const { wishlistId, categories, presetId } = await wishlistWithDefaultCategories();
		const gamesId = presetId('games');

		await saveCategories(
			wishlistId,
			unchangedItems(categories).filter((item) => item.id !== gamesId),
		);

		expect((await readCategory(gamesId)).deletedAt).not.toBeNull();
		expect((await activeCategories(wishlistId)).map((row) => row.id)).not.toContain(gamesId);
	});

	it('requires confirmation to remove a used category, then unassigns its gifts with revisions', async () => {
		const { wishlistId, categories, presetId } = await wishlistWithDefaultCategories();
		const booksId = presetId('books');
		const giftId = await createGiftFixture(wishlistId, { categoryIds: [booksId] });
		const withoutBooks = unchangedItems(categories).filter((item) => item.id !== booksId);

		await expectRejection(
			saveCategories(wishlistId, withoutBooks),
			400,
			SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH,
		);
		expect((await readCategory(booksId)).deletedAt).toBeNull();
		expect((await readGift(giftId)).categoryIds).toEqual([booksId]);

		await saveCategories(wishlistId, withoutBooks, [booksId]);

		expect((await readCategory(booksId)).deletedAt).not.toBeNull();
		expect((await readGift(giftId)).categoryIds).toEqual([]);
		expect(await revisionsForGift(giftId)).toHaveLength(1);
	});

	it('creates a custom "Hry" in the same save that removes the Hry preset', async () => {
		const { wishlistId, categories, presetId } = await wishlistWithDefaultCategories();
		const gamesId = presetId('games');

		await saveCategories(wishlistId, [
			{ id: null, label: 'Hry', color: NEW_COLOR },
			...unchangedItems(categories).filter((item) => item.id !== gamesId),
		]);

		const [first] = await activeCategories(wishlistId);
		expect(first).toMatchObject({ presetKey: null, customLabel: 'Hry', color: NEW_COLOR });
		expect(first?.id).not.toBe(gamesId);
		expect((await readCategory(gamesId)).deletedAt).not.toBeNull();
	});

	it('frees a renamed preset label for a new category in the same save', async () => {
		const { wishlistId, categories, presetId } = await wishlistWithDefaultCategories();
		const gamesId = presetId('games');
		const toysId = presetId('toys');
		const items = unchangedItems(categories)
			.filter((item) => item.id !== toysId)
			.map((item) => (item.id === gamesId ? { ...item, label: 'Hračky' } : item));

		await saveCategories(wishlistId, [...items, { id: null, label: 'Hry', color: NEW_COLOR }]);

		expect(await readCategory(gamesId)).toMatchObject({
			presetKey: null,
			customLabel: 'Hračky',
			deletedAt: null,
		});
		expect((await readCategory(toysId)).deletedAt).not.toBeNull();
		const rows = await activeCategories(wishlistId);
		expect(rows.at(-1)).toMatchObject({
			presetKey: null,
			customLabel: 'Hry',
			color: NEW_COLOR,
		});
	});

	it.each([
		['English', 'Games'],
		['Czech', 'hry'],
	])('rejects a new category named like a kept preset in %s', async (_language, label) => {
		const { wishlistId, categories } = await wishlistWithDefaultCategories();

		await expectRejection(
			saveCategories(wishlistId, [
				...unchangedItems(categories),
				{ id: null, label, color: NEW_COLOR },
			]),
			400,
			SERVER_ERROR.GIFT_CATEGORY_LABEL_CONFLICT,
		);
		expect((await activeCategories(wishlistId)).map((row) => row.id)).toEqual(
			categories.map((category) => category.id),
		);
	});

	it('rejects renaming a category to a label another kept category holds', async () => {
		const { wishlistId, categories, presetId } = await wishlistWithDefaultCategories();
		const toysId = presetId('toys');

		await expectRejection(
			saveCategories(
				wishlistId,
				unchangedItems(categories).map((item) =>
					item.id === toysId ? { ...item, label: 'knihy ' } : item,
				),
			),
			400,
			SERVER_ERROR.GIFT_CATEGORY_LABEL_CONFLICT,
		);
		expect(await readCategory(toysId)).toMatchObject({ presetKey: 'toys', customLabel: null });
	});

	it('swaps two category labels in one save', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		await saveCategories(wishlistId, [
			{ id: null, label: 'Alfa', color: NEW_COLOR },
			{ id: null, label: 'Beta', color: NEW_COLOR },
		]);
		const [alfa, beta] = await activeCategories(wishlistId);

		await saveCategories(wishlistId, [
			{ id: alfa!.id, label: 'Beta', color: NEW_COLOR },
			{ id: beta!.id, label: 'Alfa', color: NEW_COLOR },
		]);

		expect((await readCategory(alfa!.id)).customLabel).toBe('Beta');
		expect((await readCategory(beta!.id)).customLabel).toBe('Alfa');
	});

	it('rejects ids that are not active categories of the wishlist', async () => {
		const { wishlistId, categories, presetId } = await wishlistWithDefaultCategories();
		const { categories: otherCategories } = await wishlistWithDefaultCategories();
		const items = unchangedItems(categories);

		for (const invalid of [
			[...items, { id: otherCategories[0]!.id, label: 'Cizí', color: NEW_COLOR }],
			[...items, { id: presetId('books'), label: 'Kopie', color: NEW_COLOR }],
		]) {
			await expectRejection(
				saveCategories(wishlistId, invalid),
				400,
				SERVER_ERROR.GIFT_CATEGORY_WISHLIST_MISMATCH,
			);
		}
	});

	it('rejects the id of a removed category of the same wishlist', async () => {
		const { wishlistId, categories, presetId } = await wishlistWithDefaultCategories();
		const gamesId = presetId('games');
		const withoutGames = unchangedItems(categories).filter((item) => item.id !== gamesId);
		await saveCategories(wishlistId, withoutGames);

		await expectRejection(
			saveCategories(wishlistId, [
				...withoutGames,
				{ id: gamesId, label: 'Hry', color: NEW_COLOR },
			]),
			400,
			SERVER_ERROR.GIFT_CATEGORY_WISHLIST_MISMATCH,
		);
		expect((await readCategory(gamesId)).deletedAt).not.toBeNull();
	});

	it('still saves the legacy split shape: custom categories first, then enabled presets', async () => {
		const { wishlistId, presetId } = await wishlistWithDefaultCategories();

		await executeOperation(recipientActor, saveGiftCategorySettingsOperation, {
			wishlistId,
			customCategories: [{ id: null, label: 'Lego', color: NEW_COLOR }],
			presetKeys: ['books', 'games'],
			presetColors: [
				{ key: 'books', color: NEW_COLOR },
				{ key: 'games', color: GIFT_CATEGORY_PRESET_BY_KEY.get('games')!.color },
			],
			confirmedRemovalCategoryIds: [],
		});

		const rows = await activeCategories(wishlistId);
		expect(rows.map((row) => [row.id, row.presetKey, row.customLabel])).toEqual([
			[expect.any(String), null, 'Lego'],
			[presetId('games'), 'games', null],
			[presetId('books'), 'books', null],
		]);
		expect(rows[2]?.color).toBe(NEW_COLOR);
	});

	it('requires confirmation when a legacy-shaped save disables a used preset', async () => {
		const { wishlistId, presetId } = await wishlistWithDefaultCategories();
		const booksId = presetId('books');
		const giftId = await createGiftFixture(wishlistId, { categoryIds: [booksId] });
		const presetsWithoutBooks = GIFT_CATEGORY_PRESETS.filter(
			(preset) => preset.key !== 'books',
		);
		const legacySave = (confirmedRemovalCategoryIds: string[]) =>
			executeOperation(recipientActor, saveGiftCategorySettingsOperation, {
				wishlistId,
				customCategories: [],
				presetKeys: presetsWithoutBooks.map((preset) => preset.key),
				presetColors: presetsWithoutBooks.map((preset) => ({
					key: preset.key,
					color: preset.color,
				})),
				confirmedRemovalCategoryIds,
			});

		await expectRejection(
			legacySave([]),
			400,
			SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH,
		);
		expect((await readCategory(booksId)).deletedAt).toBeNull();
		expect((await readGift(giftId)).categoryIds).toEqual([booksId]);

		await legacySave([booksId]);

		expect((await readCategory(booksId)).deletedAt).not.toBeNull();
		expect((await readGift(giftId)).categoryIds).toEqual([]);
	});

	it('reads a wishlist saved in the legacy shape with its ids, order and assignments, creating no disabled preset', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const removedAt = new Date('2026-01-01T00:00:00Z');
		// The superseded editor stored custom categories first, then the enabled presets in
		// curated order; a disabled preset kept its soft-deleted row or never had one.
		const legacyRows = await getDb()
			.insert(giftCategory)
			.values([
				{ wishlistId, customLabel: 'Lego', color: NEW_COLOR, sortOrder: 0 },
				{ wishlistId, customLabel: 'Kola', color: NEW_COLOR, sortOrder: 1 },
				{ wishlistId, presetKey: 'toys', color: '#D97706', sortOrder: 2 },
				{ wishlistId, presetKey: 'books', color: '#2563EB', sortOrder: 3 },
				{
					wishlistId,
					presetKey: 'games',
					color: '#7C3AED',
					sortOrder: 4,
					deletedAt: removedAt,
				},
			])
			.returning();
		const [lego, kola, toys, books, games] = legacyRows;
		const bikeGiftId = await createGiftFixture(wishlistId, { categoryIds: [kola!.id] });
		const bookGiftId = await createGiftFixture(wishlistId, { categoryIds: [books!.id] });

		const categories = await executeOperation(recipientActor, readGiftCategoriesOperation, {
			wishlistId,
		});

		expect(
			categories.map(({ id, presetKey, customLabel, sortOrder, usedCount }) => ({
				id,
				presetKey,
				customLabel,
				sortOrder,
				usedCount,
			})),
		).toEqual([
			{ id: lego!.id, presetKey: null, customLabel: 'Lego', sortOrder: 0, usedCount: 0 },
			{ id: kola!.id, presetKey: null, customLabel: 'Kola', sortOrder: 1, usedCount: 1 },
			{ id: toys!.id, presetKey: 'toys', customLabel: null, sortOrder: 2, usedCount: 0 },
			{ id: books!.id, presetKey: 'books', customLabel: null, sortOrder: 3, usedCount: 1 },
		]);
		expect((await readGift(bikeGiftId)).categoryIds).toEqual([kola!.id]);
		expect((await readGift(bookGiftId)).categoryIds).toEqual([books!.id]);
		const storedRows = await getDb()
			.select()
			.from(giftCategory)
			.where(eq(giftCategory.wishlistId, wishlistId));
		expect(storedRows).toHaveLength(legacyRows.length);
		expect(storedRows.find((row) => row.id === games!.id)?.deletedAt).toEqual(removedAt);
	});
});
