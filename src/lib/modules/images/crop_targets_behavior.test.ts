import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
	imageMetaToFrameProps,
	giftTargetFrameProps,
	resolveGiftTargetCrop,
	mergeGiftTargetCrops,
	cropRectToFocalZoom,
	focalZoomToWindowRect,
	renderedGiftTargetRect,
	normalizedCropAspect,
	type ImageFrameProps,
} from './crop.js';
import {
	DEFAULT_IMAGE_METADATA,
	GIFT_EDITOR_CROP_TARGET_VALUES,
	ImageMetadataSchema,
	type ImageCropRect,
} from './types.js';
import { GIFT_CROP_TARGET_SPECS, cropTargetSurfaceSize } from './crop_targets.js';
import { expectRectClose } from './crop.test_fixtures.js';
import { IMAGE_FIT_MODES } from '$lib/components/derived/image-frame/index.js';

describe('imageMetaToFrameProps', () => {
	it('returns renderer defaults when metadata is null', () => {
		expect(imageMetaToFrameProps(null)).toEqual({
			fitMode: IMAGE_FIT_MODES.auto,
			focal: { x: 50, y: 50 },
			zoom: 1,
			fillColor: null,
		});
	});

	it('passes through fit mode, focal, zoom and bgColor', () => {
		const props = imageMetaToFrameProps({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			focal: { x: 30, y: 70 },
			zoom: 2,
			bgColor: '#abcdef',
		});
		expect(props).toEqual({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			focal: { x: 30, y: 70 },
			zoom: 2,
			fillColor: '#abcdef',
		});
	});

	it('passes a persisted zoom-out through unclamped (#116 round 2)', () => {
		const props = imageMetaToFrameProps({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			focal: { x: 50, y: 50 },
			zoom: 0.8,
		});
		// A render-time floor of 1 would snap saved letterboxed crops back to cover.
		expect(props.zoom).toBe(0.8);
	});

	it('uses the default metadata without throwing', () => {
		const props = imageMetaToFrameProps(DEFAULT_IMAGE_METADATA);
		expect(props.fitMode).toBe(IMAGE_FIT_MODES.auto);
		expect(props.focal).toEqual({ x: 50, y: 50 });
		expect(props.zoom).toBe(1);
		expect(props.fillColor).toBeNull();
	});
});

describe('resolveGiftTargetCrop (shared carry-over chain, #189)', () => {
	const crop = (zoom: number) => ({
		cropRect: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
		focal: { x: 20, y: 20 },
		zoom,
	});

	it("returns the target's own crop when present", () => {
		const targets = { square: crop(2), thumb: crop(3) };
		expect(resolveGiftTargetCrop(targets, 'thumb')).toBe(targets.thumb);
		expect(resolveGiftTargetCrop(targets, 'square')).toBe(targets.square);
	});

	it('falls back square→card and thumb→square without a data migration', () => {
		expect(resolveGiftTargetCrop({ card: crop(2) }, 'square')).toEqual(crop(2));
		expect(resolveGiftTargetCrop({ square: crop(2) }, 'thumb')).toEqual(crop(2));
	});

	it('returns undefined when neither the target nor its fallback exists', () => {
		expect(resolveGiftTargetCrop(undefined, 'thumb')).toBeUndefined();
		expect(resolveGiftTargetCrop({}, 'square')).toBeUndefined();
		// `card` has no fallback of its own.
		expect(resolveGiftTargetCrop({ thumb: crop(2) }, 'card')).toBeUndefined();
	});
});

