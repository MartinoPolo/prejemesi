import { describe, expect, it, vi } from 'vitest';
import { MAX_GIFT_IMAGES, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import {
	centeredCropRect,
	containCropRect,
	cropRectToFocalZoom,
	focalZoomToWindowRect,
	giftTargetFrameProps,
	normalizedCropAspect,
	panCropRect,
	renderedGiftTargetRect,
	zoomCropRect,
	GIFT_CROP_TARGET_SPECS,
	GIFT_EDITOR_CROP_TARGET_VALUES,
	GIFT_FRAMINGS,
	IMAGE_FIT_MODES,
	type GiftEditorCropTarget,
	type GiftFramingPreset,
	type ImageCropRect,
	type ImageFocalPoint,
	type ImageMetadata,
} from '$lib/modules/images/index.js';
import { resolveAutoFit } from '$lib/modules/images/fit_modes.js';
import { expectRectClose } from '$lib/modules/images/crop.test_fixtures.js';
import { GiftImageDraft, GiftImageGalleryDraft } from './gift_image_gallery_draft.svelte.js';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_R2_URL: '/' } }));

const containMeta: ImageMetadata = {
	fitMode: IMAGE_FIT_MODES.containPadded,
	cropRect: null,
	focal: { x: 50, y: 50 },
	zoom: 1,
	bgColor: null,
};

function storedImage(name: string, imageMeta: ImageMetadata | null = containMeta): GiftImage {
	return { imageUrl: `https://shop.example/${name}.jpg`, imageKey: null, imageMeta };
}

function galleryOf(...names: string[]) {
	const images = names.map((name) => storedImage(name));
	return new GiftImageGalleryDraft({
		imageUrl: images[0]?.imageUrl ?? null,
		imageKey: null,
		imageMeta: images[0]?.imageMeta ?? null,
		images,
	});
}

function savedUrls(gallery: GiftImageGalleryDraft): (string | null)[] {
	return gallery.toGiftImages().map((image) => image.imageUrl);
}

function linkedImage(name: string): GiftImageDraft {
	const image = new GiftImageDraft();
	image.imageUrl = `https://shop.example/${name}.jpg`;
	return image;
}

