import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, shareWishlist } from './fixtures/wishlist-helpers.js';

const SAMPLE_IMAGE_PORTRAIT_PATH = fileURLToPath(
	new URL('./fixtures/sample-image-portrait.png', import.meta.url),
);

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Gift detail image presentation', () => {
	test('visitor detail view renders the full uncropped photo at its natural aspect', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('gift-detail-natural-aspect');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(ownerPage, 'Detail Natural Aspect Coverage');
		const giftName = 'Testovaci darek portret';

		await ownerPage
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const addDialog = ownerPage.getByRole('dialog');
		await expect(addDialog).toBeVisible({ timeout: 5_000 });
		await addDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);

		await addDialog.getByRole('radio', { name: 'Nahrát', exact: true }).click();
		const fileInput = addDialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		await fileInput.setInputFiles(SAMPLE_IMAGE_PORTRAIT_PATH);
		await expect(addDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});

		await addDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(addDialog).not.toBeVisible({ timeout: 10_000 });
		await expect(ownerPage.getByRole('heading', { name: giftName, level: 3 })).toBeVisible({
			timeout: 10_000,
		});

		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		const visitorContext = await browser.newContext();
		const visitorPage = await visitorContext.newPage();
		await visitorPage.goto(wishlistPath);
		await visitorPage.getByText(giftName, { exact: true }).first().click();
		const visitorDialog = visitorPage.getByRole('dialog');
		await expect(visitorDialog).toBeVisible({ timeout: 5_000 });

		const detailImage = visitorDialog
			.getByTestId('gift-detail-view-image-column')
			.locator('img');
		await expect(detailImage).toBeVisible({ timeout: 10_000 });
		await expect
			.poll(() =>
				detailImage.evaluate(
					(image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
				),
			)
			.toBe(true);
		await expect
			.poll(
				() =>
					detailImage.evaluate((image: HTMLImageElement) => {
						const renderedAspect = image.clientWidth / image.clientHeight;
						const naturalAspect = image.naturalWidth / image.naturalHeight;
						return Math.abs(renderedAspect - naturalAspect) / naturalAspect;
					}),
				{
					message: 'the detail image keeps its decoded natural aspect without cropping',
				},
			)
			.toBeLessThan(0.01);

		await visitorContext.close();
	});
});
