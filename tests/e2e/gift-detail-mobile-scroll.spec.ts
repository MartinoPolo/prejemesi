import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	waitForDialogMotionToSettle,
} from './fixtures/wishlist-helpers.js';

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

test.describe('Gift edit modal mobile scroll', () => {
	test('body scrolls while Save remains visible and operable', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-mobile-scroll');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.setViewportSize({ width: 390, height: 844 });

		await createWishlistAndNavigate(page, 'Mobile Scroll Fix Coverage');

		const giftName = 'Dárek pro mobilní posun';
		await page
			.getByRole('button', { name: /Přidat (dárek|první přání)/ })
			.first()
			.click();
		const createDialog = page.getByRole('dialog');
		await expect(createDialog).toBeVisible({ timeout: 5_000 });
		await createDialog.locator('#gift-name').fill(giftName);

		await createDialog.getByRole('radio', { name: 'Nahrát', exact: true }).click();
		const fileInput = createDialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(createDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});
		await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(createDialog).not.toBeVisible({ timeout: 10_000 });

		// Reopen in edit mode (owner + unshared list: Delete renders).
		await page.getByText(giftName, { exact: true }).click();
		const dialog = page.getByRole('dialog');
		await waitForDialogMotionToSettle(dialog);

		const scrollRegion = dialog.getByTestId('gift-detail-body');
		const saveButton = dialog.getByRole('button', { name: 'Uložit' });
		await expect(saveButton).toBeVisible();
		await expect(saveButton).toBeInViewport();
		await expect(saveButton).toBeEnabled();
		expect(
			await scrollRegion.evaluate((element) => element.scrollHeight > element.clientHeight),
		).toBe(true);

		await scrollRegion.evaluate((element) => {
			element.scrollTop = element.scrollHeight;
		});
		await expect
			.poll(() => scrollRegion.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(0);
		await expect(saveButton).toBeVisible();
		await expect(saveButton).toBeInViewport();
		await expect(saveButton).toBeEnabled();
		await saveButton.click();
		await expect(dialog).not.toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});
