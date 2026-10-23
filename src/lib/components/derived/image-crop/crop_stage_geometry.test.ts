import { describe, expect, it } from 'vitest';
import {
	centeredVisibleBand,
	cropWindowBox,
	photoBoxBehindWindow,
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
