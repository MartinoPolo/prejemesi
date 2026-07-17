import { test, expect, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	GIFT_CROP_TARGET_SPECS,
	WISHLIST_SLOT_SPECS,
} from '../../src/lib/modules/images/crop_targets.js';

/**
 * E2E regression for the WYSIWYG per-target crop editor (issue #116): the crop
 * stage window and every preview tile must render at the true aspect of the real
 * consumer surface (acceptance: tolerance assert for gift square and wishlist
 * card/thumbnail/social), the banner slot is gone from the wishlist editor, a
 * manual crop is never silently discarded at render time, and crops survive a
 * save/reload round-trip.
 *
 * Aspect data comes from the same registry the app renders from (REQ-6), so the
 * asserts can only fail when a surface and the editor genuinely drift apart.
 *
 * The #116 follow-up three-mode model (Fill / Fit / Manual) is covered too: Fit
 * letterboxes both axes on the real card surface, preview tiles and wheel
 * gestures promote to Manual, and the modal footer stays pinned while the form
 * body scrolls. Round 2 adds the floating card + merged square tiles in the
 * image column and manual zoom-out below 100 % (letterboxed on exactly one
 * axis) surviving to the real card surface. Round 3 added the narrow detail
 * switcher tile and moved the display-mode toggle into the image column,
 * removing the per-target radio picker. Issue #165 retired the `detail` editor
 * target entirely (the visitor detail modal moved to the shared `square` crop):
 * the preview strip is now a single square tile, and the main stage previews
 * square framing too, so it is now the ONLY target switcher.
 */

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));
// Non-square source (issue #165): the sole remaining editor target is square,
// and a square SOURCE image's contain zoom already equals 100 % (there is no
// "below 100 %" to reach). A portrait source gives the square target a
// normalized aspect ≠ 1, so it can zoom out and letterbox exactly one axis –
// the regression the retired tall `detail` target used to demonstrate.
const SAMPLE_IMAGE_PORTRAIT_PATH = fileURLToPath(
	new URL('./fixtures/sample-image-portrait.png', import.meta.url),
);

/** Fixed-size surfaces render exactly; fluid ones vary slightly with layout. */
const FIXED_TOLERANCE = 0.03;
const FLUID_TOLERANCE = 0.15;

async function expectAspect(locator: Locator, expected: number, tolerance: number) {
	await expect(locator).toBeVisible({ timeout: 10_000 });
	const box = await locator.boundingBox();
	expect(box, 'element has a bounding box').not.toBeNull();
	const ratio = box!.width / box!.height;
	expect(
		Math.abs(ratio - expected) / expected,
		`aspect ${ratio.toFixed(3)} vs expected ${expected.toFixed(3)}`,
	).toBeLessThanOrEqual(tolerance);
}

/** Wait for the same-origin upload proxy to confirm a stored object (PUT → 201). */
function waitForUpload(page: Page) {
	return page.waitForResponse(
		(response) =>
			response.request().method() === 'PUT' &&
			response.url().includes('/api/upload/') &&
			response.status() === 201,
		{ timeout: 15_000 },
	);
}

async function createWishlistAndNavigate(page: Page, title: string) {
	await page.goto('/my-lists');
	await page.waitForSelector('h1');
	const dialog = page.getByRole('dialog');
	// Retry the click until hydration has wired the button (avoids networkidle waits).
	await expect(async () => {
		await page
			.getByRole('button', { name: /Vytvořit/ })
			.first()
			.click();
		await expect(dialog).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 15_000 });
	await dialog.locator('#wishlist-title').fill(title);
	await dialog.locator('button[type=submit]').click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
}

