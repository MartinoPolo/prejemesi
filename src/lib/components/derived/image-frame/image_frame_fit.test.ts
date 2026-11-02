import { describe, it, expect } from 'vitest';
import {
	coverWindowLayout,
	hasExplicitFrameFill,
	normalizeFrameFill,
	paintedImageWidth,
	resolveAutoFit,
	resolveFrameFill,
	AUTO_CONTAIN_RATIO_THRESHOLD,
	IMAGE_FIT_MODES,
} from './image_frame_fit.js';
import {
	FULL_CROP_RECT,
	framedGiftImageMeta,
	giftTargetFrameProps,
} from '$lib/modules/images/crop.js';

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
	it('renders an agent-framed 3:4 box shot inside both gift frames with the gap on every side', () => {
		// A whole 600×800 px box shot framed with a 7.5 % gap: on the 400×300 card and
		// the 300×300 thumb the photo is 85 % of the frame height (255 px, 22.5 px clear
		// above and below), 255 × 3/4 = 191.25 px wide, and centered horizontally.
		const meta = framedGiftImageMeta({
			width: 600,
			height: 800,
			box: FULL_CROP_RECT,
			gapPerSide: 0.075,
			bgColor: '#ffffff',
		});
		const frames = [
			{ target: 'square', boxWidth: 400, boxHeight: 300 },
			{ target: 'thumb', boxWidth: 300, boxHeight: 300 },
		] as const;
		for (const { target, boxWidth, boxHeight } of frames) {
			const { focal, zoom, fitMode, fillColor } = giftTargetFrameProps(meta, target);
			expect(fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
			expect(fillColor).toBe('#ffffff');
			const layout = coverWindowLayout({
				focal,
				zoom,
				boxWidth,
				boxHeight,
				naturalRatio: 0.75,
			});
			expect(layout).not.toBeNull();
			expect(layout!.height).toBeCloseTo(255, 6);
			expect(layout!.top).toBeCloseTo(22.5, 6);
			expect(layout!.width).toBeCloseTo(191.25, 6);
			expect(layout!.left).toBeCloseTo((boxWidth - 191.25) / 2, 6);
		}
	});

	it('renders agent-framed products in a landscape photo with the gap clear on every side of both gift frames', () => {
		// 1500×1000 px photo, 7.5 % gap: every side of the product keeps at least 0.075 ×
		// the frame dimension of its axis clear, and a side bounding the limiting span
		// keeps exactly that (22.5 px of a 300 px side). Off-center product (0.3 × 0.4):
		// on the 4:3 card (normalized aspect 8/9) its height limits (0.4 × 8/9 > 0.3), on
		// the 1:1 thumb (2/3) its width does (0.3 > 0.4 × 2/3); neither window clamps.
		// Top-edge product: the vertical span becomes the whole image height, which limits
		// on both frames, so only its top side (the image's top edge) sits exactly at it.
		const gapPerSide = 0.075;
		const products = [
			{
				box: { x: 0.55, y: 0.15, w: 0.3, h: 0.4 },
				sidesAtGap: { square: ['top', 'bottom'], thumb: ['left', 'right'] },
			},
			{
				box: { x: 0.4, y: 0, w: 0.2, h: 0.3 },
				sidesAtGap: { square: ['top'], thumb: ['top'] },
			},
		] as const;
		const frames = [
			{ target: 'square', boxWidth: 400, boxHeight: 300 },
			{ target: 'thumb', boxWidth: 300, boxHeight: 300 },
		] as const;
		for (const { box, sidesAtGap } of products) {
			const meta = framedGiftImageMeta({
				width: 1500,
				height: 1000,
				box,
				gapPerSide,
				bgColor: '#ffffff',
			});
			for (const { target, boxWidth, boxHeight } of frames) {
				const { focal, zoom } = giftTargetFrameProps(meta, target);
				const layout = coverWindowLayout({
					focal,
					zoom,
					boxWidth,
					boxHeight,
					naturalRatio: 1.5,
				});
				expect(layout).not.toBeNull();
				const productLeft = layout!.left + box.x * layout!.width;
				const productTop = layout!.top + box.y * layout!.height;
				const clearance = {
					left: productLeft,
					right: boxWidth - (productLeft + box.w * layout!.width),
					top: productTop,
					bottom: boxHeight - (productTop + box.h * layout!.height),
				};
				const minimumClearance = {
					left: gapPerSide * boxWidth,
					right: gapPerSide * boxWidth,
					top: gapPerSide * boxHeight,
					bottom: gapPerSide * boxHeight,
				};
				for (const side of ['left', 'right', 'top', 'bottom'] as const) {
					expect(clearance[side]).toBeGreaterThanOrEqual(minimumClearance[side] - 1e-6);
				}
				for (const side of sidesAtGap[target]) {
					expect(clearance[side]).toBeCloseTo(minimumClearance[side], 6);
				}
			}
		}
	});

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

	it('shrinks the whole image inside the box on both axes past the contain zoom', () => {
		// Square image in a 400×300 box: contain zoom 0.75, the floor 0.525 leaves
		// the 210 px image 15 % of the box height clear above and below.
		const layout = coverWindowLayout({
			focal: { x: 50, y: 50 },
			zoom: 0.525,
			boxWidth: 400,
			boxHeight: 300,
			naturalRatio: 1,
		});
		expect(layout).not.toBeNull();
		expect(layout!.width).toBeCloseTo(210, 6);
		expect(layout!.height).toBeCloseTo(210, 6);
		expect(layout!.left).toBeCloseTo(95, 6);
		expect(layout!.top).toBeCloseTo(45, 6);
	});

	it('pins an image smaller than the box to the corner of an edge focal point', () => {
		const layout = coverWindowLayout({
			focal: { x: 100, y: 0 },
			zoom: 0.525,
			boxWidth: 400,
			boxHeight: 300,
			naturalRatio: 1,
		});
		expect(layout!.left + layout!.width).toBeCloseTo(400, 6);
		expect(layout!.top).toBeCloseTo(0, 6);
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

describe('paintedImageWidth', () => {
	const squareBox = {
		boxWidth: 150,
		boxHeight: 150,
		fallbackBoxWidth: 300,
		zoomOutLayout: null,
	} as const;

	it('covers the overscanned width of a landscape source cropped into a square box', () => {
		expect(
			paintedImageWidth({
				...squareBox,
				fit: IMAGE_FIT_MODES.coverCrop,
				zoom: 1,
				naturalRatio: 1.5,
			}),
		).toBe(225);
	});

	it('uses the box width when a portrait source covers a square box', () => {
		expect(
			paintedImageWidth({
				...squareBox,
				fit: IMAGE_FIT_MODES.coverCrop,
				zoom: 1,
				naturalRatio: 0.75,
			}),
		).toBe(150);
	});

	it('multiplies by the focal zoom, since a zoomed crop shows fewer source pixels', () => {
		expect(
			paintedImageWidth({
				...squareBox,
				fit: IMAGE_FIT_MODES.coverCrop,
				zoom: 3,
				naturalRatio: 1.5,
			}),
		).toBe(675);
	});

	it('never exceeds the box for contained images', () => {
		expect(
			paintedImageWidth({
				...squareBox,
				fit: IMAGE_FIT_MODES.containPadded,
				zoom: 2,
				naturalRatio: 3,
			}),
		).toBe(150);
	});

	it('uses the explicit layout width when zoomed out below cover', () => {
		expect(
			paintedImageWidth({
				...squareBox,
				fit: IMAGE_FIT_MODES.coverCrop,
				zoom: 0.8,
				naturalRatio: 1.5,
				zoomOutLayout: { left: 0, top: 10, width: 180, height: 120 },
			}),
		).toBe(180);
	});

	it('falls back to the surface width (times zoom) before the box is measured', () => {
		expect(
			paintedImageWidth({
				...squareBox,
				boxWidth: 0,
				boxHeight: 0,
				fit: IMAGE_FIT_MODES.coverCrop,
				zoom: 2,
				naturalRatio: null,
			}),
		).toBe(600);
	});

	it('uses the measured box width before the natural ratio is known', () => {
		expect(
			paintedImageWidth({
				...squareBox,
				fit: IMAGE_FIT_MODES.coverCrop,
				zoom: 1,
				naturalRatio: null,
			}),
		).toBe(150);
	});
});

describe('resolveFrameFill', () => {
	it('normalizes null, blank, and legacy transparent to the default fallback', () => {
		expect(normalizeFrameFill(null)).toBeNull();
		expect(normalizeFrameFill('   ')).toBeNull();
		expect(normalizeFrameFill('transparent')).toBeNull();
		expect(hasExplicitFrameFill('transparent')).toBe(false);
		expect(resolveFrameFill({ fillColor: 'transparent', tokenScope: 'wishlist' })).toBe(
			'var(--wishlist-image-mat, var(--secondary))',
		);
	});

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
			'var(--wishlist-image-mat, var(--secondary))',
		);
	});

	it('uses the global neutral surface (tier 3) when not in wishlist scope', () => {
		expect(resolveFrameFill({ fillColor: null, tokenScope: 'global' })).toBe(
			'var(--surface-2)',
		);
	});
});
