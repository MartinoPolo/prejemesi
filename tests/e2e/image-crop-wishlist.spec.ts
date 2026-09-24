import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

function waitForUpload(page: Page) {
	return page.waitForResponse(
		(response) =>
			response.request().method() === 'PUT' &&
			response.url().includes('/api/upload/') &&
			response.status() === 201,
		{ timeout: 15_000 },
	);
}

test.use({ viewport: { width: 1280, height: 900 } });

test('saved wishlist thumbnail crop reaches the header and restores on reopen', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('img-wl-crop');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	try {
		await createWishlistAndNavigate(page, 'Wishlist Crop Coverage');

		const shortIdMatch = page.url().match(/\/w\/([^/?#]+)/);
		expect(shortIdMatch, 'wishlist short id present in URL').not.toBeNull();
		const shortId = shortIdMatch![1];

		await page.goto(`/w/${shortId}/settings#image`);
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
		const uploadCompleted = waitForUpload(page);
		await page.locator('input[type=file]').first().setInputFiles(SAMPLE_IMAGE_PATH);
		await uploadCompleted;
		await expect(page.getByText(/Všechna místa/)).toBeVisible({ timeout: 10_000 });

		const thumbnailTile = page.locator('button[aria-pressed]').filter({ hasText: 'Miniatura' });
		await thumbnailTile.click();
		await expect(thumbnailTile).toHaveAttribute('aria-pressed', 'true');
		const zoomSlider = page.getByRole('slider');
		const initialZoomValue = await zoomSlider.inputValue();
		await zoomSlider.focus();
		for (let step = 0; step < 4; step += 1) {
			await zoomSlider.press('ArrowRight');
		}
		const chosenZoomValue = await zoomSlider.inputValue();
		expect(chosenZoomValue).not.toBe(initialZoomValue);
		await page.getByTestId('wishlist-settings-save').click();
		await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

		await page.goto(`/w/${shortId}`);
		await page.waitForSelector('h1:visible');
		const headerImage = page.locator('.polaroid-img img');
		await expect(headerImage).toBeVisible({ timeout: 10_000 });
		await expect
			.poll(() => headerImage.evaluate((image) => getComputedStyle(image).transform))
			.not.toBe('none');
		const savedRenderedTransform = await headerImage.evaluate(
			(image) => getComputedStyle(image).transform,
		);

		await page.reload({ waitUntil: 'load' });
		const restoredHeaderImage = page.locator('.polaroid-img img');
		await expect(restoredHeaderImage).toBeVisible({ timeout: 10_000 });
		await expect
			.poll(() => restoredHeaderImage.evaluate((image) => getComputedStyle(image).transform))
			.toBe(savedRenderedTransform);

		await page.goto(`/w/${shortId}/settings#image`);
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
		const restoredThumbnailTile = page
			.locator('button[aria-pressed]')
			.filter({ hasText: 'Miniatura' });
		await restoredThumbnailTile.click();
		await expect(restoredThumbnailTile).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('slider')).toHaveValue(chosenZoomValue, { timeout: 10_000 });
	} finally {
		await page.context().close();
	}
});
