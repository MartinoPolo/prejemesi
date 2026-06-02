import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
	wishlistImageUrl,
	createDefaultWishlistSlots,
	wishlistSlotToFrameProps,
	WISHLIST_SLOT_ASPECT,
} from './wishlist_slots.js';
import {
	WISHLIST_IMAGE_SLOT_VALUES,
	WishlistImageSlotsSchema,
	type WishlistImageSlots,
} from './types.js';
import { IMAGE_FIT_MODES } from '$lib/components/derived/image-frame/index.js';

describe('wishlistImageUrl', () => {
	it('returns null for an unset image key', () => {
		expect(wishlistImageUrl(null)).toBeNull();
		expect(wishlistImageUrl(undefined)).toBeNull();
		expect(wishlistImageUrl('')).toBeNull();
	});

	it('resolves an object key to the same-origin upload route', () => {
		expect(wishlistImageUrl('wishlists/banners/abc.jpg')).toBe(
			'/api/upload/wishlists/banners/abc.jpg',
		);
	});
});

describe('createDefaultWishlistSlots', () => {
	it('seeds every wishlist slot with centered cover-crop metadata', () => {
		const slots = createDefaultWishlistSlots();
		for (const slot of WISHLIST_IMAGE_SLOT_VALUES) {
			const meta = slots[slot];
			expect(meta).toBeDefined();
			expect(meta?.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
			expect(meta?.focal).toEqual({ x: 50, y: 50 });
		}
	});

	it('produces metadata that validates against the persisted schema', () => {
		const slots = createDefaultWishlistSlots();
		expect(() => v.parse(WishlistImageSlotsSchema, slots)).not.toThrow();
	});

	it('returns independent metadata objects per slot (editing one never mutates another)', () => {
		const slots = createDefaultWishlistSlots();
		expect(slots.card).not.toBe(slots.thumbnail);
	});
});

describe('wishlistSlotToFrameProps', () => {
	it('falls back to renderer defaults when the slot is unset', () => {
		expect(wishlistSlotToFrameProps(null, 'card')).toEqual({
			fitMode: IMAGE_FIT_MODES.auto,
			focal: { x: 50, y: 50 },
			zoom: 1,
			fillColor: null,
		});
		expect(wishlistSlotToFrameProps({}, 'banner')).toEqual({
			fitMode: IMAGE_FIT_MODES.auto,
			focal: { x: 50, y: 50 },
			zoom: 1,
			fillColor: null,
		});
	});

	it('selects each slot independently', () => {
		const slots: WishlistImageSlots = {
			card: {
				fitMode: IMAGE_FIT_MODES.coverCrop,
				focal: { x: 10, y: 10 },
				zoom: 1,
			},
			banner: {
				fitMode: IMAGE_FIT_MODES.containPadded,
				focal: { x: 90, y: 90 },
				zoom: 1,
			},
		};
		expect(wishlistSlotToFrameProps(slots, 'card').focal).toEqual({ x: 10, y: 10 });
		expect(wishlistSlotToFrameProps(slots, 'banner').fitMode).toBe(
			IMAGE_FIT_MODES.containPadded,
		);
	});
});

describe('WISHLIST_SLOT_ASPECT', () => {
	it('maps each slot to its production display aspect ratio', () => {
		expect(WISHLIST_SLOT_ASPECT).toEqual({
			card: '3 / 2',
			thumbnail: '1 / 1',
			banner: '16 / 6',
			social: '1.91 / 1',
		});
	});
});