async function openAddGiftDialog(page: Page): Promise<ReturnType<Page['getByRole']>> {
	await page
		.getByRole('button', { name: /Přidat (dárek|první přání)/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	return dialog;
}

/** Drag the crop stage by a pixel delta (pans the image under the fixed window). */
async function dragStage(page: Page, stage: Locator, dx: number, dy: number) {
	const box = await stage.boundingBox();
	expect(box).not.toBeNull();
	const centerX = box!.x + box!.width / 2;
	const centerY = box!.y + box!.height / 2;
	await page.mouse.move(centerX, centerY);
	await page.mouse.down();
	await page.mouse.move(centerX + dx, centerY + dy, { steps: 5 });
	await page.mouse.up();
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Gift per-target crop (WYSIWYG stage)', () => {
	test('stage matches each target aspect, previews are honest, crop reaches the card surface', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('img-gift-crop');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Gift Crop Coverage');
		const dialog = await openAddGiftDialog(page);

		const giftName = 'Dárek s ořezem';
		const giftDescription = 'Popis pro mobilní rozložení';
		await dialog.locator('#gift-name').fill(giftName);
		await dialog.locator('#gift-description').fill(giftDescription);

		// Upload a gift image so the fit-mode controls appear.
		await dialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
		const fileInput = dialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(dialog.getByTestId('image-upload-preview')).toBeVisible({ timeout: 10_000 });

		// The single square preview tile (issue #165: the narrow detail switcher
		// tile was retired along with the `detail` editor target) overlays the
		// image column and renders at the true aspect of the shared card/list/
		// reservation/detail-modal surface.
		await expectAspect(
			dialog.getByTestId('gift-preview-square'),
			GIFT_CROP_TARGET_SPECS.square.aspect,
			FIXED_TOLERANCE,
		);
		await expect(dialog.getByTestId('gift-preview-card')).toHaveCount(0);
		await expect(dialog.getByTestId('gift-preview-detail')).toHaveCount(0);
		// The floats live INSIDE the image column, not in the form column.
		const imageColumnBox = await dialog.getByTestId('gift-image-column').boundingBox();
		const cardTileBox = await dialog.getByTestId('gift-preview-square').boundingBox();
		expect(imageColumnBox).not.toBeNull();
		expect(cardTileBox).not.toBeNull();
		expect(cardTileBox!.x).toBeGreaterThanOrEqual(imageColumnBox!.x);
		expect(cardTileBox!.x + cardTileBox!.width).toBeLessThanOrEqual(
			imageColumnBox!.x + imageColumnBox!.width + 1,
		);
		// The display-mode toggle lives in the image column too (round 3).
		const fillRadioBox = await dialog.getByRole('radio', { name: /Vyplnit/ }).boundingBox();
		expect(fillRadioBox).not.toBeNull();
		expect(fillRadioBox!.x).toBeGreaterThanOrEqual(imageColumnBox!.x);
		expect(fillRadioBox!.x + fillRadioBox!.width).toBeLessThanOrEqual(
			imageColumnBox!.x + imageColumnBox!.width + 1,
		);

		// Fit letterboxes BOTH axes: the preview image renders with object-fit
		// contain instead of cropping the height (#116 follow-up).
		await dialog.getByRole('radio', { name: /Přizpůsobit/ }).click();
		// Scoped to the big preview – the floating tiles add their own img elements.
		const columnImage = dialog.getByTestId('image-fit-preview').locator('img');
		await expect(async () => {
			expect(await columnImage.evaluate((el) => getComputedStyle(el).objectFit)).toBe(
				'contain',
			);
		}).toPass({ timeout: 5_000 });

		// Clicking the preview tile jumps to Manual mode with the square target
		// active and exposes the WYSIWYG stage. The tile is the ONLY target
		// switcher (round 3 established tiles-only switching; issue #165 made
		// square the only target left to switch to), and the window chip names it.
		await dialog.getByTestId('gift-preview-square').click();
		await expect(dialog.getByRole('radio', { name: /Ručně/ })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(dialog.getByTestId('gift-preview-tile-square')).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await expect(dialog.getByRole('radio', { name: /Seznam a rezervace/ })).toHaveCount(0);
		const stageWindow = dialog.getByTestId('crop-stage-window');
		await expectAspect(stageWindow, GIFT_CROP_TARGET_SPECS.square.aspect, FIXED_TOLERANCE);
		await expect(stageWindow).toContainText('Seznam a rezervace');

		// Draw a manual square crop: zoom in (slider +4 × step 5 = 120 %), then pan.
		const zoomSlider = dialog.getByRole('slider');
		await zoomSlider.focus();
		for (let step = 0; step < 4; step++) {
			await zoomSlider.press('ArrowRight');
		}
		await expect(dialog.getByText('120 %')).toBeVisible();
		await dragStage(page, dialog.getByTestId('crop-stage'), 40, 24);

		// Save the gift.
		await dialog.getByRole('button', { name: /Přidat dárek/ }).click();
		await expect(page.getByText(giftName)).toBeVisible({ timeout: 10_000 });

		// The card surface renders at the registry aspect AND applies the manual crop:
		// the focal point moved off-center, so object-position is not 50% 50% (REQ-3 –
		// a drawn crop is never silently discarded).
		const cardImage = page.getByRole('img', { name: giftName }).first();
		await expectAspect(cardImage, GIFT_CROP_TARGET_SPECS.square.aspect, FLUID_TOLERANCE);
		const objectPosition = await cardImage.evaluate(
			(el) => getComputedStyle(el).objectPosition,
		);
		expect(objectPosition).not.toBe('50% 50%');

		// The list view thumbnail is the square family's real surface.
		await page.locator('[aria-label="Seznam"]').click();
		await expectAspect(
			page.getByRole('img', { name: giftName }).first(),
			GIFT_CROP_TARGET_SPECS.square.aspect,
			FIXED_TOLERANCE,
		);

		// #163 mobile list: the recipient gets a 128-152px square image on the
		// left, with all content beside it and no reservation control exposed.
		await page.setViewportSize({ width: 390, height: 844 });
		const mobileListImage = page.getByRole('img', { name: giftName }).first();
		// A manual crop may zoom the <img> beyond its clipped frame. Measure the
		// visible 1:1 ImageFrame, which is the actual list-thumbnail geometry.
		const mobileImageFrame = mobileListImage.locator('..');
		const mobileImageBox = await mobileImageFrame.boundingBox();
		const mobileTitleBox = await page.getByText(giftName, { exact: true }).boundingBox();
		const mobileDescriptionBox = await page
			.getByText(giftDescription, { exact: true })
			.boundingBox();
		expect(mobileImageBox).not.toBeNull();
		expect(mobileTitleBox).not.toBeNull();
		expect(mobileDescriptionBox).not.toBeNull();
		expect(mobileImageBox!.width).toBeGreaterThanOrEqual(128);
		expect(mobileImageBox!.width).toBeLessThanOrEqual(152);
		expect(Math.abs(mobileImageBox!.width - mobileImageBox!.height)).toBeLessThanOrEqual(1);
		expect(mobileTitleBox!.x).toBeGreaterThan(mobileImageBox!.x + mobileImageBox!.width);
		expect(mobileDescriptionBox!.x).toBeGreaterThanOrEqual(
			mobileImageBox!.x + mobileImageBox!.width,
		);
		await expect(page.getByRole('button', { name: /^Rezervovat/ })).toHaveCount(0);
		await page.setViewportSize({ width: 1280, height: 900 });

		// Round-trip: reopening the gift restores crop mode and the card zoom.
		await page.locator('[aria-label="Karta"]').click();
		const editDialog = page.getByRole('dialog');
		// Click the gift name text (bubbles to the card wrapper that opens the editor);
		// retried because a card-center click can land on an inner interactive control.
		await expect(async () => {
			await page.getByText(giftName, { exact: true }).first().click();
			await expect(editDialog).toBeVisible({ timeout: 2_000 });
		}).toPass({ timeout: 15_000 });
		await expect(editDialog.getByRole('radio', { name: /Ručně/ })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(editDialog.getByText('120 %')).toBeVisible({ timeout: 10_000 });
		// The image column itself is the create/edit form's own fixed 45%/55% grid
		// cell (#116/#131/#142), unrelated to whichever crop target is active inside
		// it – it still measures at the `detail` spec's real-world aspect (that spec
		// now documents the column's own shape, not a selectable crop target).
		// Issue #165 retired `detail` as a crop TARGET (the visitor modal moved to
		// `square`); resizing the editor's own column to match is a separate layout
		// change explicitly deferred (SUMMARY.md "Out of scope flag", coordinate
		// with #163) rather than done here.
		await expectAspect(
			editDialog.getByTestId('gift-image-column'),
			GIFT_CROP_TARGET_SPECS.detail.aspect,
			FLUID_TOLERANCE,
		);

		// Pinned footer: the submit button stays visible before and after the form
		// body is scrolled to its end (the fields scroll, the actions do not).
		const submitButton = editDialog.getByRole('button', { name: 'Uložit' });
		await expect(submitButton).toBeInViewport();
		await editDialog.getByTestId('gift-form-scroll').evaluate((el) => {
			el.scrollTop = el.scrollHeight;
		});
		await expect(submitButton).toBeInViewport();

		// Switch to Fit and save: the real card surface letterboxes the
		// image on both axes (object-fit contain) instead of cropping it.
		await editDialog.getByRole('radio', { name: /Přizpůsobit/ }).click();
		await submitButton.click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });
		const wholeCardImage = page.getByRole('img', { name: giftName }).first();
		await expect(async () => {
			expect(await wholeCardImage.evaluate((el) => getComputedStyle(el).objectFit)).toBe(
				'contain',
			);
		}).toPass({ timeout: 10_000 });

		// Zoom OUT below 100 % (round 2): reopen (Fit round-trips), then replace the
		// square sample image with a portrait source before switching to Manual.
		// Issue #165 retired the tall `detail` target this regression used to
		// switch to; a square source's contain zoom on the (now sole) square
		// target already equals 100 %, so it cannot demonstrate a one-axis
		// letterboxed zoom-out. A non-square source gives the square target a
		// normalized aspect ≠ 1, reproducing the same regression honestly.
		await expect(async () => {
			await page.getByText(giftName, { exact: true }).first().click();
			await expect(editDialog).toBeVisible({ timeout: 2_000 });
		}).toPass({ timeout: 15_000 });
		await expect(editDialog.getByRole('radio', { name: /Přizpůsobit/ })).toHaveAttribute(
			'aria-checked',
			'true',
		);

		// Replace the image (edit mode already shows the Upload tab with the
		// existing image, so the file input is already mounted) and wait for the
		// display-mode control to remount for the new source before switching modes.
		const portraitUploaded = waitForUpload(page);
		await editDialog.locator('input[type=file]').setInputFiles(SAMPLE_IMAGE_PORTRAIT_PATH);
		await portraitUploaded;
		await expect(editDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});

		await editDialog.getByRole('radio', { name: /Ručně/ }).click();
		await expect(editDialog.getByTestId('crop-stage')).toBeVisible();
		const zoomOutSlider = editDialog.getByRole('slider');
		// This portrait source has never been decoded by the stage before (unlike
		// the cached image reused elsewhere in this test), so the stage's own
		// `naturalRatio` measurement genuinely races the click above; the slider
		// stays `disabled` until it resolves (ImageCropStage `isReady` guard).
		// Interacting before then is a silent no-op, not a real zoom-out.
		await expect(zoomOutSlider).toBeEnabled();
		await zoomOutSlider.focus();
		await zoomOutSlider.press('Home');
		expect(Number(await zoomOutSlider.inputValue())).toBeLessThan(100);
		await editDialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });
		await expect(async () => {
			await page.getByText(giftName, { exact: true }).first().click();
			await expect(editDialog).toBeVisible({ timeout: 2_000 });
			// Reopening the editor proves the square-target zoom-out persisted.
			await expect(editDialog.getByRole('radio', { name: /Ručně/ })).toHaveAttribute(
				'aria-checked',
				'true',
			);
			expect(Number(await editDialog.getByRole('slider').inputValue())).toBeLessThan(100);
		}).toPass({ timeout: 10_000 });

		await page.context().close();
	});
});

