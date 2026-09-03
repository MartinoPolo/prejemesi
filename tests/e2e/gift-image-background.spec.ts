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
	test('defaults to dotted Transparent and persists explicit black', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const user = createTestUser('gift-image-background');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		const defaultGiftName = 'Dárek s výchozím pozadím';
		const blackGiftName = 'Dárek s černým pozadím';

		await createWishlistAndNavigate(page, 'Issue 252 background fill');
		const defaultDialog = await openAddGiftDialog(page);
		await defaultDialog.getByRole('textbox', { name: 'Název' }).fill(defaultGiftName);
		await defaultDialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
		const defaultUpload = waitForUpload(page);
		await defaultDialog.locator('input[type=file]').setInputFiles(SAMPLE_IMAGE_PATH);
		await defaultUpload;
		await expect(defaultDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});
		await defaultDialog.getByRole('radio', { name: /Přizpůsobit/ }).click();
		await expect(defaultDialog.getByRole('radio', { name: 'Průhledné' })).toBeChecked();
		await expect(defaultDialog.getByTestId('gift-preview-card-pattern')).toBeVisible();
		await defaultDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(defaultDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);

		const blackDialog = await openAddGiftDialog(page);
		await blackDialog.getByRole('textbox', { name: 'Název' }).fill(blackGiftName);
		await blackDialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
		const blackUpload = waitForUpload(page);
		await blackDialog.locator('input[type=file]').setInputFiles(SAMPLE_IMAGE_PATH);
		await blackUpload;
		await expect(blackDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});
		await blackDialog.getByRole('radio', { name: /Přizpůsobit/ }).click();
		await blackDialog.getByRole('radio', { name: 'Černé' }).click();
		await expect(blackDialog.getByTestId('gift-preview-card-pattern')).toHaveCount(0);
		await blackDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(blackDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);

		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.locator('[aria-label="Karta"]:visible').click();
		const defaultCardFrame = page
			.locator('[data-gift-item]')
			.filter({ hasText: defaultGiftName })
			.getByTestId('gift-card-image-frame');
		const blackCardFrame = page
			.locator('[data-gift-item]')
			.filter({ hasText: blackGiftName })
			.getByTestId('gift-card-image-frame');
		await expect(defaultCardFrame.getByTestId('gift-card-image-pattern')).toBeVisible({
			timeout: 10_000,
		});
		await expect(blackCardFrame).toHaveCSS('background-color', 'rgb(0, 0, 0)');
		await expect(blackCardFrame.getByTestId('image-frame')).toHaveCSS(
			'background-color',
			'rgb(0, 0, 0)',
		);
		await expect(blackCardFrame.getByTestId('gift-card-image-pattern')).toHaveCount(0);
		await page.screenshot({ path: testInfo.outputPath('issue-252-default-and-black.png') });

		await page.locator('[data-gift-item]').filter({ hasText: blackGiftName }).click();
		const editDialog = page.getByRole('dialog');
		await editDialog.getByRole('radio', { name: 'Průhledné' }).click();
		await expect(editDialog.getByTestId('gift-preview-card-pattern')).toBeVisible();
		await editDialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);
		await page.reload({ waitUntil: 'domcontentloaded' });
		const normalizedCardFrame = page
			.locator('[data-gift-item]')
			.filter({ hasText: blackGiftName })
			.getByTestId('gift-card-image-frame');
		await expect(normalizedCardFrame.getByTestId('gift-card-image-pattern')).toBeVisible({
			timeout: 10_000,
		});
		await page.locator('[data-gift-item]').filter({ hasText: blackGiftName }).click();
		await expect(
			page.getByRole('dialog').getByRole('radio', { name: 'Průhledné' }),
		).toBeChecked();

		await page.context().close();
	});
});
