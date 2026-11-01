import { describe, expect, it } from 'vitest';
import {
	centeredVisibleBand,
	cropWindowBox,
	photoBoxBehindWindow,
	photoBoxWithinInset,
	visiblePhotoRegion,
} from './crop_stage_geometry.js';

describe('cropWindowBox', () => {
	it('draws the window at the surface real size, centered in the stage', () => {
		expect(cropWindowBox({ width: 500, height: 400 }, { width: 356, height: 267 }, 28)).toEqual(
			{
				width: 356,
				height: 267,
				left: 72,
				top: 66.5,
				scale: 1,
			},
		);
	});

	it('scales the window down only when the real size does not fit', () => {
		const box = cropWindowBox({ width: 300, height: 400 }, { width: 488, height: 172 }, 28);
		expect(box?.scale).toBeCloseTo(244 / 488, 10);
		expect(box?.width).toBeCloseTo(244, 10);
		expect(box?.height).toBeCloseTo(86, 10);
	});

	it('returns null before the stage has room', () => {
		expect(
			cropWindowBox({ width: 40, height: 400 }, { width: 100, height: 100 }, 28),
		).toBeNull();
	});
});

describe('photoBoxBehindWindow', () => {
	it('places the photo so the crop rect lands exactly on the window', () => {
		const window = { left: 50, top: 20, width: 200, height: 100 };
		const photo = photoBoxBehindWindow({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, window);
		expect(photo).toEqual({ width: 400, height: 400, left: -50, top: -180 });
	});
});

describe('photoBoxWithinInset', () => {
	// A 4:3 window with a 10% margin of its 300px shorter side: a 340 × 240 inset box.
	const window = { left: 10, top: 20, width: 400, height: 300 };
	const inset = 30;
	const box = (width: number, height: number, left: number, top: number) => ({
		width: expect.closeTo(width, 9),
		height: expect.closeTo(height, 9),
		left: expect.closeTo(left, 9),
		top: expect.closeTo(top, 9),
	});

	it('keeps a photo with a different aspect whole, unstretched and centred in the inset box', () => {
		// Square: height-bound, so the margin is the gap above and below.
		const square = photoBoxWithinInset({ width: 300, height: 300 }, window, inset);
		expect(square).toEqual(box(240, 240, 10 + 80, 20 + 30));

		// 2:1: width-bound, so the margin is the gap left and right.
		const wide = photoBoxWithinInset({ width: 400, height: 200 }, window, inset);
		expect(wide).toEqual(box(340, 170, 10 + 30, 20 + 65));
	});

	it('leaves a photo already contained in the window unchanged without an inset', () => {
		const photo = photoBoxWithinInset({ width: 200, height: 300 }, window, 0);
		expect(photo).toEqual(box(200, 300, 110, 20));
	});
});

describe('visiblePhotoRegion', () => {
	it('clips a letterboxed window to the photo', () => {
		expect(visiblePhotoRegion({ x: -0.5, y: 0, w: 2, h: 1 })).toEqual({
			x: 0,
			y: 0,
			w: 1,
			h: 1,
		});
	});
});

describe('centeredVisibleBand', () => {
	it('returns the centered slice a narrower frame keeps', () => {
		const band = centeredVisibleBand(0.6);
		expect(band.from).toBeCloseTo(0.2, 10);
		expect(band.to).toBeCloseTo(0.8, 10);
	});
});
