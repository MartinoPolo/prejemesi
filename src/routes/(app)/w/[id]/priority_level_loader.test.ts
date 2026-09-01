import { describe, expect, it } from 'vitest';
import {
	resetPriorityLevelLoaderForWishlistChange,
	settlePriorityLevelLoad,
} from './priority_level_loader.js';

describe('priority level loader reset', () => {
	it('does not reset an in-flight load for the same wishlist id', () => {
		const promise = Promise.resolve();
		expect(
			resetPriorityLevelLoaderForWishlistChange(
				{
					ownerWishlistId: 'wishlist-1',
					loadedWishlistId: null,
					requestedWishlistId: 'wishlist-1',
					loadPromise: promise,
				},
				'wishlist-1',
			),
		).toEqual({
			ownerWishlistId: 'wishlist-1',
			loadedWishlistId: null,
			requestedWishlistId: 'wishlist-1',
			loadPromise: promise,
		});
	});

	it('resets loaded and requested state only when the wishlist id changes', () => {
		const promise = Promise.resolve();
		expect(
			resetPriorityLevelLoaderForWishlistChange(
				{
					ownerWishlistId: 'wishlist-1',
					loadedWishlistId: 'wishlist-1',
					requestedWishlistId: 'wishlist-1',
					loadPromise: promise,
				},
				'wishlist-2',
			),
		).toEqual({
			ownerWishlistId: 'wishlist-2',
			loadedWishlistId: null,
			requestedWishlistId: null,
			loadPromise: null,
		});
	});

	it('keeps a failed wishlist load unready and clears it for retry', () => {
		const failed = settlePriorityLevelLoad(
			{
				ownerWishlistId: 'wishlist-1',
				loadedWishlistId: null,
				requestedWishlistId: 'wishlist-1',
				loadPromise: Promise.resolve(),
			},
			'wishlist-1',
			false,
		);

		expect(failed).toEqual({
			ownerWishlistId: 'wishlist-1',
			loadedWishlistId: null,
			requestedWishlistId: null,
			loadPromise: null,
		});
	});
});
