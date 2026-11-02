import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { bulkGiftUpdateData, isBulkPresentationAction } from './gift_bulk_update.js';
import { BulkUpdateGiftsInputSchema, type BulkUpdateGiftsInput } from './types.js';
import { fillImageMeta } from '$lib/modules/images/editor_modes.js';

const presentationActionCases = [
	[{ action: 'priority', priorityLevelId: null, wishlistId: 'w', giftIds: ['g'] }, true],
	[{ action: 'category', categoryId: null, wishlistId: 'w', giftIds: ['g'] }, true],
	[{ action: 'addCategory', categoryId: 'c', wishlistId: 'w', giftIds: ['g'] }, true],
	[{ action: 'removeCategory', categoryId: 'c', wishlistId: 'w', giftIds: ['g'] }, true],
	[{ action: 'imageFit', fit: 'fill', wishlistId: 'w', giftIds: ['g'] }, true],
	[{ action: 'imageBackground', background: null, wishlistId: 'w', giftIds: ['g'] }, true],
	[{ action: 'received', received: true, wishlistId: 'w', giftIds: ['g'] }, false],
] satisfies Array<[BulkUpdateGiftsInput, boolean]>;

function categoryUpdate(input: BulkUpdateGiftsInput, categoryIds: readonly string[]) {
	return bulkGiftUpdateData(input, { imageMeta: null, categoryIds });
}

const selection = { wishlistId: 'w', giftIds: ['g'] };

describe('bulk gift updates', () => {
	it.each(presentationActionCases)(
		'classifies $0.action presentation semantics as $1',
		(input, expected) => {
			expect(isBulkPresentationAction(input)).toBe(expected);
		},
	);

	it('restores each gift from its exact heterogeneous received prior-state map', () => {
		const input = {
			action: 'restoreReceived' as const,
			states: { a: true, b: false },
			wishlistId: 'w',
			giftIds: ['a', 'b'],
		};
		expect(bulkGiftUpdateData(input, { id: 'a', imageMeta: null, categoryIds: [] })).toEqual({
			received: true,
		});
		expect(bulkGiftUpdateData(input, { id: 'b', imageMeta: null, categoryIds: [] })).toEqual({
			received: false,
		});
	});

	it('explicit Fit clears manual crops while preserving the gift background', () => {
		expect(
			bulkGiftUpdateData(
				{ action: 'imageFit', fit: 'fit', wishlistId: 'w', giftIds: ['g'] },
				{
					imageMeta: { ...fillImageMeta('#000000'), targets: { square: {} as never } },
					categoryIds: [],
				},
			),
		).toMatchObject({
			imageMeta: { fitMode: 'contain-padded', bgColor: '#000000', targets: undefined },
		});
	});

	it('changing image background preserves existing fit and crop metadata', () => {
		const imageMeta = fillImageMeta();
		expect(
			bulkGiftUpdateData(
				{
					action: 'imageBackground',
					background: '#ffffff',
					wishlistId: 'w',
					giftIds: ['g'],
				},
				{ imageMeta, categoryIds: [] },
			),
		).toEqual({ imageMeta: { ...imageMeta, bgColor: '#ffffff' } });
	});

	describe('category actions', () => {
		it('legacy category replaces only the primary and keeps the secondaries', () => {
			expect(
				categoryUpdate({ ...selection, action: 'category', categoryId: 'toys' }, [
					'books',
					'games',
				]),
			).toEqual({ categoryIds: ['toys', 'games'] });
		});

		it('legacy category promotes a secondary to primary without duplicating it', () => {
			expect(
				categoryUpdate({ ...selection, action: 'category', categoryId: 'games' }, [
					'books',
					'games',
					'toys',
				]),
			).toEqual({ categoryIds: ['games', 'toys'] });
		});

		it('legacy category gives an uncategorized gift that one category', () => {
			expect(
				categoryUpdate({ ...selection, action: 'category', categoryId: 'toys' }, []),
			).toEqual({ categoryIds: ['toys'] });
		});

		it('legacy null category clears every category', () => {
			expect(
				categoryUpdate({ ...selection, action: 'category', categoryId: null }, [
					'books',
					'games',
				]),
			).toEqual({ categoryIds: [] });
		});

		it('addCategory appends a category the gift lacks', () => {
			expect(
				categoryUpdate({ ...selection, action: 'addCategory', categoryId: 'toys' }, [
					'books',
					'games',
				]),
			).toEqual({ categoryIds: ['books', 'games', 'toys'] });
		});

		it('addCategory leaves a gift that already has the category unchanged', () => {
			expect(
				categoryUpdate({ ...selection, action: 'addCategory', categoryId: 'games' }, [
					'books',
					'games',
				]),
			).toEqual({ categoryIds: ['books', 'games'] });
		});

		it('addCategory leaves a gift already at five categories unchanged', () => {
			const full = ['c1', 'c2', 'c3', 'c4', 'c5'];
			expect(
				categoryUpdate({ ...selection, action: 'addCategory', categoryId: 'c6' }, full),
			).toEqual({ categoryIds: full });
		});

		it('removeCategory removes only that category, promoting the next when it was primary', () => {
			expect(
				categoryUpdate({ ...selection, action: 'removeCategory', categoryId: 'books' }, [
					'books',
					'games',
					'toys',
				]),
			).toEqual({ categoryIds: ['games', 'toys'] });
			expect(
				categoryUpdate({ ...selection, action: 'removeCategory', categoryId: 'games' }, [
					'books',
					'games',
					'toys',
				]),
			).toEqual({ categoryIds: ['books', 'toys'] });
		});

		it('removeCategory leaves a gift without the category unchanged', () => {
			expect(
				categoryUpdate({ ...selection, action: 'removeCategory', categoryId: 'toys' }, [
					'books',
				]),
			).toEqual({ categoryIds: ['books'] });
		});

		it('requires a category id for addCategory and removeCategory but allows null for category', () => {
			for (const action of ['addCategory', 'removeCategory'] as const) {
				expect(
					v.safeParse(BulkUpdateGiftsInputSchema, {
						...selection,
						action,
						categoryId: 'c',
					}).success,
				).toBe(true);
				expect(
					v.safeParse(BulkUpdateGiftsInputSchema, {
						...selection,
						action,
						categoryId: null,
					}).success,
				).toBe(false);
			}
			expect(
				v.safeParse(BulkUpdateGiftsInputSchema, {
					...selection,
					action: 'category',
					categoryId: null,
				}).success,
			).toBe(true);
		});
	});
});