test.describe('Wishlist per-slot crop (WYSIWYG stage)', () => {
	test('three slots (no banner), stage tracks slot aspect, crop persists and reaches real surfaces', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('img-wl-crop');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Wishlist Crop Coverage');

		const shortIdMatch = page.url().match(/\/w\/([^/?#]+)/);
		expect(shortIdMatch, 'wishlist short id present in URL').not.toBeNull();
		const shortId = shortIdMatch![1];

		await page.goto(`/w/${shortId}/settings#image`);
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

		const fileInput = page.locator('input[type=file]').first();
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(page.getByText(/Všechna místa/)).toBeVisible({ timeout: 10_000 });

		// The orphan banner slot is gone from the editor (D3/REQ-4)…
		await expect(page.getByRole('button', { name: /Záhlaví/ })).toHaveCount(0);
		// …and the three remaining tiles render at their real consumer aspects (REQ-7).
		await expectAspect(
			page.getByTestId('wishlist-preview-card'),
			WISHLIST_SLOT_SPECS.card.aspect,
			FLUID_TOLERANCE,
		);
		await expectAspect(
			page.getByTestId('wishlist-preview-thumbnail'),
			WISHLIST_SLOT_SPECS.thumbnail.aspect,
			FIXED_TOLERANCE,
		);
		await expectAspect(
			page.getByTestId('wishlist-preview-social'),
			WISHLIST_SLOT_SPECS.social.aspect,
			FIXED_TOLERANCE,
		);

		// Slot tiles carry aria-pressed; this keeps them distinct from the crop stage,
		// whose accessible name also contains the active slot label.
		const slotTile = (label: string) =>
			page.locator('button[aria-pressed]').filter({ hasText: label });

		// Fill is the default after upload: no stage until a manual intent. A wheel
		// gesture over the plain preview promotes the slot to Manual (#116 follow-up)
		// and the stage window appears locked to the active slot's aspect.
		const stageWindow = page.getByTestId('crop-stage-window');
		await expect(stageWindow).toHaveCount(0);
		await page.getByTestId('image-fit-preview').hover();
		await page.mouse.wheel(0, -100);
		await expectAspect(stageWindow, WISHLIST_SLOT_SPECS.card.aspect, FIXED_TOLERANCE);

		// Clicking a tile jumps to Manual for that slot; the stage tracks it (REQ-2).
		await slotTile('Sdílení').click();
		await expectAspect(stageWindow, WISHLIST_SLOT_SPECS.social.aspect, FIXED_TOLERANCE);

		// Draw a manual thumbnail crop (zoom 120 %) and save.
		const thumbnailTile = slotTile('Miniatura');
		await thumbnailTile.click();
		await expect(thumbnailTile).toHaveAttribute('aria-pressed', 'true');
		await expectAspect(stageWindow, WISHLIST_SLOT_SPECS.thumbnail.aspect, FIXED_TOLERANCE);
		const zoomSlider = page.getByRole('slider');
		await zoomSlider.focus();
		for (let step = 0; step < 4; step++) {
			await zoomSlider.press('ArrowRight');
		}
		await expect(page.getByText('120 %')).toBeVisible();
		await page.getByTestId('wishlist-image-save').click();
		await expect(page.getByText(/Obrázek seznamu byl uložen/)).toBeVisible({ timeout: 10_000 });

		// The header polaroid consumes the thumbnail slot at 1:1 (D4/REQ-5).
		await page.goto(`/w/${shortId}`);
		await page.waitForSelector('h1');
		const polaroid = page.locator('.polaroid-img img');
		await expectAspect(polaroid, WISHLIST_SLOT_SPECS.thumbnail.aspect, FIXED_TOLERANCE);
		const polaroidZoom = await polaroid.evaluate((el) => getComputedStyle(el).transform);
		expect(polaroidZoom, 'saved 120 % zoom reaches the polaroid').not.toBe('none');

		// The dashboard card banner renders at the registry card aspect. (The banner
		// subtree is aria-hidden – the card link carries the accessible name – so the
		// image is located by CSS, not by role.)
		await page.goto('/my-lists');
		await expectAspect(
			page
				.getByTestId('wishlist-card')
				.filter({ hasText: 'Wishlist Crop Coverage' })
				.locator('img')
				.first(),
			WISHLIST_SLOT_SPECS.card.aspect,
			FLUID_TOLERANCE,
		);

		// Round-trip: reopening the editor restores the persisted thumbnail crop.
		await page.goto(`/w/${shortId}/settings#image`);
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
		await page.locator('button[aria-pressed]').filter({ hasText: 'Miniatura' }).click();
		await expect(page.getByText('120 %')).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});
