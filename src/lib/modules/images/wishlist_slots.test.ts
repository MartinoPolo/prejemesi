import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
	wishlistImageUrl,
	createDefaultWishlistSlots,
	wishlistSlotToFrameProps,
} from './wishlist_slots.js';
import { WISHLIST_EDITOR_SLOTS, WISHLIST_SLOT_SPECS } from './crop_targets.js';
import { WishlistImageSlotsSchema, type WishlistImageSlots } from './types.js';
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
	it('seeds every editor slot with centered cover-crop metadata', () => {
		const slots = createDefaultWishlistSlots();
		for (const slot of WISHLIST_EDITOR_SLOTS) {
			const meta = slots[slot];
			expect(meta).toBeDefined();
			expect(meta?.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
			expect(meta?.focal).toEqual({ x: 50, y: 50 });
		}
	});

	it('does not seed the orphan banner slot (#116 D3)', () => {
		expect(createDefaultWishlistSlots().banner).toBeUndefined();
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

	it('selects each slot independently and still renders retained banner data', () => {
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

describe('WISHLIST_SLOT_SPECS', () => {
	it('offers exactly the three editor slots (banner removed, D3)', () => {
		expect(WISHLIST_EDITOR_SLOTS).toEqual(['card', 'thumbnail', 'social']);
	});

	it('maps each editor slot to its real consumer aspect (REQ-6/REQ-7)', () => {
		// Dashboard card banner: h-32 fixed at ~364px grid width (issue #116 measurements).
		expect(WISHLIST_SLOT_SPECS.card.aspect).toBeCloseTo(364 / 128, 5);
		// Thumbnail family (header polaroid, nav dropdown, list row) is square.
		expect(WISHLIST_SLOT_SPECS.thumbnail.aspect).toBe(1);
		// Social preview renders at the Open Graph 1200×630 ratio (~1.91:1).
		expect(WISHLIST_SLOT_SPECS.social.aspect).toBeCloseTo(1200 / 630, 5);
	});

	it('keeps cssAspect consistent with the numeric aspect', () => {
		for (const slot of WISHLIST_EDITOR_SLOTS) {
			const spec = WISHLIST_SLOT_SPECS[slot];
			const [w, h] = spec.cssAspect.split('/').map((part) => Number(part.trim()));
			expect(w! / h!).toBeCloseTo(spec.aspect, 5);
		}
	});
});