describe('GiftImageGalleryDraft', () => {
	it('opens a gift without a loaded gallery on its cover', () => {
		const gallery = new GiftImageGalleryDraft({
			imageUrl: 'https://shop.example/cover.jpg',
			imageKey: null,
			imageMeta: containMeta,
			images: [],
		});

		expect(savedUrls(gallery)).toEqual(['https://shop.example/cover.jpg']);
		expect(gallery.changed).toBe(false);
	});

	it('saves an untouched gallery unchanged, in order, with every image keeping its own metadata', () => {
		const blackMeta: ImageMetadata = { ...containMeta, bgColor: '#000000' };
		const gallery = new GiftImageGalleryDraft({
			imageUrl: 'https://shop.example/a.jpg',
			imageKey: null,
			imageMeta: containMeta,
			images: [storedImage('a'), storedImage('b', blackMeta)],
		});

		expect(gallery.changed).toBe(false);
		expect(gallery.toGiftImages()).toEqual([
			{ imageUrl: 'https://shop.example/a.jpg', imageKey: null, imageMeta: containMeta },
			{ imageUrl: 'https://shop.example/b.jpg', imageKey: null, imageMeta: blackMeta },
		]);
	});

	it('selects the cover first and edits only the selected image', () => {
		const gallery = galleryOf('a', 'b');
		expect(gallery.selected?.imageUrl).toBe('https://shop.example/a.jpg');

		gallery.select(gallery.images[1]!.id);
		gallery.selected?.chooseBackground('#ffffff');

		const [cover, second] = gallery.toGiftImages();
		expect(cover?.imageMeta?.bgColor).toBeNull();
		expect(second?.imageMeta?.bgColor).toBe('#ffffff');
		expect(gallery.changed).toBe(true);
	});

	it('makes the first image the cover after a reorder and counts the reorder as a change', () => {
		const gallery = galleryOf('a', 'b', 'c');
		const [first, second, third] = gallery.images.map((image) => image.id);

		gallery.reorder([third!, first!, second!]);
		expect(savedUrls(gallery)).toEqual([
			'https://shop.example/c.jpg',
			'https://shop.example/a.jpg',
			'https://shop.example/b.jpg',
		]);
		expect(gallery.changed).toBe(true);

		gallery.reorder([first!, second!, third!]);
		expect(gallery.changed).toBe(false);
	});

	it('ignores an order that does not name every current image', () => {
		const gallery = galleryOf('a', 'b');

		gallery.reorder([gallery.images[1]!.id]);

		expect(savedUrls(gallery)).toEqual([
			'https://shop.example/a.jpg',
			'https://shop.example/b.jpg',
		]);
	});

	it('adds and selects images up to the limit, then refuses more', () => {
		const gallery = galleryOf('cover');

		for (let index = 1; index < MAX_GIFT_IMAGES; index += 1) {
			const image = linkedImage(`extra-${String(index)}`);
			expect(gallery.add(image)).toBe(true);
			expect(gallery.selected).toBe(image);
		}

		expect(gallery.atLimit).toBe(true);
		expect(gallery.add(linkedImage('one-too-many'))).toBe(false);
		expect(gallery.toGiftImages()).toHaveLength(MAX_GIFT_IMAGES);
	});

	it('moves the selection to the image taking the removed one’s place, else the previous one', () => {
		const gallery = galleryOf('a', 'b', 'c');
		const [first, second, third] = gallery.images.map((image) => image.id);

		gallery.select(second!);
		gallery.remove(second!);
		expect(gallery.selected?.id).toBe(third);

		gallery.remove(third!);
		expect(gallery.selected?.id).toBe(first);
		expect(gallery.changed).toBe(true);
	});

	it('neither saves nor counts an image still waiting for its link, and drops it on selecting another', () => {
		const gallery = galleryOf('a');
		const waiting = new GiftImageDraft();

		gallery.add(waiting);
		expect(gallery.images).toHaveLength(2);
		expect(gallery.selected).toBe(waiting);
		expect(gallery.changed).toBe(false);
		expect(savedUrls(gallery)).toEqual(['https://shop.example/a.jpg']);

		gallery.select(gallery.images[0]!.id);
		expect(gallery.images).toHaveLength(1);
	});

	it('starts the first image from a link or an upload when the gift has none', () => {
		const linked = new GiftImageGalleryDraft(null);
		linked.setSelectedImageUrl('https://shop.example/new.jpg');
		expect(savedUrls(linked)).toEqual(['https://shop.example/new.jpg']);

		const uploaded = new GiftImageGalleryDraft(null);
		uploaded.useUploadForSelected({
			objectKey: 'gift-images/new.png',
			publicUrl: 'https://cdn.example/gift-images/new.png',
			deleteToken: 'token',
		});
		expect(uploaded.toGiftImages()).toEqual([
			expect.objectContaining({ imageKey: 'gift-images/new.png' }),
		]);
		expect(uploaded.changed).toBe(true);
	});
});

// A wide 2:1 photo: the 4:3 Karta and the 1:1 Seznam frame it differently.
const PHOTO_RATIO = 2;
const aspectOf = (target: GiftEditorCropTarget) =>
	normalizedCropAspect(GIFT_CROP_TARGET_SPECS[target].aspect, PHOTO_RATIO);

const centered = { x: 50, y: 50 };

function ownCrop(rect: ImageCropRect) {
	return { cropRect: rect, ...cropRectToFocalZoom(rect) };
}

