import { expect, test, type Page } from '@playwright/test';
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
	test('defaults to Transparent and persists explicit black through create, reload, and edit', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-image-background');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		const giftName = 'Dárek s černým pozadím';

		await createWishlistAndNavigate(page, 'Issue 252 background fill');
		const createDialog = await openAddGiftDialog(page);
		await createDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);
		await createDialog.getByRole('radio', { name: 'Nahrát', exact: true }).click();
		const upload = waitForUpload(page);
		await createDialog.locator('input[type=file]').setInputFiles(SAMPLE_IMAGE_PATH);
		await upload;
		await expect(createDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});
		await createDialog.getByRole('radio', { name: /Přizpůsobit/ }).click();
		await expect(createDialog.getByRole('radio', { name: 'Průhledné' })).toBeChecked();
		await expect(createDialog.getByTestId('gift-preview-card-pattern')).toBeVisible();
		await createDialog.getByRole('radio', { name: 'Černé' }).click();
		await expect(createDialog.getByTestId('gift-preview-card-pattern')).toHaveCount(0);
		await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(createDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);

		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.locator('[aria-label="Karta"]:visible').click();
		const giftCard = page.locator('[data-gift-item]').filter({ hasText: giftName });
		const blackCardFrame = giftCard.getByTestId('gift-card-image-frame');
		await expect(blackCardFrame).toHaveCSS('background-color', 'rgb(0, 0, 0)');
		await expect(blackCardFrame.getByTestId('image-frame')).toHaveCSS(
			'background-color',
			'rgb(0, 0, 0)',
		);
		await expect(blackCardFrame.getByTestId('gift-card-image-pattern')).toHaveCount(0);

		await giftCard.click();
		const editDialog = page.getByRole('dialog');
		await expect(editDialog.getByRole('radio', { name: 'Černé' })).toBeChecked();
		await editDialog.getByRole('radio', { name: 'Průhledné' }).click();
		await expect(editDialog.getByTestId('gift-preview-card-pattern')).toBeVisible();
		await editDialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);
		await page.reload({ waitUntil: 'domcontentloaded' });
		const transparentCardFrame = page
			.locator('[data-gift-item]')
			.filter({ hasText: giftName })
			.getByTestId('gift-card-image-frame');
		await expect(transparentCardFrame.getByTestId('gift-card-image-pattern')).toBeVisible({
			timeout: 10_000,
		});
		await page.locator('[data-gift-item]').filter({ hasText: giftName }).click();
		await expect(
			page.getByRole('dialog').getByRole('radio', { name: 'Průhledné' }),
		).toBeChecked();

		await page.context().close();
	});
});
