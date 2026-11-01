import { describe, expect, it, vi } from 'vitest';
import { MAX_GIFT_IMAGES, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import {
	IMAGE_EDITOR_MODES,
	IMAGE_FIT_MODES,
	type ImageMetadata,
} from '$lib/modules/images/index.js';
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

describe('GiftImageDraft', () => {
	it('keeps a legacy auto fitMode until the display mode changes', () => {
		const legacy = new GiftImageDraft(
			storedImage('legacy', { ...containMeta, fitMode: 'auto' }),
		);
		expect(legacy.imageMeta.fitMode).toBe(IMAGE_FIT_MODES.auto);
		expect(legacy.changed).toBe(false);

		legacy.chooseEditorMode(IMAGE_EDITOR_MODES.fit, 'square');
		expect(legacy.imageMeta.fitMode).toBe(IMAGE_FIT_MODES.containPadded);
		expect(legacy.changed).toBe(true);
	});

	it('promotes a crop edit to Manual with only the edited target owning a crop', () => {
		const image = new GiftImageDraft(storedImage('photo'));

		image.editCrop('square', { x: 0.1, y: 0.1, w: 0.5, h: 0.5 });

		expect(image.editorMode).toBe(IMAGE_EDITOR_MODES.manual);
		expect(Object.keys(image.imageMeta.targets ?? {})).toEqual(['square']);
	});
});

describe('GiftImageDraft Fit margin', () => {
	it('saves an untouched image without a margin exactly as persisted', () => {
		const image = new GiftImageDraft(storedImage('photo'));

		expect(image.changed).toBe(false);
		expect(image.imageMeta).not.toHaveProperty('margin');
	});

	it('keeps a persisted Fit margin untouched and unchanged', () => {
		const image = new GiftImageDraft(storedImage('box', { ...containMeta, margin: 0.05 }));

		expect(image.margin).toBe(0.05);
		expect(image.changed).toBe(false);
		expect(image.imageMeta.margin).toBe(0.05);
	});

	it('saves a chosen margin with Fit and counts it as a change', () => {
		const image = new GiftImageDraft(storedImage('box'));

		image.chooseMargin(0.1);

		expect(image.changed).toBe(true);
		expect(image.imageMeta).toMatchObject({
			fitMode: IMAGE_FIT_MODES.containPadded,
			margin: 0.1,
		});

		image.chooseMargin(0);
		expect(image.changed).toBe(false);
		expect(image.imageMeta).not.toHaveProperty('margin');
	});

	it('drops the margin on save outside Fit and restores it when Fit returns', () => {
		const image = new GiftImageDraft(storedImage('box', { ...containMeta, margin: 0.05 }));

		image.chooseEditorMode(IMAGE_EDITOR_MODES.fill, 'square');
		expect(image.imageMeta).not.toHaveProperty('margin');

		image.chooseEditorMode(IMAGE_EDITOR_MODES.fit, 'square');
		expect(image.imageMeta.margin).toBe(0.05);
		expect(image.changed).toBe(false);
	});

	it('turns a legacy auto image into Fit when a margin is chosen', () => {
		const legacy = new GiftImageDraft(
			storedImage('legacy', { ...containMeta, fitMode: 'auto' }),
		);

		legacy.chooseMargin(0.05);

		expect(legacy.imageMeta).toMatchObject({
			fitMode: IMAGE_FIT_MODES.containPadded,
			margin: 0.05,
		});
	});

	it('keeps each gallery image’s own margin', () => {
		const images = [
			storedImage('first', { ...containMeta, margin: 0.1 }),
			storedImage('second'),
		];
		const gallery = new GiftImageGalleryDraft({
			imageUrl: images[0].imageUrl,
			imageKey: null,
			imageMeta: images[0].imageMeta,
			images,
		});

		gallery.images[1].chooseMargin(0.05);

		expect(gallery.toGiftImages().map((image) => image.imageMeta?.margin)).toEqual([0.1, 0.05]);
	});

	it('keeps a margin the editor does not offer when the rest of the image is edited', () => {
		const image = new GiftImageDraft(storedImage('agent', { ...containMeta, margin: 0.07 }));

		expect(image.changed).toBe(false);
		image.chooseBackground('#ffffff');

		expect(image.changed).toBe(true);
		expect(image.imageMeta).toMatchObject({ bgColor: '#ffffff', margin: 0.07 });
	});

	it('does not carry the margin over to an uploaded replacement', () => {
		const image = new GiftImageDraft(storedImage('box', { ...containMeta, margin: 0.1 }));

		image.useUpload({
			objectKey: 'gift-images/new.png',
			publicUrl: 'https://cdn.example/gift-images/new.png',
			deleteToken: 'token',
		});
		image.chooseEditorMode(IMAGE_EDITOR_MODES.fit, 'square');

		expect(image.imageMeta.fitMode).toBe(IMAGE_FIT_MODES.containPadded);
		expect(image.imageMeta).not.toHaveProperty('margin');
	});
});
