import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(
	new URL('./fixtures/sample-image-portrait.png', import.meta.url),
);

function waitForUpload(page: Page) {
	return page.waitForResponse(
		(response) =>
			response.request().method() === 'PUT' &&
			response.url().includes('/api/upload/') &&
			response.status() === 201,
		{ timeout: 15_000 },
	);
}

async function openAddGiftDialog(page: Page) {
	await page
		.getByRole('button', { name: /Přidat (dárek|první přání)/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	return dialog;
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Gift image background fill (issue #252)', () => {
	test('saves Fit plus black and reloads with a black card frame', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const user = createTestUser('gift-image-background');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		const giftName = 'Dárek s černým pozadím';

		await createWishlistAndNavigate(page, 'Issue 252 background fill');
		const createDialog = await openAddGiftDialog(page);
		await createDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);
		await createDialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
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
		await waitForDialogOverlayRemoval(page);

		await page.locator('[data-gift-item]').filter({ hasText: giftName }).click();
		const editDialog = page.getByRole('dialog');
		await expect(editDialog).toBeVisible({ timeout: 5_000 });
		await editDialog.getByRole('radio', { name: /Přizpůsobit/ }).click();
		await editDialog.getByRole('radio', { name: /Černé/ }).click();
		await editDialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);

		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.locator('[aria-label="Karta"]').click();
		const cardFrame = page
			.locator('[data-gift-item]')
			.filter({ hasText: giftName })
			.getByTestId('gift-card-image-frame');
		await expect(cardFrame).toBeVisible({ timeout: 10_000 });
		await expect(cardFrame).toHaveCSS('background-color', 'rgb(0, 0, 0)');
		await expect(cardFrame.getByTestId('image-frame')).toHaveCSS(
			'background-color',
			'rgb(0, 0, 0)',
		);
		await expect(cardFrame.getByTestId('gift-card-image-pattern')).toHaveCount(0);

		await page.screenshot({ path: testInfo.outputPath('issue-252-card-black-fill.png') });
		await page.context().close();
	});
});
