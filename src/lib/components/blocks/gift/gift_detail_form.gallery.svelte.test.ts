import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { GiftByRole, UpdateGiftInput } from '$lib/modules/gifts/types.js';
import { MAX_GIFT_IMAGES, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';

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

function makeGift(images: GiftImage[]): GiftByRole {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Herní konzole',
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
		const addLinkItem = screen.getByRole('menuitem', { name: m.gift_image_strip_add_url() });
		await addLinkItem.click();
		// Typing after the menu unmounts is the path that once froze the new image's state.
		await expect.element(addLinkItem).not.toBeInTheDocument();
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

describe('GiftDetailForm crop zoom-out', () => {
	// A square photo on the 4:3 card: Fit shows it whole at 75 %, and Manual may
	// zoom on out until 15 % of the window stays clear on each side vertically,
	// so the photo fills 70 % of the window height: 0.75 × 0.7 = 0.525.
	const cardContainZoom = 0.75;
	const cardZoomOutFloor = 0.525;

	function zoomSlider(screen: Awaited<ReturnType<typeof renderGallery>>['screen']) {
		return screen.getByRole('slider', { name: m.image_crop_zoom_label() });
	}

	it('switches Fill to Manual on zoom-out and continues past the whole-photo zoom', async () => {
		const fillMeta: ImageMetadata = { ...imageMeta(null), fitMode: IMAGE_FIT_MODES.coverCrop };
		const { screen, onupdate } = await renderGallery([
			{ imageUrl: svgUrl(300), imageKey: null, imageMeta: fillMeta },
		]);
		await expect.element(screen.getByTestId('crop-stage-window')).toBeVisible();
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_fill() }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(screen.getByRole('button', { name: m.image_crop_zoom_out() }))
			.toBeEnabled();

		(screen.getByTestId('crop-stage').element() as HTMLElement).focus();
		for (let press = 0; press < 4; press += 1) {
			await userEvent.keyboard('-');
		}
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_manual() }))
			.toHaveAttribute('aria-checked', 'true');
		await screen.getByRole('button', { name: m.save() }).first().click();

		const savedMeta = onupdate.mock.calls[0]![0].images![0]!.imageMeta!;
		expect(savedMeta.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(savedMeta.targets!.square!.zoom).toBeLessThan(cardContainZoom);
		expect(savedMeta.targets!.square!.zoom).toBeGreaterThanOrEqual(cardZoomOutFloor - 1e-6);
	});

	it('lets the zoom slider reach the zoom-out floor itself', async () => {
		const { screen, onupdate } = await renderGallery([galleryImage(300)]);
		const slider = zoomSlider(screen);
		await expect.element(slider).toBeEnabled();

		(slider.element() as HTMLElement).focus();
		await userEvent.keyboard('{Home}');
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_manual() }))
			.toHaveAttribute('aria-checked', 'true');
		await expect.element(screen.getByTestId('crop-stage-zoom')).toHaveTextContent('53 %');
		await expect
			.element(screen.getByRole('button', { name: m.image_crop_zoom_out() }))
			.toBeDisabled();
		await screen.getByRole('button', { name: m.save() }).first().click();

		const cardCrop = onupdate.mock.calls[0]![0].images![0]!.imageMeta!.targets!.square!;
		expect(cardCrop.zoom).toBeCloseTo(cardZoomOutFloor, 6);
	});

	it('switches Fit to Manual on zoom-out and stops with a margin around the whole photo', async () => {
		const { screen, onupdate } = await renderGallery([galleryImage(300)]);
		const zoomOut = screen.getByRole('button', { name: m.image_crop_zoom_out() });
		await expect.element(screen.getByTestId('crop-stage-window')).toBeVisible();
		await expect.element(zoomOut).toBeEnabled();

		await zoomOut.click();
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_manual() }))
			.toHaveAttribute('aria-checked', 'true');
		(screen.getByTestId('crop-stage').element() as HTMLElement).focus();
		for (let press = 0; press < 10; press += 1) {
			await userEvent.keyboard('-');
		}
		await expect.element(zoomOut).toBeDisabled();

		// The thumbnail follows that card crop, deeper than its own 1:1 floor.
		await screen.getByTestId('gift-preview-tile-thumb').click();
		await expect
			.element(screen.getByTestId('crop-stage-editing'))
			.toHaveTextContent(m.image_crop_editing({ target: m.gift_image_target_thumb() }));
		// The slider shows that inherited zoom instead of clamping to the 1:1 floor (70 %).
		await expect.element(screen.getByTestId('crop-stage-zoom')).toHaveTextContent('53 %');
		await expect.element(zoomSlider(screen)).toHaveValue('53');
		await screen.getByRole('button', { name: m.save() }).first().click();

		const savedMeta = onupdate.mock.calls[0]![0].images![0]!.imageMeta!;
		expect(savedMeta.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
		const cardCrop = savedMeta.targets!.square!;
		expect(cardCrop.zoom).toBeCloseTo(cardZoomOutFloor, 6);
		expect(cardCrop.cropRect.w).toBeGreaterThan(1);
		// The photo spans 70 % of the window height, so the window is 1 / 0.7 photos tall.
		expect(cardCrop.cropRect.h).toBeCloseTo(1 / 0.7, 6);
		expect(savedMeta.targets!.thumb).toBeUndefined();
	});
});