describe('giftTargetFrameProps', () => {
	const baseMeta = {
		fitMode: IMAGE_FIT_MODES.auto,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor: '#123456',
	};

	it('renders legacy rows unchanged when no per-target crop exists (REQ-8)', () => {
		const expected: ImageFrameProps = imageMetaToFrameProps(baseMeta);
		expect(giftTargetFrameProps(baseMeta, 'card')).toEqual(expected);
		expect(giftTargetFrameProps(null, 'square')).toEqual(imageMetaToFrameProps(null));
	});

	it('overrides only the target that has a manual crop (D1)', () => {
		const cardRect: ImageCropRect = {
			x: 0,
			y: 0.2,
			w: 1,
			h: 1 / GIFT_CROP_TARGET_SPECS.card.aspect,
		};
		const { focal, zoom } = cropRectToFocalZoom(cardRect);
		// Manual crops require a cover-crop base since the #116 follow-up.
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: { card: { cropRect: cardRect, focal, zoom } },
		};
		const cardProps = giftTargetFrameProps(meta, 'card');
		expect(cardProps.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(cardProps.focal).toEqual(focal);
		expect(cardProps.zoom).toBe(zoom);
		expect(cardProps.fillColor).toBe('#123456');
		// The other targets keep the automatic framing.
		expect(giftTargetFrameProps(meta, 'detail')).toEqual(imageMetaToFrameProps(meta));
	});

	it('ignores stale per-target crops when the base mode is fit (#116 follow-up)', () => {
		// Fit must letterbox both axes even when manual crops linger in
		// the metadata; per-target crops only apply on a cover-crop base.
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.containPadded,
			targets: {
				card: {
					cropRect: { x: 0, y: 0, w: 0.5, h: 0.5 },
					focal: { x: 0, y: 0 },
					zoom: 2,
				},
			},
		};
		const props = giftTargetFrameProps(meta, 'card');
		expect(props).toEqual(imageMetaToFrameProps(meta));
		expect(props.fitMode).toBe(IMAGE_FIT_MODES.containPadded);
	});

	it('honours a cover-crop base with a manual target when zoom is one', () => {
		// A cover-crop base consults targets regardless of the base focal/zoom.
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: {
				square: {
					cropRect: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
					focal: { x: 20, y: 20 },
					zoom: 2,
				},
			},
		};
		expect(giftTargetFrameProps(meta, 'square').zoom).toBe(2);
	});

	it('uses a legacy card crop as a square-only fallback until a square crop exists (#163)', () => {
		const legacyCardCrop = {
			cropRect: { x: 0, y: 0.2, w: 1, h: 1 / GIFT_CROP_TARGET_SPECS.card.aspect },
			focal: { x: 50, y: 31.25 },
			zoom: 1,
		};
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: { card: legacyCardCrop },
		};

		// The card surface was replaced by the square family. Its legacy crop keeps
		// rendering only as the square fallback, never as a detail override.
		expect(giftTargetFrameProps(meta, 'square').focal).toEqual(legacyCardCrop.focal);
		expect(giftTargetFrameProps(meta, 'square').zoom).toBe(legacyCardCrop.zoom);
		expect(giftTargetFrameProps(meta, 'detail')).toEqual(imageMetaToFrameProps(meta));

		const squareCrop = {
			cropRect: { x: 0.2, y: 0.1, w: 0.6, h: 0.6 },
			focal: { x: 50, y: 25 },
			zoom: 1.5,
		};
		const migratedMeta = { ...meta, targets: { ...meta.targets, square: squareCrop } };
		expect(giftTargetFrameProps(migratedMeta, 'square').focal).toEqual(squareCrop.focal);
		expect(giftTargetFrameProps(migratedMeta, 'square').zoom).toBe(squareCrop.zoom);
	});

	it('renders a manual thumb crop for the 1:1 thumb target (#189 REQ-1)', () => {
		const thumbCrop = {
			cropRect: { x: 0.1, y: 0.1, w: 0.6, h: 0.6 },
			focal: { x: 30, y: 40 },
			zoom: 1.5,
		};
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: { thumb: thumbCrop },
		};
		const props = giftTargetFrameProps(meta, 'thumb');
		expect(props.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(props.focal).toEqual(thumbCrop.focal);
		expect(props.zoom).toBe(thumbCrop.zoom);
	});

	it('carries a square crop over to the thumb target until a thumb crop exists (#189 REQ-3)', () => {
		const squareCrop = {
			cropRect: { x: 0.2, y: 0.1, w: 0.6, h: 0.6 },
			focal: { x: 50, y: 25 },
			zoom: 1.5,
		};
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: { square: squareCrop },
		};
		// No thumb crop yet: the 1:1 thumb reads the square framing as its
		// render-time carry-over (no data migration), mirroring square→card.
		expect(giftTargetFrameProps(meta, 'thumb').focal).toEqual(squareCrop.focal);
		expect(giftTargetFrameProps(meta, 'thumb').zoom).toBe(squareCrop.zoom);

		const thumbCrop = {
			cropRect: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
			focal: { x: 20, y: 20 },
			zoom: 2,
		};
		const editedMeta = { ...meta, targets: { ...meta.targets, thumb: thumbCrop } };
		// An explicit thumb crop supersedes the square carry-over.
		expect(giftTargetFrameProps(editedMeta, 'thumb').focal).toEqual(thumbCrop.focal);
		expect(giftTargetFrameProps(editedMeta, 'thumb').zoom).toBe(thumbCrop.zoom);
	});

	it('frames a following thumb by the card’s contain-to-cover position once the photo is measured', () => {
		// A square photo: card Fit is zoom 0.75, the step in from it 0.85; the 1:1 thumb's
		// contain equals cover, so both show the whole photo there.
		const squareCrop = { cropRect: { x: 0, y: 0, w: 1, h: 0.75 }, focal: { x: 50, y: 40 } };
		const followingMeta = (zoom: number) => ({
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: { square: { ...squareCrop, zoom } },
		});
		expect(giftTargetFrameProps(followingMeta(0.75), 'thumb', 1).zoom).toBeCloseTo(1, 10);
		expect(giftTargetFrameProps(followingMeta(0.85), 'thumb', 1).zoom).toBeCloseTo(1, 10);
		expect(giftTargetFrameProps(followingMeta(0.85), 'thumb', 1).focal).toEqual(
			squareCrop.focal,
		);
		expect(giftTargetFrameProps(followingMeta(1.5), 'thumb', 1).zoom).toBeCloseTo(1.5, 10);
		// The card itself and a thumb with its own crop keep their stored zoom.
		expect(giftTargetFrameProps(followingMeta(0.85), 'square', 1).zoom).toBe(0.85);
		const ownThumbMeta = {
			...followingMeta(0.85),
			targets: { square: { ...squareCrop, zoom: 0.85 }, thumb: { ...squareCrop, zoom: 0.9 } },
		};
		expect(giftTargetFrameProps(ownThumbMeta, 'thumb', 1).zoom).toBe(0.9);
	});

	// Card zooms below the card's contain, between contain and cover, and beyond cover for a
	// tall 1:2 (card contain 3/8), a square (3/4) and a wide 2:1 (2/3) photo.
	it.each([
		[0.5, 0.3],
		[0.5, 0.7],
		[0.5, 1.5],
		[1, 0.6],
		[1, 0.85],
		[1, 1.5],
		[2, 0.5],
		[2, 0.8],
		[2, 1.5],
	])(
		'opens a following thumb in the editor as the renderer shows it (photo ratio %s, card zoom %s)',
		(imageRatio, cardZoom) => {
			const cardRect = focalZoomToWindowRect(
				{ x: 30, y: 70 },
				cardZoom,
				normalizedCropAspect(GIFT_CROP_TARGET_SPECS.square.aspect, imageRatio),
			);
			const meta = {
				...baseMeta,
				fitMode: IMAGE_FIT_MODES.coverCrop,
				targets: { square: { cropRect: cardRect, ...cropRectToFocalZoom(cardRect) } },
			};

			const editorThumb = renderedGiftTargetRect(meta, 'thumb', imageRatio);
			const rendered = giftTargetFrameProps(meta, 'thumb', imageRatio);

			expect(rendered.focal.x).toBeCloseTo(30, 10);
			expect(rendered.focal.y).toBeCloseTo(70, 10);
			expect(cropRectToFocalZoom(editorThumb).zoom).toBeCloseTo(rendered.zoom, 10);
			// The same focal and zoom draw the same window; an axis the window spans fully has
			// no focal to compare, so the window is the comparison.
			expectRectClose(
				editorThumb,
				focalZoomToWindowRect(
					rendered.focal,
					rendered.zoom,
					normalizedCropAspect(GIFT_CROP_TARGET_SPECS.thumb.aspect, imageRatio),
				),
			);
		},
	);

	it('falls back to the base framing for thumb when neither thumb nor square exists (#189)', () => {
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
		};
		expect(giftTargetFrameProps(meta, 'thumb')).toEqual(imageMetaToFrameProps(meta));
	});
});

