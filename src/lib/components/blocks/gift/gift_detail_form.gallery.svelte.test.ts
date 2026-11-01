import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { GiftByRole, UpdateGiftInput } from '$lib/modules/gifts/types.js';
import { MAX_GIFT_IMAGES, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';
import {
	gapsWithin,
	paintedPhotoBox,
	type PhotoBox,
} from '$lib/components/derived/image-frame/painted_photo_box.test_fixtures.js';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_R2_URL: '/' } }));

const { default: GiftDetailForm } = await import('./GiftDetailForm.svelte');

function svgUrl(width: number): string {
	return (
		'data:image/svg+xml,' +
		encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="300"/>`,
		)
	);
}

function imageMeta(bgColor: string | null): ImageMetadata {
	return {
		fitMode: IMAGE_FIT_MODES.containPadded,
		cropRect: null,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor,
	};
}

function galleryImage(width: number, bgColor: string | null = null): GiftImage {
	return { imageUrl: svgUrl(width), imageKey: null, imageMeta: imageMeta(bgColor) };
}

const giftName = 'Herní konzole';

function makeGift(images: GiftImage[]): GiftByRole {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: giftName,
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: 100,
		priceMax: null,
		currency: 'CZK',
		imageUrl: images[0]?.imageUrl ?? '',
		imageKey: '',
		imageMeta: images[0]?.imageMeta ?? null,
		images,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		categoryIds: [],
		categories: [],
	};
}

const threeImages = [galleryImage(400), galleryImage(300, '#000000'), galleryImage(200)];

async function renderGallery(images: GiftImage[] = threeImages) {
	const onupdate = vi.fn<(input: UpdateGiftInput) => void>();
	const ondirtychange = vi.fn<(dirty: boolean) => void>();
	const screen = await render(GiftDetailForm, {
		mode: 'edit',
		gift: makeGift(images),
		wishlistId: 'wishlist-1',
		priorityLevels: [],
		role: 'recipient',
		postShareLocked: false,
		canDelete: false,
		isSubmitting: false,
		isDeleting: false,
		onupdate,
		ondirtychange,
	});
	return { screen, onupdate, ondirtychange };
}

function tileButton(screen: Awaited<ReturnType<typeof renderGallery>>['screen'], label: string) {
	return screen.getByRole('button', { name: label, exact: true });
}

function savedImageUrls(onupdate: ReturnType<typeof vi.fn<(input: UpdateGiftInput) => void>>) {
	return onupdate.mock.calls[0]![0].images?.map((image) => image.imageUrl);
}

describe('GiftDetailForm image gallery (#591)', () => {
	it('lists the images in order with the first marked as the cover and selected', async () => {
		const { screen } = await renderGallery();

		const strip = screen.getByTestId('gift-image-strip');
		await expect
			.element(
				strip.getByText(m.gift_image_strip_heading({ count: 3, max: MAX_GIFT_IMAGES })),
			)
			.toBeVisible();
		await expect
			.element(tileButton(screen, m.gift_image_strip_select_cover({ position: 1 })))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(tileButton(screen, m.gift_image_strip_select({ position: 2 })))
			.toHaveAttribute('aria-pressed', 'false');
		expect(strip.getByText(m.gift_image_strip_cover(), { exact: true }).all()).toHaveLength(1);
	});

	it('binds the stage, background and save to the selected image only', async () => {
		const { screen, onupdate, ondirtychange } = await renderGallery();

		await tileButton(screen, m.gift_image_strip_select({ position: 2 })).click();

		await expect.element(screen.getByTestId('crop-stage-editing')).toHaveTextContent(
			m.gift_image_crop_editing_gallery({
				target: m.gift_image_target_card(),
				position: 2,
				count: 3,
			}),
		);
		await expect
			.element(screen.getByRole('radio', { name: m.image_background_black() }))
			.toHaveAttribute('aria-checked', 'true');
		expect(ondirtychange).toHaveBeenLastCalledWith(false);

		await screen.getByRole('radio', { name: m.image_background_white() }).click();
		expect(ondirtychange).toHaveBeenLastCalledWith(true);
		await screen.getByRole('button', { name: m.save() }).first().click();

		const savedImages = onupdate.mock.calls[0]![0].images!;
		expect(savedImages.map((image) => image.imageMeta?.bgColor)).toEqual([
			null,
			'#ffffff',
			null,
		]);
		expect(onupdate.mock.calls[0]![0]).not.toHaveProperty('imageUrl');
	});

	it('offers the margin for Fit only and saves it for the selected image', async () => {
		const { screen, onupdate, ondirtychange } = await renderGallery();

		const marginGroup = screen.getByRole('group', { name: m.image_margin_label() });
		await expect.element(marginGroup).toBeVisible();
		await expect
			.element(screen.getByRole('radio', { name: m.image_margin_none() }))
			.toHaveAttribute('aria-checked', 'true');
		expect(ondirtychange).toHaveBeenLastCalledWith(false);

		await tileButton(screen, m.gift_image_strip_select({ position: 2 })).click();
		await screen.getByRole('radio', { name: m.image_margin_small() }).click();
		expect(ondirtychange).toHaveBeenLastCalledWith(true);

		await screen.getByRole('radio', { name: m.image_fit_fill() }).click();
		await expect.element(marginGroup).not.toBeInTheDocument();
		await screen.getByRole('radio', { name: m.image_fit_fit() }).click();
		await expect
			.element(screen.getByRole('radio', { name: m.image_margin_small() }))
			.toHaveAttribute('aria-checked', 'true');

		await screen.getByRole('button', { name: m.save() }).first().click();
		const savedImages = onupdate.mock.calls[0]![0].images!;
		expect(savedImages.map((image) => image.imageMeta?.margin)).toEqual([
			undefined,
			0.05,
			undefined,
		]);
	});

	it('selects no margin choice for a margin the editor does not offer and saves it untouched', async () => {
		const { screen, onupdate } = await renderGallery([
			{ ...galleryImage(400), imageMeta: { ...imageMeta(null), margin: 0.07 } },
		]);

		const marginGroup = screen.getByRole('group', { name: m.image_margin_label() });
		await expect.element(marginGroup).toBeVisible();
		const marginRadios = marginGroup.getByRole('radio').all();
		expect(marginRadios).toHaveLength(3);
		for (const radio of marginRadios) {
			await expect.element(radio).toHaveAttribute('aria-checked', 'false');
		}

		await screen.getByRole('radio', { name: m.image_background_white() }).click();
		await screen.getByRole('button', { name: m.save() }).first().click();
		expect(onupdate.mock.calls[0]![0].images![0]!.imageMeta).toMatchObject({
			bgColor: '#ffffff',
			margin: 0.07,
		});
	});

	describe('Fit margin around a photo whose aspect differs from the 4:3 card', () => {
		/** Gaps between a frame and the photo inside it, minus the 10% margin of the frame's shorter side. */
		function gapsBeyondMargin(frame: Element, photo: PhotoBox) {
			const frameBox = frame.getBoundingClientRect();
			const margin = 0.1 * Math.min(frameBox.width, frameBox.height);
			const gaps = gapsWithin(frameBox, photo);
			return {
				left: gaps.left - margin,
				top: gaps.top - margin,
				right: gaps.right - margin,
				bottom: gaps.bottom - margin,
			};
		}

		it.each([
			{ shape: 'square', photoWidth: 300, tightSides: ['top', 'bottom'] as const },
			{ shape: '2:1', photoWidth: 600, tightSides: ['left', 'right'] as const },
		])(
			'contains a $shape photo unstretched inside the margin in the stage and the preview',
			async ({ photoWidth, tightSides }) => {
				const { screen } = await renderGallery([
					{ ...galleryImage(photoWidth), imageMeta: { ...imageMeta(null), margin: 0.1 } },
				]);
				const naturalAspect = photoWidth / 300;

				const stage = screen.getByTestId('crop-stage');
				const stageWindow = stage.getByTestId('crop-stage-window');
				const stagePhoto = stage.getByRole('img', { name: giftName });
				await expect.element(stageWindow).toBeVisible();
				await expect
					.poll(() => {
						const photoBox = stagePhoto.element().getBoundingClientRect();
						return photoBox.width / photoBox.height;
					})
					.toBeCloseTo(naturalAspect, 2);
				const stageGaps = gapsBeyondMargin(
					stageWindow.element(),
					stagePhoto.element().getBoundingClientRect(),
				);
				for (const side of tightSides) {
					expect(stageGaps[side]).toBeCloseTo(0, 0);
				}
				expect(Math.min(...Object.values(stageGaps))).toBeGreaterThan(-0.5);
				expect(stageGaps.left).toBeCloseTo(stageGaps.right, 0);
				expect(stageGaps.top).toBeCloseTo(stageGaps.bottom, 0);

				const previewFrame = screen
					.getByTestId('gift-preview-square')
					.getByTestId('image-frame');
				const previewImage = previewFrame.getByRole('img').element() as HTMLImageElement;
				await expect.poll(() => previewImage.naturalWidth).toBeGreaterThan(0);
				const previewGaps = gapsBeyondMargin(
					previewFrame.element(),
					paintedPhotoBox(previewImage),
				);
				expect(Math.min(...Object.values(previewGaps))).toBeGreaterThan(-0.5);
				expect(previewGaps.left).toBeCloseTo(previewGaps.right, 0);
				expect(previewGaps.top).toBeCloseTo(previewGaps.bottom, 0);
			},
		);
	});

	it('reorders with the arrow keys, announces the new cover and saves the new order', async () => {
		const { screen, onupdate, ondirtychange } = await renderGallery();

		const lastGrip = screen.getByRole('button', {
			name: m.gift_image_strip_move_label({ position: 3 }),
		});
		(lastGrip.element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowLeft}');
		await expect
			.element(screen.getByText(m.gift_image_strip_moved({ position: 2, count: 3 })))
			.toBeInTheDocument();
		await expect
			.element(
				screen.getByRole('button', {
					name: m.gift_image_strip_move_label({ position: 2 }),
				}),
			)
			.toHaveFocus();
		await userEvent.keyboard('{ArrowLeft}');
		await expect
			.element(screen.getByText(m.gift_image_strip_moved_cover({ count: 3 })))
			.toBeInTheDocument();
		expect(ondirtychange).toHaveBeenLastCalledWith(true);

		await screen.getByRole('button', { name: m.save() }).first().click();
		expect(savedImageUrls(onupdate)).toEqual([svgUrl(200), svgUrl(400), svgUrl(300)]);
	});

	it('is clean again once the original order is restored', async () => {
		const { screen, ondirtychange } = await renderGallery();

		const firstGrip = screen.getByRole('button', {
			name: m.gift_image_strip_move_label({ position: 1 }),
		});
		(firstGrip.element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');
		await vi.waitFor(() => expect(ondirtychange).toHaveBeenLastCalledWith(true));
		await userEvent.keyboard('{ArrowLeft}');
		await vi.waitFor(() => expect(ondirtychange).toHaveBeenLastCalledWith(false));
	});

	it('removes an image from the saved gallery', async () => {
		const { screen, onupdate } = await renderGallery();

		await screen
			.getByRole('button', { name: m.gift_image_strip_remove_label({ position: 2 }) })
			.click();
		await screen.getByRole('button', { name: m.save() }).first().click();

		expect(savedImageUrls(onupdate)).toEqual([svgUrl(400), svgUrl(200)]);
	});

	it('adds an image from a link and saves it last', async () => {
		const { screen, onupdate } = await renderGallery();

		await screen.getByTestId('gift-image-strip-add').click();
		await screen.getByRole('menuitem', { name: m.gift_image_strip_add_url() }).click();
		const linkInput = screen.getByPlaceholder('https://example.com/image.jpg');
		await expect.element(linkInput).toHaveFocus();
		await expect
			.element(tileButton(screen, m.gift_image_strip_select_pending({ position: 4 })))
			.toHaveAttribute('aria-pressed', 'true');

		await linkInput.fill(svgUrl(100));
		await expect
			.element(tileButton(screen, m.gift_image_strip_select({ position: 4 })))
			.toBeVisible();
		await screen.getByRole('button', { name: m.save() }).first().click();

		expect(savedImageUrls(onupdate)).toEqual([
			...threeImages.map((image) => image.imageUrl),
			svgUrl(100),
		]);
	});

	it('disables adding at the limit and says why', async () => {
		const eightImages = Array.from({ length: MAX_GIFT_IMAGES }, (_, index) =>
			galleryImage(100 + index * 10),
		);
		const { screen } = await renderGallery(eightImages);

		const addButton = screen.getByTestId('gift-image-strip-add');
		const limitNote = screen.getByText(m.gift_image_strip_limit({ max: MAX_GIFT_IMAGES }));
		await expect.element(limitNote).toBeVisible();
		await expect.element(addButton).toHaveAttribute('aria-disabled', 'true');
		await expect.element(addButton).toHaveAttribute('aria-describedby', limitNote.element().id);

		(addButton.element() as HTMLElement).focus();
		await expect.element(addButton).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		await addButton.click({ force: true });
		expect(screen.getByRole('menuitem').all()).toHaveLength(0);
	});

	it('keeps the strip controls focusable but inert while the gift saves', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			mode: 'edit',
			gift: makeGift(threeImages),
			wishlistId: 'wishlist-1',
			priorityLevels: [],
			role: 'recipient',
			postShareLocked: false,
			canDelete: false,
			isSubmitting: true,
			isDeleting: false,
			onupdate,
		});

		const secondTile = tileButton(screen, m.gift_image_strip_select({ position: 2 }));
		const lastGrip = screen.getByRole('button', {
			name: m.gift_image_strip_move_label({ position: 3 }),
		});
		const secondRemove = screen.getByRole('button', {
			name: m.gift_image_strip_remove_label({ position: 2 }),
		});
		for (const control of [secondTile, lastGrip, secondRemove]) {
			await expect.element(control).toHaveAttribute('aria-disabled', 'true');
			await expect.element(control).not.toHaveAttribute('disabled');
		}
		await expect.element(lastGrip).toHaveAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight');

		await secondTile.click({ force: true });
		await expect.element(secondTile).toHaveAttribute('aria-pressed', 'false');
		(lastGrip.element() as HTMLElement).focus();
		await expect.element(lastGrip).toHaveFocus();
		await userEvent.keyboard('{ArrowLeft}');
		await expect.element(lastGrip).toHaveFocus();
		(secondRemove.element() as HTMLElement).focus();
		await userEvent.keyboard('{Enter}');
		await expect
			.element(
				screen
					.getByTestId('gift-image-strip')
					.getByText(m.gift_image_strip_heading({ count: 3, max: MAX_GIFT_IMAGES })),
			)
			.toBeVisible();
		expect(onupdate).not.toHaveBeenCalled();
	});
});
