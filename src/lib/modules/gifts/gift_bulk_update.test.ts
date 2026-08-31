import { describe, expect, it } from 'vitest';
import { bulkGiftUpdateData, isBulkPresentationAction } from './gift_bulk_update.js';
import { fillImageMeta } from '$lib/modules/images/editor_modes.js';

describe('bulk gift updates', () => {
	it('distinguishes presentation edits that require post-share transparency and reservation notices', () => {
		expect(
			isBulkPresentationAction({
				action: 'priority',
				priorityLevelId: null,
				wishlistId: 'w',
				giftIds: ['g'],
			}),
		).toBe(true);
		expect(
			isBulkPresentationAction({
				action: 'category',
				categoryId: null,
				wishlistId: 'w',
				giftIds: ['g'],
			}),
		).toBe(true);
		expect(
			isBulkPresentationAction({
				action: 'imageFit',
				fit: 'fill',
				wishlistId: 'w',
				giftIds: ['g'],
			}),
		).toBe(true);
		expect(
			isBulkPresentationAction({
				action: 'received',
				received: true,
				wishlistId: 'w',
				giftIds: ['g'],
			}),
		).toBe(false);
	});

	it('restores each gift from its exact heterogeneous received prior-state map', () => {
		const input = {
			action: 'restoreReceived' as const,
			states: { a: true, b: false },
			wishlistId: 'w',
			giftIds: ['a', 'b'],
		};
		expect(bulkGiftUpdateData(input, { id: 'a', imageMeta: null })).toEqual({ received: true });
		expect(bulkGiftUpdateData(input, { id: 'b', imageMeta: null })).toEqual({
			received: false,
		});
	});

	it('explicit Fit clears manual crops while preserving the gift background', () => {
		expect(
			bulkGiftUpdateData(
				{ action: 'imageFit', fit: 'fit', wishlistId: 'w', giftIds: ['g'] },
				{ imageMeta: { ...fillImageMeta('#000000'), targets: { square: {} as never } } },
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
				{ imageMeta },
			),
		).toEqual({ imageMeta: { ...imageMeta, bgColor: '#ffffff' } });
	});
});