describe('mergeGiftTargetCrops', () => {
	it('replaces the legacy card target when a manual square crop is saved (#163)', () => {
		const legacyCardCrop = {
			cropRect: { x: 0, y: 0.2, w: 1, h: 0.36 },
			focal: { x: 50, y: 31.25 },
			zoom: 1,
		};
		const detailCrop = {
			cropRect: { x: 0.2, y: 0, w: 0.5, h: 1 },
			focal: { x: 40, y: 50 },
			zoom: 1,
		};
		const squareCrop = {
			cropRect: { x: 0.15, y: 0.15, w: 0.7, h: 0.7 },
			focal: { x: 50, y: 50 },
			zoom: 1 / 0.7,
		};

		expect(
			mergeGiftTargetCrops(
				{ card: legacyCardCrop, detail: detailCrop },
				{ square: squareCrop },
			),
		).toEqual({ detail: detailCrop, square: squareCrop });
	});

	it('preserves a legacy card fallback when the (sole) square target is untouched this session', () => {
		// Issue #165 retired `detail` from the editor targets, so the only two
		// reachable `editedTargets` shapes are `{}` (nothing touched) and
		// `{ square }` (covered above) – there is no longer a third target whose
		// edit could leave the card fallback in place while adding its own entry.
		const legacyCardCrop = {
			cropRect: { x: 0, y: 0.2, w: 1, h: 0.36 },
			focal: { x: 50, y: 31.25 },
			zoom: 1,
		};

		expect(mergeGiftTargetCrops({ card: legacyCardCrop }, {})).toEqual({
			card: legacyCardCrop,
		});
	});

	it('preserves a thumb edit alongside an existing square target (#189)', () => {
		const squareCrop = {
			cropRect: { x: 0.15, y: 0.15, w: 0.7, h: 0.7 },
			focal: { x: 50, y: 50 },
			zoom: 1 / 0.7,
		};
		const thumbCrop = {
			cropRect: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
			focal: { x: 40, y: 40 },
			zoom: 1 / 0.6,
		};
		// Editing only the thumb keeps the existing square target intact – both survive.
		expect(mergeGiftTargetCrops({ square: squareCrop }, { thumb: thumbCrop })).toEqual({
			square: squareCrop,
			thumb: thumbCrop,
		});
	});

	it('still drops the legacy card fallback when a square crop is edited beside a thumb (#189)', () => {
		const legacyCardCrop = {
			cropRect: { x: 0, y: 0.2, w: 1, h: 0.36 },
			focal: { x: 50, y: 31.25 },
			zoom: 1,
		};
		const squareCrop = {
			cropRect: { x: 0.15, y: 0.15, w: 0.7, h: 0.7 },
			focal: { x: 50, y: 50 },
			zoom: 1 / 0.7,
		};
		const thumbCrop = {
			cropRect: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
			focal: { x: 40, y: 40 },
			zoom: 1 / 0.6,
		};
		// Editing the square still supersedes the legacy card; the thumb rides along.
		expect(
			mergeGiftTargetCrops(
				{ card: legacyCardCrop },
				{ square: squareCrop, thumb: thumbCrop },
			),
		).toEqual({ square: squareCrop, thumb: thumbCrop });
	});
});

