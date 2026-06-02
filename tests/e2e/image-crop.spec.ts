import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

/**
 * E2E smoke for the image-frame / crop work shipped by issues #34-#37 (issue #39, REQ-5):
 * gift image crop controls, wishlist per-slot crop editor, and gift image rendering across
 * the card/list views. Form fields are targeted by stable `id`s (locale-proof); buttons and
 * controls are matched by their rendered labels via diacritic-correct regex.
 */

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

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
	await page.waitForLoadState('networkidle');
	await page
		.getByRole('button', { name: /Vytvořit/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	// Stable id rather than the localized "Název" label.
	await dialog.locator('#wishlist-title').fill(title);
	await dialog.locator('button[type=submit]').click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	await page.waitForLoadState('networkidle');
}

async function openAddGiftDialog(page: Page): Promise<ReturnType<Page['getByRole']>> {
	// Empty-state CTA ("Přidat první přání") for the first gift, or the toolbar button
	// ("Přidat dárek") once gifts exist.
	await page
		.getByRole('button', { name: /Přidat (dárek|první přání)/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	return dialog;
}

test.describe('Gift image crop & views', () => {
	test('fit-mode controls adjust framing and the image renders across card/list views', async ({
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

		// Upload a gift image so the fit-mode controls appear (REQ-1).
		await dialog.getByRole('button', { name: /Nahrát/i }).click();
		const fileInput = dialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(dialog.locator('img[alt="Upload preview"]')).toBeVisible({ timeout: 10_000 });

		// The three fit modes are offered; selecting Crop then Fit-whole updates the active mode.
		const cropOption = dialog.getByRole('radio', { name: /Oříznout/ });
		const containOption = dialog.getByRole('radio', { name: /Celý obrázek/ });
		await expect(cropOption).toBeVisible();
		await cropOption.click();
		await expect(cropOption).toHaveAttribute('aria-checked', 'true');
		await containOption.click();
		await expect(containOption).toHaveAttribute('aria-checked', 'true');

		// Save the gift.
		await dialog.getByRole('button', { name: /Přidat dárek/ }).click();
		await expect(page.getByText(giftName)).toBeVisible({ timeout: 10_000 });

		// The gift image renders in the default card view…
		await expect(page.getByRole('img', { name: giftName }).first()).toBeVisible({
			timeout: 10_000,
		});

		// …and remains visible after switching to the list view (REQ image views).
		const listViewButton = page.locator('[aria-label="Seznam"]');
		await expect(listViewButton).toBeVisible({ timeout: 10_000 });
		await listViewButton.click();
		await expect(page.getByRole('img', { name: giftName }).first()).toBeVisible();

		await page.context().close();
	});
});

test.describe('Wishlist crop editor', () => {
	test('uploads an image, previews the slots, and persists the assignment', async ({
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

		await page.goto(`/w/${shortId}/settings`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

		// Upload a wishlist image via the crop editor's uploader.
		const fileInput = page.locator('input[type=file]').first();
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;

		// The per-slot preview strip appears once an image is assigned (REQ-1 slot mapping).
		await expect(page.getByText(/Všechna místa/)).toBeVisible({ timeout: 10_000 });

		// Selecting a different slot tile moves the active selection (preview workflow).
		const thumbnailTile = page.getByRole('button', { name: /Miniatura/ });
		await expect(thumbnailTile).toBeVisible();
		await thumbnailTile.click();
		await expect(thumbnailTile).toHaveAttribute('aria-pressed', 'true');

		// Save the image assignment (the settings page has several "Uložit" buttons —
		// details, image, theme — so target the image card's save by its test id).
		await page.getByTestId('wishlist-image-save').click();
		await expect(page.getByText(/Obrázek seznamu byl uložen/)).toBeVisible({ timeout: 10_000 });

		// The assignment survives a full reload / fresh SSR render.
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.getByText(/Všechna místa/)).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});
