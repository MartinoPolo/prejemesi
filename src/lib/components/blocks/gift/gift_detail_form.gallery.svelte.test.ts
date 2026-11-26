import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { GiftByRole, UpdateGiftInput } from '$lib/modules/gifts/types.js';
import { MAX_GIFT_IMAGES, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_R2_URL: '/' } }));

const { default: GiftDetailForm } = await import('./GiftDetailFormTestFixture.svelte');

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
		linkedCopies: [],
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

	it('selects a thumbnail without opening the framing step, and the preview keeps the one entry', async () => {
		const { screen } = await renderGallery();
		const strip = screen.getByTestId('gift-image-strip');

		await tileButton(screen, m.gift_image_strip_select({ position: 2 })).click();

		await expect
			.element(tileButton(screen, m.gift_image_strip_select({ position: 2 })))
			.toHaveAttribute('aria-pressed', 'true');
		await expect.element(screen.getByTestId('gift-image-framing-step')).not.toBeInTheDocument();
		expect(strip.getByRole('button', { name: m.gift_image_edit() }).all()).toHaveLength(0);
		expect(strip.getByTestId('gift-image-edit-entry').all()).toHaveLength(0);
		expect(screen.getByTestId('gift-image-edit-entry').all()).toHaveLength(1);
	});

	it('binds the framing step, background and save to the selected image only', async () => {
		const { screen, onupdate, ondirtychange } = await renderGallery();

		await tileButton(screen, m.gift_image_strip_select({ position: 2 })).click();
		await screen.getByTestId('gift-image-edit-entry').click();

		await expect
			.element(screen.getByRole('heading', { name: /Úprava obrázku 2/ }))
			.toHaveTextContent(m.gift_image_framing_title_count({ count: 3 }));
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

	it('keeps framing edits when going back and returns focus to the image entry', async () => {
		const { screen, ondirtychange } = await renderGallery();

		await screen.getByTestId('gift-image-edit-entry').click();
		await screen.getByRole('radio', { name: m.image_background_white() }).click();
		await screen.getByRole('button', { name: m.gift_context_back() }).click();

		await expect.element(screen.getByTestId('gift-image-framing-step')).not.toBeInTheDocument();
		await expect.element(screen.getByTestId('gift-image-edit-entry')).toHaveFocus();
		expect(ondirtychange).toHaveBeenLastCalledWith(true);
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

	it('undoes a removal in the strip, restoring the image at its position, selected and focused', async () => {
		const { screen, onupdate, ondirtychange } = await renderGallery();
		const strip = screen.getByTestId('gift-image-strip');
		const undo = strip.getByRole('button', { name: m.gift_image_strip_undo_remove_label() });
		await expect.element(undo).not.toBeInTheDocument();

		await screen
			.getByRole('button', { name: m.gift_image_strip_remove_label({ position: 2 }) })
			.click();
		const liveRegion = strip.element().querySelector('[aria-live="polite"]');
		await expect.poll(() => liveRegion?.textContent).toBe(m.gift_image_strip_removed());
		await expect
			.element(strip.getByTestId('gift-image-strip-removal-undo'))
			.toHaveTextContent(m.gift_image_strip_removed());
		await expect.element(undo).toHaveTextContent(m.gift_image_strip_undo_remove());
		await expect.element(undo).toBeVisible();

		await undo.click();

		const restoredTile = tileButton(screen, m.gift_image_strip_select({ position: 2 }));
		await expect.element(restoredTile).toHaveAttribute('aria-pressed', 'true');
		await expect.element(restoredTile).toHaveFocus();
		await expect
			.element(strip.getByText(m.gift_image_strip_restored({ position: 2, count: 3 })))
			.toBeInTheDocument();
		await expect.element(undo).not.toBeInTheDocument();
		// The restored image keeps its own background.
		await screen.getByTestId('gift-image-edit-entry').click();
		await expect
			.element(screen.getByRole('radio', { name: m.image_background_black() }))
			.toHaveAttribute('aria-checked', 'true');
		expect(ondirtychange).toHaveBeenLastCalledWith(false);

		await screen.getByRole('button', { name: m.save() }).first().click();
		expect(savedImageUrls(onupdate)).toEqual(threeImages.map((image) => image.imageUrl));
	});

	it('shows the removal undo in the framing step on phones and forgets it once the order changes', async () => {
		const defaultViewport = { width: window.innerWidth, height: window.innerHeight };
		onTestFinished(() => page.viewport(defaultViewport.width, defaultViewport.height));
		await page.viewport(390, 844);
		const { screen } = await renderGallery();
		await screen.getByTestId('gift-image-edit-entry').click();
		await expect.element(screen.getByTestId('gift-image-framing-step')).toBeInTheDocument();

		await screen
			.getByRole('button', { name: m.gift_image_strip_remove_label({ position: 3 }) })
			.click();
		const notice = screen.getByTestId('gift-image-strip-removal-undo');
		const undo = notice.getByRole('button', { name: m.gift_image_strip_undo_remove_label() });
		await expect.element(undo).toBeVisible();
		// The phone framing step hides the strip heading from sight, so the undo must not inherit that.
		const undoBox = (undo.element() as HTMLElement).getBoundingClientRect();
		const pressedElement = document.elementFromPoint(
			undoBox.left + undoBox.width / 2,
			undoBox.top + undoBox.height / 2,
		);
		expect(undo.element().contains(pressedElement)).toBe(true);

		const secondGrip = screen.getByRole('button', {
			name: m.gift_image_strip_move_label({ position: 2 }),
		});
		(secondGrip.element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowLeft}');

		await expect.element(notice).not.toBeInTheDocument();
	});

	it('adds an image from a link and saves it last', async () => {
		const { screen, onupdate } = await renderGallery();

		await screen.getByTestId('gift-image-strip-add').click();
		const addLinkItem = screen.getByRole('menuitem', { name: m.gift_image_strip_add_url() });
		await addLinkItem.click();
		// Typing after the menu unmounts is the path that once froze the new image's state.
		await expect.element(addLinkItem).not.toBeInTheDocument();
		const linkInput = screen.getByRole('textbox', {
			name: m.gift_image_url_label(),
			exact: false,
		});
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

	it('drops the add tile at the limit and says why in the strip caption', async () => {
		const eightImages = Array.from({ length: MAX_GIFT_IMAGES }, (_, index) =>
			galleryImage(100 + index * 10),
		);
		const { screen } = await renderGallery(eightImages);
		const strip = screen.getByTestId('gift-image-strip');

		await expect.element(strip.getByText(m.gift_image_strip_limit_short())).toBeVisible();
		await expect
			.element(strip.getByText(m.gift_image_strip_limit({ max: MAX_GIFT_IMAGES })))
			.toBeInTheDocument();
		await expect.element(screen.getByTestId('gift-image-strip-add')).not.toBeInTheDocument();

		await screen
			.getByRole('button', { name: m.gift_image_strip_remove_label({ position: 1 }) })
			.click();
		await expect.element(screen.getByTestId('gift-image-strip-add')).toBeVisible();
		await expect
			.element(strip.getByText(m.gift_image_strip_limit_short()))
			.not.toBeInTheDocument();
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
	// A square photo on the 4:3 card: Celý shows it whole at 75 %, and a free zoom may
	// go on out until 15 % of the window stays clear on each side vertically,
	// so the photo fills 70 % of the window height: 0.75 × 0.7 = 0.525.
	const cardContainZoom = 0.75;
	const cardZoomOutFloor = 0.525;

	type Screen = Awaited<ReturnType<typeof renderGallery>>['screen'];

	async function openCardFraming(images: GiftImage[]) {
		await page.viewport(1280, 900);
		const rendered = await renderGallery(images);
		await rendered.screen.getByTestId('gift-image-edit-entry').click();
		await expect.element(rendered.screen.getByTestId('gift-framing-view-square')).toBeVisible();
		return rendered;
	}

	function cardControls(screen: Screen) {
		return screen.getByTestId('gift-framing-controls-square');
	}

	function cardStatus(screen: Screen) {
		return screen.getByTestId('gift-framing-status-square');
	}

	function cardSurface(screen: Screen) {
		return screen.getByTestId('gift-framing-view-square').getByTestId('crop-pan-surface');
	}

	it('turns Vyplnit into Vlastní on zoom-out and continues past the whole-photo zoom', async () => {
		const fillMeta: ImageMetadata = { ...imageMeta(null), fitMode: IMAGE_FIT_MODES.coverCrop };
		const { screen, onupdate } = await openCardFraming([
			{ imageUrl: svgUrl(300), imageKey: null, imageMeta: fillMeta },
		]);
		await expect
			.element(cardControls(screen).getByRole('radio', { name: m.image_fit_fill() }))
			.toHaveAttribute('aria-checked', 'true');

		(cardSurface(screen).element() as HTMLElement).focus();
		for (let press = 0; press < 4; press += 1) {
			await userEvent.keyboard('-');
		}
		await expect.element(cardStatus(screen)).toHaveTextContent(m.gift_image_framing_custom());
		await screen.getByRole('button', { name: m.save() }).first().click();

		const savedMeta = onupdate.mock.calls[0]![0].images![0]!.imageMeta!;
		expect(savedMeta.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(savedMeta.targets!.square!.zoom).toBeLessThan(cardContainZoom);
		expect(savedMeta.targets!.square!.zoom).toBeGreaterThanOrEqual(cardZoomOutFloor - 1e-6);
	});

	it('lets the zoom slider reach the zoom-out floor itself', async () => {
		const { screen, onupdate } = await openCardFraming([galleryImage(300)]);
		const slider = cardControls(screen).getByRole('slider', {
			name: m.image_crop_zoom_label(),
		});

		(slider.element() as HTMLElement).focus();
		await userEvent.keyboard('{Home}');
		await expect.element(cardStatus(screen)).toHaveTextContent(m.gift_image_framing_custom());
		await expect.element(slider).toHaveAttribute('aria-valuetext', '53 %');
		await expect
			.element(cardControls(screen).getByRole('button', { name: m.image_crop_zoom_out() }))
			.toBeDisabled();
		await screen.getByRole('button', { name: m.save() }).first().click();

		const cardCrop = onupdate.mock.calls[0]![0].images![0]!.imageMeta!.targets!.square!;
		expect(cardCrop.zoom).toBeCloseTo(cardZoomOutFloor, 6);
	});

	it('zooms Karta out from Celý to a margin around the whole photo and leaves Seznam as it was', async () => {
		const { screen, onupdate } = await openCardFraming([galleryImage(300)]);
		const zoomOut = cardControls(screen).getByRole('button', { name: m.image_crop_zoom_out() });
		await expect.element(zoomOut).toBeEnabled();

		await zoomOut.click();
		await expect.element(cardStatus(screen)).toHaveTextContent(m.gift_image_framing_custom());
		(cardSurface(screen).element() as HTMLElement).focus();
		for (let press = 0; press < 10; press += 1) {
			await userEvent.keyboard('-');
		}
		await expect.element(zoomOut).toBeDisabled();

		// The square photo's 1:1 list view still shows the whole photo at 100 %.
		await expect
			.element(screen.getByTestId('gift-framing-zoom-thumb'))
			.toHaveAttribute('aria-valuetext', '100 %');
		await screen.getByRole('button', { name: m.save() }).first().click();

		const savedMeta = onupdate.mock.calls[0]![0].images![0]!.imageMeta!;
		expect(savedMeta.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
		const cardCrop = savedMeta.targets!.square!;
		expect(cardCrop.zoom).toBeCloseTo(cardZoomOutFloor, 6);
		expect(cardCrop.cropRect.w).toBeGreaterThan(1);
		// The photo spans 70 % of the window height, so the window is 1 / 0.7 photos tall.
		expect(cardCrop.cropRect.h).toBeCloseTo(1 / 0.7, 6);
		expect(savedMeta.targets!.thumb!.zoom).toBeCloseTo(1, 6);
		expect(savedMeta.targets!.thumb!.cropRect.w).toBeCloseTo(1, 6);
		expect(savedMeta.targets!.thumb!.cropRect.h).toBeCloseTo(1, 6);
	});
});
