import { describe, it, expect } from 'vitest';
import {
	coverWindowLayout,
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
		// 16:9 image in a 4:3 box – divergence < threshold
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

describe('coverWindowLayout', () => {
	it('renders the contain framing at the contain zoom (letterbox on exactly one axis)', () => {
		// Square image in a 200×100 box: normalized aspect 2, contain zoom 0.5.
		// The whole 100×100 image sits centered with 50px fill bars left and right.
		const layout = coverWindowLayout({
			focal: { x: 50, y: 50 },
			zoom: 0.5,
			boxWidth: 200,
			boxHeight: 100,
			naturalRatio: 1,
		});
		expect(layout).toEqual({ left: 50, top: 0, width: 100, height: 100 });
	});

	it('pins the image to the window edge for an edge focal point', () => {
		const layout = coverWindowLayout({
			focal: { x: 0, y: 50 },
			zoom: 0.5,
			boxWidth: 200,
			boxHeight: 100,
			naturalRatio: 1,
		});
		// Focal 0% places the image flush with the window's left edge.
		expect(layout).toEqual({ left: 0, top: 0, width: 100, height: 100 });
	});

	it('keeps the covered axis covered between contain and cover zooms', () => {
		// zoom 0.8 on the same geometry: horizontal letterbox, vertical overflow.
		const layout = coverWindowLayout({
			focal: { x: 50, y: 50 },
			zoom: 0.8,
			boxWidth: 200,
			boxHeight: 100,
			naturalRatio: 1,
		});
		expect(layout).not.toBeNull();
		expect(layout!.width).toBeCloseTo(160, 6);
		expect(layout!.height).toBeCloseTo(160, 6);
		expect(layout!.left).toBeCloseTo(20, 6);
		// Vertical axis still overflows the 100px box (no fill on that axis).
		expect(layout!.top).toBeLessThan(0);
		expect(layout!.top + layout!.height).toBeGreaterThan(100);
	});

	it('returns null for unmeasured or degenerate geometry', () => {
		expect(
			coverWindowLayout({
				focal: { x: 50, y: 50 },
				zoom: 0.5,
				boxWidth: 0,
				boxHeight: 100,
				naturalRatio: 1,
			}),
		).toBeNull();
		expect(
			coverWindowLayout({
				focal: { x: 50, y: 50 },
				zoom: 0.5,
				boxWidth: 200,
				boxHeight: 100,
				naturalRatio: Number.NaN,
			}),
		).toBeNull();
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

	it('uses the palette surface token (tier 2) in wishlist scope', () => {
		// Redesign 2026: palette tokens re-derive per [data-palette] subtree, so the
		// wishlist scope resolves through the semantic secondary-surface token.
		expect(resolveFrameFill({ fillColor: null, tokenScope: 'wishlist' })).toBe(
			'var(--secondary)',
		);
	});

	it('uses the global neutral surface (tier 3) when not in wishlist scope', () => {
		expect(resolveFrameFill({ fillColor: null, tokenScope: 'global' })).toBe(
			'var(--surface-2)',
		);
	});
});
