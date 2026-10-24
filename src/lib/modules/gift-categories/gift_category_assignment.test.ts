import { describe, expect, it } from 'vitest';
import {
	MAX_GIFT_CATEGORIES,
	giftCategoryChoices,
	giftCategoryIdsFromLegacyCategoryId,
	isValidGiftCategoryIdList,
	requestedGiftCategoryIds,
	withGiftCategoryAdded,
	withGiftCategoryRemoved,
	withPrimaryGiftCategory,
} from './gift_category_assignment.js';

const FULL = ['c1', 'c2', 'c3', 'c4', 'c5'];

describe('gift category assignment', () => {
	it('allows at most five categories per gift', () => {
		expect(MAX_GIFT_CATEGORIES).toBe(5);
	});

	describe('isValidGiftCategoryIdList', () => {
		it.each([[[]], [['c1']], [FULL]])('accepts %j', (categoryIds) => {
			expect(isValidGiftCategoryIdList(categoryIds)).toBe(true);
		});

		it('rejects more than five categories', () => {
			expect(isValidGiftCategoryIdList([...FULL, 'c6'])).toBe(false);
		});

		it('rejects a category listed twice', () => {
			expect(isValidGiftCategoryIdList(['c1', 'c2', 'c1'])).toBe(false);
		});
	});

	describe('withPrimaryGiftCategory', () => {
		it('replaces only the primary and keeps the secondaries in order', () => {
			expect(withPrimaryGiftCategory(['books', 'toys', 'games'], 'music')).toEqual([
				'music',
				'toys',
				'games',
			]);
		});

		it('promotes a secondary to primary without a duplicate', () => {
			expect(withPrimaryGiftCategory(['books', 'toys', 'games'], 'games')).toEqual([
				'games',
				'toys',
			]);
		});

		it('gives an uncategorized gift its first category', () => {
			expect(withPrimaryGiftCategory([], 'books')).toEqual(['books']);
		});

		it('keeps the list when the primary is chosen again', () => {
			expect(withPrimaryGiftCategory(['books', 'toys'], 'books')).toEqual(['books', 'toys']);
		});

		it('drops the primary and promotes the next for null', () => {
			expect(withPrimaryGiftCategory(['books', 'toys', 'games'], null)).toEqual([
				'toys',
				'games',
			]);
			expect(withPrimaryGiftCategory([], null)).toEqual([]);
		});
	});

	describe('withGiftCategoryAdded', () => {
		it('appends a category the gift lacks', () => {
			expect(withGiftCategoryAdded(['books'], 'toys')).toEqual(['books', 'toys']);
			expect(withGiftCategoryAdded([], 'toys')).toEqual(['toys']);
		});

		it('leaves a gift that already has the category unchanged', () => {
			expect(withGiftCategoryAdded(['books', 'toys'], 'books')).toEqual(['books', 'toys']);
		});

		it('leaves a gift already at five categories unchanged', () => {
			expect(withGiftCategoryAdded(FULL, 'c6')).toEqual(FULL);
		});
	});

	describe('withGiftCategoryRemoved', () => {
		it('removes the category and keeps the others in order', () => {
			expect(withGiftCategoryRemoved(['books', 'toys', 'games'], 'toys')).toEqual([
				'books',
				'games',
			]);
		});

		it('promotes the next category when the primary is removed', () => {
			expect(withGiftCategoryRemoved(['books', 'toys'], 'books')).toEqual(['toys']);
		});

		it('leaves a gift without the category unchanged', () => {
			expect(withGiftCategoryRemoved(['books'], 'toys')).toEqual(['books']);
		});
	});

	describe('giftCategoryIdsFromLegacyCategoryId', () => {
		it('replaces only the primary with a single category', () => {
			expect(giftCategoryIdsFromLegacyCategoryId(['books', 'toys'], 'games')).toEqual([
				'games',
				'toys',
			]);
		});

		it('makes a secondary primary without a duplicate', () => {
			expect(giftCategoryIdsFromLegacyCategoryId(['books', 'toys'], 'toys')).toEqual([
				'toys',
			]);
		});

		it('clears every category for null', () => {
			expect(giftCategoryIdsFromLegacyCategoryId(['books', 'toys'], null)).toEqual([]);
		});
	});

	describe('requestedGiftCategoryIds', () => {
		it('takes the full list as given', () => {
			expect(requestedGiftCategoryIds({ categoryIds: ['toys', 'books'] }, ['books'])).toEqual(
				['toys', 'books'],
			);
			expect(requestedGiftCategoryIds({ categoryIds: [] }, ['books'])).toEqual([]);
		});

		it('resolves the deprecated single category against the current list', () => {
			expect(requestedGiftCategoryIds({ categoryId: 'games' }, ['books', 'toys'])).toEqual([
				'games',
				'toys',
			]);
			expect(requestedGiftCategoryIds({ categoryId: null }, ['books', 'toys'])).toEqual([]);
		});

		it('leaves the categories unchanged when the edit names neither field', () => {
			expect(requestedGiftCategoryIds({}, ['books'])).toBeUndefined();
		});
	});

	describe('giftCategoryChoices', () => {
		const wishlistCategories = ['books', 'toys', 'games'];

		it('checks a category every selected gift has, marks one some have, leaves one none have', () => {
			const choices = giftCategoryChoices(
				[
					['books', 'toys'],
					['books', 'games'],
				],
				wishlistCategories,
			);

			expect(choices.categories.get('books')?.state).toBe(true);
			expect(choices.categories.get('toys')?.state).toBe('indeterminate');
			expect(choices.categories.get('games')?.state).toBe('indeterminate');
			expect(choices.uncategorized).toBe(false);
		});

		it('leaves a category unchecked when no selected gift has it', () => {
			const choices = giftCategoryChoices([['books'], ['books']], wishlistCategories);

			expect(choices.categories.get('toys')).toEqual({ state: false, addable: true });
		});

		it('reports "Bez kategorie" as checked, indeterminate or unchecked', () => {
			expect(giftCategoryChoices([[], []], wishlistCategories).uncategorized).toBe(true);
			expect(giftCategoryChoices([[], ['books']], wishlistCategories).uncategorized).toBe(
				'indeterminate',
			);
			expect(giftCategoryChoices([['books']], wishlistCategories).uncategorized).toBe(false);
		});

		it('marks an unchecked category no selected gift could take as not addable', () => {
			const choices = giftCategoryChoices([FULL, FULL], [...FULL, 'c6']);

			expect(choices.categories.get('c6')).toEqual({ state: false, addable: false });
		});

		it('keeps a category addable while any gift lacking it has room', () => {
			const choices = giftCategoryChoices([FULL, ['c1']], [...FULL, 'c6']);

			expect(choices.categories.get('c6')).toEqual({ state: false, addable: true });
			expect(choices.categories.get('c2')?.state).toBe('indeterminate');
		});
	});
});
