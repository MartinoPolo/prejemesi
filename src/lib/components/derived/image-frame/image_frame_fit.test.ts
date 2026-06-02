import { describe, it, expect } from 'vitest';
import {
	resolveAutoFit,
	resolveFrameFill,
	AUTO_CONTAIN_RATIO_THRESHOLD,
	IMAGE_FIT_MODES,
} from './image_frame_fit.js';

describe('resolveAutoFit', () => {
	it('fills the box (cover-crop) when the image ratio matches the box', () => {
		expect(resolveAutoFit(1, 1)).toBe(IMAGE_FIT_MODES.coverCrop);
		// 4:3 image in a 4:3 box
		expect(resolveAutoFit(4 / 3, 4 / 3)).toBe(IMAGE_FIT_MODES.coverCrop);
	});

	it('keeps cover-crop for moderately different ratios within the band', () => {
		// 16:9 image in a 4:3 box — divergence < threshold
		expect(resolveAutoFit(16 / 9, 4 / 3)).toBe(IMAGE_FIT_MODES.coverCrop);
	});

	it('contains very wide images (32:9 panorama) so content is not cropped', () => {
		expect(resolveAutoFit(32 / 9, 4 / 3)).toBe(IMAGE_FIT_MODES.containPadded);
	});

	it('contains very tall images (9:21 poster)', () => {
		expect(resolveAutoFit(9 / 21, 4 / 3)).toBe(IMAGE_FIT_MODES.containPadded);
	});

	it('treats exactly the threshold as still within the band (cover-crop)', () => {
		// divergence === threshold should NOT trigger contain (strict >)
		expect(resolveAutoFit(AUTO_CONTAIN_RATIO_THRESHOLD, 1)).toBe(IMAGE_FIT_MODES.coverCrop);
		// just beyond the threshold triggers contain
		expect(resolveAutoFit(AUTO_CONTAIN_RATIO_THRESHOLD + 0.01, 1)).toBe(
			IMAGE_FIT_MODES.containPadded,
		);
	});

	it('falls back to cover-crop for degenerate dimensions', () => {
		expect(resolveAutoFit(0, 1)).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(resolveAutoFit(-1, 1)).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(resolveAutoFit(Number.NaN, 1)).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(resolveAutoFit(1, 0)).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(resolveAutoFit(1, Number.POSITIVE_INFINITY)).toBe(IMAGE_FIT_MODES.coverCrop);
	});
});

describe('resolveFrameFill', () => {
	it('uses the extracted/manual color first when present (tier 1)', () => {
		expect(resolveFrameFill({ fillColor: 'oklch(0.58 0.13 25)', tokenScope: 'wishlist' })).toBe(
			'oklch(0.58 0.13 25)',
		);
		// tier 1 wins even in global scope
		expect(resolveFrameFill({ fillColor: '#aabbcc', tokenScope: 'global' })).toBe('#aabbcc');
	});

	it('ignores blank fill colors and falls through', () => {
		const result = resolveFrameFill({ fillColor: '   ', tokenScope: 'global' });
		expect(result).toBe('var(--surface-2)');
	});

	it('uses the wishlist image-frame token (tier 2) with the exact fallback chain order', () => {
		// strict priority: image-frame token → wishlist surface → global surface
		expect(resolveFrameFill({ fillColor: null, tokenScope: 'wishlist' })).toBe(
			'var(--wishlist-image-frame, var(--wishlist-surface, var(--surface-2)))',
		);
	});

	it('uses the global neutral surface (tier 3) when not in wishlist scope', () => {
		expect(resolveFrameFill({ fillColor: null, tokenScope: 'global' })).toBe(
			'var(--surface-2)',
		);
	});
});
