import { describe, expect, it } from 'vitest';
import {
	IMAGE_ZOOM_MAX,
	centeredCropRect,
	zoomCropRect,
	zoomOutFloorForAspect,
} from '$lib/modules/images/index.js';
import { cropZoomControl } from './crop_zoom_control.js';

const LANDSCAPE_ASPECT = 4 / 3;

describe('cropZoomControl', () => {
	it('reads the cover framing as 100 % with room to zoom both ways', () => {
		const control = cropZoomControl(centeredCropRect(LANDSCAPE_ASPECT), LANDSCAPE_ASPECT);
		expect(control.percent).toBe(100);
		expect(control.maxPercent).toBe(IMAGE_ZOOM_MAX * 100);
		expect(control.canZoomOut).toBe(true);
		expect(control.canZoomIn).toBe(true);
	});

	it('lets the slider reach the zoom-out floor and stops zooming out there', () => {
		const floorRect = zoomCropRect(centeredCropRect(LANDSCAPE_ASPECT), LANDSCAPE_ASPECT, 0);
		const control = cropZoomControl(floorRect, LANDSCAPE_ASPECT);
		expect(control.percent).toBe(53);
		expect(control.minPercent).toBeLessThanOrEqual(
			zoomOutFloorForAspect(LANDSCAPE_ASPECT) * 100,
		);
		expect(control.minPercent).toBeLessThanOrEqual(control.percent);
		expect(control.canZoomOut).toBe(false);
	});

	it('keeps a zoom deeper than the floor reachable on the slider', () => {
		const width = 1 / 0.3;
		const height = width / LANDSCAPE_ASPECT;
		const inherited = { x: (1 - width) / 2, y: (1 - height) / 2, w: width, h: height };
		const control = cropZoomControl(inherited, LANDSCAPE_ASPECT);
		expect(control.percent).toBe(30);
		expect(control.minPercent).toBeLessThanOrEqual(30);
		expect(control.canZoomOut).toBe(false);
	});

	it('stops zooming in at the maximum zoom', () => {
		const deepest = zoomCropRect(
			centeredCropRect(LANDSCAPE_ASPECT),
			LANDSCAPE_ASPECT,
			IMAGE_ZOOM_MAX,
		);
		const control = cropZoomControl(deepest, LANDSCAPE_ASPECT);
		expect(control.percent).toBe(IMAGE_ZOOM_MAX * 100);
		expect(control.canZoomIn).toBe(false);
	});
});
