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
 * consumer surface (acceptance: tolerance assert for gift card/detail/square and
 * wishlist card/thumbnail/social), switching targets visibly reshapes the stage,
 * the banner slot is gone from the wishlist editor, a manual crop is never
 * silently discarded at render time, and crops survive a save/reload round-trip.
 *
 * Aspect data comes from the same registry the app renders from (REQ-6), so the
 * asserts can only fail when a surface and the editor genuinely drift apart.
 */

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

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
		await dialog.locator('#gift-name').fill(giftName);

		// Upload a gift image so the fit-mode controls appear.
		await dialog.getByRole('button', { name: /Nahrát/i }).click();
		const fileInput = dialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(dialog.getByTestId('image-upload-preview')).toBeVisible({ timeout: 10_000 });

		// Preview tiles render at the true aspect of their real surfaces (REQ-7; F3 fix:
		// the detail tile is ~1:2, not the pre-#116 3:4 claim).
		await expectAspect(
			dialog.getByTestId('gift-preview-card'),
			GIFT_CROP_TARGET_SPECS.card.aspect,
			FLUID_TOLERANCE,
		);
		await expectAspect(
			dialog.getByTestId('gift-preview-list'),
			GIFT_CROP_TARGET_SPECS.square.aspect,
			FIXED_TOLERANCE,
		);
		await expectAspect(
			dialog.getByTestId('gift-preview-detail'),
			GIFT_CROP_TARGET_SPECS.detail.aspect,
			FIXED_TOLERANCE,
		);
		await expectAspect(
			dialog.getByTestId('gift-preview-reservation'),
			GIFT_CROP_TARGET_SPECS.square.aspect,
			FIXED_TOLERANCE,
		);

		// Crop mode exposes the per-target picker and the WYSIWYG stage.
		await dialog.getByRole('radio', { name: /Oříznout/ }).click();
		const stageWindow = dialog.getByTestId('crop-stage-window');
		await expectAspect(stageWindow, GIFT_CROP_TARGET_SPECS.card.aspect, FIXED_TOLERANCE);

		// Switching targets visibly reshapes the stage window (REQ-2).
		await dialog.getByRole('radio', { name: /^Detail$/ }).click();
		await expectAspect(stageWindow, GIFT_CROP_TARGET_SPECS.detail.aspect, FIXED_TOLERANCE);
		await dialog.getByRole('radio', { name: /Seznam a rezervace/ }).click();
		await expectAspect(stageWindow, GIFT_CROP_TARGET_SPECS.square.aspect, FIXED_TOLERANCE);

		// Draw a manual card crop: zoom in (slider +4 × step 5 = 120 %), then pan.
		await dialog.getByRole('radio', { name: /Karta dárku/ }).click();
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
		await expectAspect(cardImage, GIFT_CROP_TARGET_SPECS.card.aspect, FLUID_TOLERANCE);
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

		// Round-trip: reopening the gift restores crop mode, the card zoom, and the
		// detail column itself measures at the aspect the stage claimed for it.
		await page.locator('[aria-label="Karta"]').click();
		const editDialog = page.getByRole('dialog');
		// Click the gift name text (bubbles to the card wrapper that opens the editor);
		// retried because a card-center click can land on an inner interactive control.
		await expect(async () => {
			await page.getByText(giftName, { exact: true }).first().click();
			await expect(editDialog).toBeVisible({ timeout: 2_000 });
		}).toPass({ timeout: 15_000 });
		await expect(editDialog.getByRole('radio', { name: /Oříznout/ })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(editDialog.getByText('120 %')).toBeVisible({ timeout: 10_000 });
		await expectAspect(
			editDialog.getByTestId('gift-image-column'),
			GIFT_CROP_TARGET_SPECS.detail.aspect,
			FLUID_TOLERANCE,
		);

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

		// The stage window tracks the active slot's aspect (REQ-2).
		const stageWindow = page.getByTestId('crop-stage-window');
		await expectAspect(stageWindow, WISHLIST_SLOT_SPECS.card.aspect, FIXED_TOLERANCE);
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