const legacyAutoMeta: ImageMetadata = { fitMode: IMAGE_FIT_MODES.auto, focal: centered, zoom: 1 };
const legacyBaseFocalMeta: ImageMetadata = {
	fitMode: IMAGE_FIT_MODES.coverCrop,
	cropRect: null,
	focal: { x: 20, y: 60 },
	zoom: 1.4,
	bgColor: null,
};
const cardCrop = focalZoomToWindowRect({ x: 30, y: 70 }, 5 / 6, aspectOf('square'));
const followingThumbMeta: ImageMetadata = {
	fitMode: IMAGE_FIT_MODES.coverCrop,
	cropRect: null,
	focal: centered,
	zoom: 1,
	bgColor: null,
	targets: { square: ownCrop(cardCrop) },
};
const listCrop = focalZoomToWindowRect({ x: 80, y: 20 }, 1.5, aspectOf('thumb'));
const manualBothMeta: ImageMetadata = {
	...followingThumbMeta,
	targets: { square: ownCrop(cardCrop), thumb: ownCrop(listCrop) },
};
const retiredTargetsMeta: ImageMetadata = {
	fitMode: IMAGE_FIT_MODES.coverCrop,
	cropRect: null,
	focal: centered,
	zoom: 1,
	bgColor: '#ffffff',
	targets: {
		card: { cropRect: { x: 0, y: 0.2, w: 1, h: 0.36 }, focal: { x: 50, y: 31.25 }, zoom: 1 },
		detail: { cropRect: { x: 0.2, y: 0, w: 0.5, h: 1 }, focal: { x: 40, y: 50 }, zoom: 1 },
	},
};

const STORED_FRAMINGS: [string, ImageMetadata][] = [
	['a legacy auto image', legacyAutoMeta],
	['a legacy base focal point and zoom without targets', legacyBaseFocalMeta],
	['a manual card with a following list thumbnail', followingThumbMeta],
	['manual card and list crops', manualBothMeta],
	['a Fit (contain-padded) image', containMeta],
	['retired card and detail crops', retiredTargetsMeta],
];

function measuredDraft(meta: ImageMetadata | null, name = 'photo'): GiftImageDraft {
	const image = new GiftImageDraft(storedImage(name, meta));
	image.measure(PHOTO_RATIO);
	return image;
}

/** A focal coordinate only means something on an axis the window crops. */
function expectFocalClose(
	window: ImageCropRect,
	actual: ImageFocalPoint,
	expected: ImageFocalPoint,
) {
	if (window.w < 1 - 1e-9) {
		expect(actual.x).toBeCloseTo(expected.x, 6);
	}
	if (window.h < 1 - 1e-9) {
		expect(actual.y).toBeCloseTo(expected.y, 6);
	}
}

function expectCenteredCover(image: GiftImageDraft, imageRatio: number) {
	for (const target of GIFT_EDITOR_CROP_TARGET_VALUES) {
		expectRectClose(
			image.targetRects[target],
			centeredCropRect(
				normalizedCropAspect(GIFT_CROP_TARGET_SPECS[target].aspect, imageRatio),
			),
		);
	}
}

