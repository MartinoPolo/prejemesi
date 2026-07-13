import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
	IMAGE_EDITOR_MODES,
	fitModeForEditorMode,
	giftEditorModeFromMeta,
	slotEditorModeFromMeta,
	fillImageMeta,
	wholeImageMeta,
} from './editor_modes.js';
import { ImageMetadataSchema, type ImageMetadata } from './types.js';
import { IMAGE_FIT_MODES } from '$lib/components/derived/image-frame/index.js';

describe('fitModeForEditorMode', () => {
	it('maps whole to contain-padded and both fill and manual to cover-crop', () => {
		expect(fitModeForEditorMode(IMAGE_EDITOR_MODES.whole)).toBe(IMAGE_FIT_MODES.containPadded);
		expect(fitModeForEditorMode(IMAGE_EDITOR_MODES.fill)).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(fitModeForEditorMode(IMAGE_EDITOR_MODES.manual)).toBe(IMAGE_FIT_MODES.coverCrop);
	});
});

describe('giftEditorModeFromMeta', () => {
	it('defaults to fill for missing metadata and legacy auto rows', () => {
		expect(giftEditorModeFromMeta(null)).toBe(IMAGE_EDITOR_MODES.fill);
		expect(giftEditorModeFromMeta(undefined)).toBe(IMAGE_EDITOR_MODES.fill);
		expect(giftEditorModeFromMeta({ fitMode: IMAGE_FIT_MODES.auto })).toBe(
			IMAGE_EDITOR_MODES.fill,
		);
	});

	it('reads contain-padded as whole picture', () => {
		expect(giftEditorModeFromMeta({ fitMode: IMAGE_FIT_MODES.containPadded })).toBe(
			IMAGE_EDITOR_MODES.whole,
		);
	});

	it('reads cover-crop as manual only when per-target crops exist', () => {
		expect(giftEditorModeFromMeta({ fitMode: IMAGE_FIT_MODES.coverCrop })).toBe(
			IMAGE_EDITOR_MODES.fill,
		);
		expect(giftEditorModeFromMeta({ fitMode: IMAGE_FIT_MODES.coverCrop, targets: {} })).toBe(
			IMAGE_EDITOR_MODES.fill,
		);
		const withTargets: ImageMetadata = {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: {
				card: {
					cropRect: { x: 0, y: 0.2, w: 1, h: 0.36 },
					focal: { x: 50, y: 31.25 },
					zoom: 1,
				},
			},
		};
		expect(giftEditorModeFromMeta(withTargets)).toBe(IMAGE_EDITOR_MODES.manual);
	});
});

describe('slotEditorModeFromMeta', () => {
	it('defaults to fill for missing metadata and legacy auto rows', () => {
		expect(slotEditorModeFromMeta(null)).toBe(IMAGE_EDITOR_MODES.fill);
		expect(slotEditorModeFromMeta({ fitMode: IMAGE_FIT_MODES.auto })).toBe(
			IMAGE_EDITOR_MODES.fill,
		);
	});

	it('reads contain-padded as whole picture', () => {
		expect(slotEditorModeFromMeta({ fitMode: IMAGE_FIT_MODES.containPadded })).toBe(
			IMAGE_EDITOR_MODES.whole,
		);
	});

	it('reads a centered zoom-1 cover-crop as fill', () => {
		expect(slotEditorModeFromMeta(fillImageMeta())).toBe(IMAGE_EDITOR_MODES.fill);
	});

	it('reads any user-drawn cover-crop framing as manual', () => {
		expect(
			slotEditorModeFromMeta({
				fitMode: IMAGE_FIT_MODES.coverCrop,
				focal: { x: 30, y: 50 },
				zoom: 1,
			}),
		).toBe(IMAGE_EDITOR_MODES.manual);
		expect(
			slotEditorModeFromMeta({
				fitMode: IMAGE_FIT_MODES.coverCrop,
				focal: { x: 50, y: 50 },
				zoom: 1.2,
			}),
		).toBe(IMAGE_EDITOR_MODES.manual);
	});

	it('derives the framing from cropRect when focal/zoom are absent', () => {
		expect(
			slotEditorModeFromMeta({
				fitMode: IMAGE_FIT_MODES.coverCrop,
				cropRect: { x: 0, y: 0, w: 0.5, h: 0.5 },
			}),
		).toBe(IMAGE_EDITOR_MODES.manual);
	});
});

describe('fillImageMeta / wholeImageMeta', () => {
	it('produce schema-valid metadata with independent objects per call', () => {
		expect(() => v.parse(ImageMetadataSchema, fillImageMeta())).not.toThrow();
		expect(() => v.parse(ImageMetadataSchema, wholeImageMeta())).not.toThrow();
		expect(fillImageMeta()).not.toBe(fillImageMeta());
		expect(fillImageMeta().focal).not.toBe(fillImageMeta().focal);
	});

	it('differ only in fitMode and carry the bgColor through', () => {
		expect(fillImageMeta('#abcdef')).toEqual({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: null,
			focal: { x: 50, y: 50 },
			zoom: 1,
			bgColor: '#abcdef',
		});
		expect(wholeImageMeta().fitMode).toBe(IMAGE_FIT_MODES.containPadded);
	});
});