describe('thumb crop target spec + schema (#189)', () => {
	it('exposes the thumb target as a true 1:1 aspect (REQ-1)', () => {
		expect(GIFT_CROP_TARGET_SPECS).toMatchObject({
			square: { aspect: 4 / 3 },
			thumb: { aspect: 1 },
		});
	});

	it('accepts a persisted targets.thumb crop row', () => {
		const meta = {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: {
				thumb: {
					cropRect: { x: 0.1, y: 0.1, w: 0.6, h: 0.6 },
					focal: { x: 30, y: 40 },
					zoom: 1.5,
				},
			},
		};
		const parsed = v.parse(ImageMetadataSchema, meta);
		expect(parsed.targets?.thumb?.focal).toEqual({ x: 30, y: 40 });
	});
});

describe('cropTargetSurfaceSize (crop window at true size, #533)', () => {
	it('uses the desktop surface size outside the compact viewport', () => {
		expect(cropTargetSurfaceSize(GIFT_CROP_TARGET_SPECS.square, false)).toEqual({
			width: GIFT_CROP_TARGET_SPECS.square.realWidth,
			height: GIFT_CROP_TARGET_SPECS.square.realHeight,
		});
	});

	it('uses the phone surface size in the compact viewport, keeping the target aspect', () => {
		for (const target of GIFT_EDITOR_CROP_TARGET_VALUES) {
			const spec = GIFT_CROP_TARGET_SPECS[target];
			const size = cropTargetSurfaceSize(spec, true);
			expect(size.width).toBe(spec.compactRealWidth);
			expect(size.width / size.height).toBeCloseTo(spec.aspect, 1);
		}
	});
});

describe('gift crop editor targets', () => {
	it('offers the square (4:3 card) and thumb (1:1 list + reservation) targets (#189)', () => {
		// #165 retired `detail`, leaving only `square`; #189 adds the true 1:1
		// `thumb` target for the wishlist-list row + reservation thumb.
		expect(GIFT_EDITOR_CROP_TARGET_VALUES).toEqual(['square', 'thumb']);
	});
});