describe('GiftImageDraft: independent Karta and Seznam views', () => {
	it.each(STORED_FRAMINGS)('opens %s on the framing each surface renders today', (_, meta) => {
		const image = measuredDraft(meta);

		for (const target of GIFT_EDITOR_CROP_TARGET_VALUES) {
			const window = image.targetRects[target];
			const rendered = giftTargetFrameProps(meta, target, PHOTO_RATIO);
			const resolvedFit =
				rendered.fitMode === IMAGE_FIT_MODES.auto
					? resolveAutoFit(PHOTO_RATIO, GIFT_CROP_TARGET_SPECS[target].aspect)
					: rendered.fitMode;
			if (resolvedFit === IMAGE_FIT_MODES.containPadded) {
				expectRectClose(window, containCropRect(aspectOf(target)));
			} else {
				const opened = cropRectToFocalZoom(window);
				expect(opened.zoom).toBeCloseTo(rendered.zoom, 6);
				expectFocalClose(window, opened.focal, rendered.focal);
			}
		}
		expect(image.changed).toBe(false);
	});

	it.each(STORED_FRAMINGS)(
		'saves %s untouched exactly as stored, before and after measuring',
		(_, meta) => {
			const image = new GiftImageDraft(storedImage('photo', meta));
			expect(image.toGiftImage().imageMeta).toEqual(meta);

			image.measure(PHOTO_RATIO);
			expect(image.toGiftImage().imageMeta).toEqual(meta);
			expect(image.changed).toBe(false);
		},
	);

	it('never moves Seznam when Karta is panned, zoomed or preset, and the reverse', () => {
		const image = measuredDraft(followingThumbMeta);
		const listBefore = { ...image.targetRects.thumb };

		image.editCrop('square', zoomCropRect(image.targetRects.square, aspectOf('square'), 1.8));
		image.applyPreset('square', GIFT_FRAMINGS.whole);
		expectRectClose(image.targetRects.thumb, listBefore);

		const cardBefore = { ...image.targetRects.square };
		image.editCrop('thumb', panCropRect(image.targetRects.thumb, 0.1, 0));
		image.applyPreset('thumb', GIFT_FRAMINGS.fill);
		expectRectClose(image.targetRects.square, cardBefore);
	});

	it.each([
		['square', 'thumb'],
		['thumb', 'square'],
	] as const)(
		'copies a Vlastní %s to %s once, keeping its focal point',
		(fromTarget, toTarget) => {
			const image = measuredDraft(null);
			const source = focalZoomToWindowRect({ x: 30, y: 70 }, 1.6, aspectOf(fromTarget));
			image.editCrop(fromTarget, source);

			image.copyFraming(fromTarget, toTarget);
			const copied = { ...image.targetRects[toTarget] };
			expect(image.framings[toTarget]).toBe(GIFT_FRAMINGS.custom);
			expectFocalClose(copied, cropRectToFocalZoom(copied).focal, { x: 30, y: 70 });

			image.editCrop(fromTarget, panCropRect(source, 0.1, 0));
			expectRectClose(image.targetRects[toTarget], copied);
		},
	);

	it.each([
		['square', 'thumb', GIFT_FRAMINGS.fill],
		['square', 'thumb', GIFT_FRAMINGS.whole],
		['thumb', 'square', GIFT_FRAMINGS.fill],
		['thumb', 'square', GIFT_FRAMINGS.whole],
	] as const)(
		'copies a %s preset to %s as the same preset (%s)',
		(fromTarget, toTarget, preset: GiftFramingPreset) => {
			const image = measuredDraft(null);
			const otherPreset =
				preset === GIFT_FRAMINGS.fill ? GIFT_FRAMINGS.whole : GIFT_FRAMINGS.fill;
			image.applyPreset(toTarget, otherPreset);
			image.applyPreset(fromTarget, preset);

			image.copyFraming(fromTarget, toTarget);

			expect(image.framings[toTarget]).toBe(preset);
		},
	);

	it('applies presets per view and reports Vyplnit, Celý or Vlastní for each', () => {
		const image = measuredDraft(null);
		expect(image.framings).toEqual({ square: GIFT_FRAMINGS.fill, thumb: GIFT_FRAMINGS.fill });

		image.applyPreset('thumb', GIFT_FRAMINGS.whole);
		expectRectClose(image.targetRects.thumb, containCropRect(aspectOf('thumb')));
		expect(image.framings).toEqual({ square: GIFT_FRAMINGS.fill, thumb: GIFT_FRAMINGS.whole });

		image.editCrop('square', panCropRect(image.targetRects.square, 0.1, 0));
		expect(image.framings).toEqual({
			square: GIFT_FRAMINGS.custom,
			thumb: GIFT_FRAMINGS.whole,
		});

		image.applyPreset('square', GIFT_FRAMINGS.fill);
		expectRectClose(image.targetRects.square, centeredCropRect(aspectOf('square')));
		expect(image.framings.square).toBe(GIFT_FRAMINGS.fill);
	});

	it('reads a stored framing’s status before the photo is measured', () => {
		expect(new GiftImageDraft(storedImage('fit', containMeta)).framings).toEqual({
			square: GIFT_FRAMINGS.whole,
			thumb: GIFT_FRAMINGS.whole,
		});
		expect(new GiftImageDraft(storedImage('manual', followingThumbMeta)).framings).toEqual({
			square: GIFT_FRAMINGS.custom,
			thumb: GIFT_FRAMINGS.custom,
		});
		expect(new GiftImageDraft(storedImage('legacy', legacyAutoMeta)).framings).toEqual({
			square: GIFT_FRAMINGS.fill,
			thumb: GIFT_FRAMINGS.fill,
		});
	});

	it('shows a legacy auto portrait whole on Karta and filled on Seznam once measured', () => {
		const image = new GiftImageDraft(storedImage('portrait', legacyAutoMeta));
		image.measure(0.6);

		expect(image.framings).toEqual({ square: GIFT_FRAMINGS.whole, thumb: GIFT_FRAMINGS.fill });
		expect(image.toGiftImage().imageMeta).toEqual(legacyAutoMeta);
	});

	it('ignores a late measurement of a source replaced since', () => {
		const image = new GiftImageDraft(storedImage('photo', followingThumbMeta));
		const previousSrc = image.previewSrc!;
		image.imageUrl = 'https://shop.example/other.jpg';

		image.measure(PHOTO_RATIO, previousSrc);
		expect(image.naturalRatio).toBeNull();

		image.measure(1.5, image.previewSrc!);
		expect(image.naturalRatio).toBe(1.5);
	});

	it('ignores framing edits until the photo is measured', () => {
		const image = new GiftImageDraft(storedImage('photo', followingThumbMeta));

		image.editCrop('square', { x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
		image.applyPreset('thumb', GIFT_FRAMINGS.whole);
		image.copyFraming('square', 'thumb');

		expect(image.changed).toBe(false);
		expect(image.toGiftImage().imageMeta).toEqual(followingThumbMeta);
	});

	it('is unchanged again once an edited view returns to its opening framing', () => {
		const image = measuredDraft(legacyBaseFocalMeta);
		const opening = { ...image.targetRects.square };

		image.editCrop('square', panCropRect(opening, 0.05, 0));
		expect(image.changed).toBe(true);
		image.editCrop('square', opening);

		expect(image.changed).toBe(false);
		expect(image.toGiftImage().imageMeta).toEqual(legacyBaseFocalMeta);
	});

	it('saves an untouched legacy transparent fill as the canonical default', () => {
		const legacyTransparentMeta: ImageMetadata = { ...manualBothMeta, bgColor: 'transparent' };
		const image = measuredDraft(legacyTransparentMeta);

		expect(image.bgColor).toBeNull();
		expect(image.toGiftImage().imageMeta).toEqual({ ...manualBothMeta, bgColor: null });
	});

	it('saves only the new background when the framing is untouched', () => {
		const image = measuredDraft(manualBothMeta);

		image.chooseBackground('#000000');

		expect(image.changed).toBe(true);
		expect(image.toGiftImage().imageMeta).toEqual({ ...manualBothMeta, bgColor: '#000000' });
	});
});

describe('GiftImageDraft: persisting the two views', () => {
	it('saves both views on Vyplnit as a centered cover without targets', () => {
		const image = measuredDraft(manualBothMeta);
		image.applyPreset('square', GIFT_FRAMINGS.fill);
		image.applyPreset('thumb', GIFT_FRAMINGS.fill);

		expect(image.toGiftImage().imageMeta).toEqual({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: null,
			focal: centered,
			zoom: 1,
			bgColor: null,
		});
	});

	it('saves both views on Celý as Fit (contain-padded) without targets', () => {
		const image = measuredDraft(legacyBaseFocalMeta);
		image.applyPreset('square', GIFT_FRAMINGS.whole);
		image.applyPreset('thumb', GIFT_FRAMINGS.whole);

		expect(image.toGiftImage().imageMeta).toEqual({
			fitMode: IMAGE_FIT_MODES.containPadded,
			cropRect: null,
			focal: centered,
			zoom: 1,
			bgColor: null,
		});
	});

	it('pins both views from their windows when they differ, keeping the stored base', () => {
		const image = measuredDraft(legacyBaseFocalMeta);
		image.applyPreset('square', GIFT_FRAMINGS.whole);
		const list = panCropRect(centeredCropRect(aspectOf('thumb')), 0.2, 0);
		image.editCrop('thumb', list);

		const saved = image.toGiftImage().imageMeta!;
		expect(saved).toMatchObject({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: null,
			focal: legacyBaseFocalMeta.focal,
			zoom: legacyBaseFocalMeta.zoom,
		});
		expect(Object.keys(saved.targets ?? {}).sort()).toEqual(['square', 'thumb']);
		expectRectClose(
			renderedGiftTargetRect(saved, 'square', PHOTO_RATIO),
			containCropRect(aspectOf('square')),
		);
		expectRectClose(renderedGiftTargetRect(saved, 'thumb', PHOTO_RATIO), list);
	});

	it('pins a following list thumbnail to exactly the framing it rendered when only Karta changes', () => {
		const image = measuredDraft(followingThumbMeta);
		const listBefore = renderedGiftTargetRect(followingThumbMeta, 'thumb', PHOTO_RATIO);
		const listPropsBefore = giftTargetFrameProps(followingThumbMeta, 'thumb', PHOTO_RATIO);

		image.editCrop('square', zoomCropRect(image.targetRects.square, aspectOf('square'), 2));

		const saved = image.toGiftImage().imageMeta!;
		expect(saved.targets?.thumb).toBeDefined();
		expectRectClose(renderedGiftTargetRect(saved, 'thumb', PHOTO_RATIO), listBefore);
		const listPropsAfter = giftTargetFrameProps(saved, 'thumb', PHOTO_RATIO);
		expect(listPropsAfter.zoom).toBeCloseTo(listPropsBefore.zoom, 10);
		expect(listPropsAfter.focal.x).toBeCloseTo(listPropsBefore.focal.x, 6);
		expect(listPropsAfter.focal.y).toBeCloseTo(listPropsBefore.focal.y, 6);
		expect(cropRectToFocalZoom(saved.targets!.square!.cropRect).zoom).toBeCloseTo(2, 10);
	});

	it('drops a retired card crop once Karta is pinned but keeps a retired detail crop', () => {
		const image = measuredDraft(retiredTargetsMeta);
		image.editCrop('thumb', panCropRect(image.targetRects.thumb, 0.1, 0));

		const targets = image.toGiftImage().imageMeta?.targets;
		expect(Object.keys(targets ?? {}).sort()).toEqual(['detail', 'square', 'thumb']);
		expect(targets?.detail).toEqual(retiredTargetsMeta.targets?.detail);
	});

	it.each([
		[
			'an upload',
			(image: GiftImageDraft) =>
				image.useUpload({
					objectKey: 'gift-images/new.png',
					publicUrl: 'https://cdn.example/gift-images/new.png',
					deleteToken: 'token',
				}),
		],
		[
			'a new link',
			(image: GiftImageDraft) => {
				image.imageUrl = 'https://shop.example/other.jpg';
			},
		],
	])('discards a Karta edit once the source is replaced by %s', (_, replaceSource) => {
		const image = measuredDraft(followingThumbMeta);
		image.editCrop('square', panCropRect(image.targetRects.square, 0.1, 0));

		replaceSource(image);
		image.measure(1.5);

		expectCenteredCover(image, 1.5);
		const saved = image.toGiftImage().imageMeta!;
		expect(saved).toEqual({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: null,
			focal: centered,
			zoom: 1,
			bgColor: null,
		});
	});

	it('starts a replaced image from a centered cover on both views', () => {
		const image = measuredDraft(manualBothMeta);
		image.useUpload({
			objectKey: 'gift-images/new.png',
			publicUrl: 'https://cdn.example/gift-images/new.png',
			deleteToken: 'token',
		});

		expect(image.changed).toBe(true);
		expect(image.framings).toEqual({ square: GIFT_FRAMINGS.fill, thumb: GIFT_FRAMINGS.fill });
		expect(image.toGiftImage().imageMeta).toEqual({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: null,
			focal: centered,
			zoom: 1,
			bgColor: null,
		});

		image.measure(1.5);
		expectRectClose(
			image.targetRects.square,
			centeredCropRect(normalizedCropAspect(GIFT_CROP_TARGET_SPECS.square.aspect, 1.5)),
		);
	});
});
