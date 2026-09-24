import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

async function openSettings(page: Awaited<ReturnType<typeof registerAndGetPage>>) {
	await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
	const dialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe('wishlist settings global save', () => {
	test('one global Save persists Details, Categories, Appearance, and Image/Crops', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('settings-global-four-domain'),
		);
		await createWishlistAndNavigate(page, 'Původní název');
		let dialog = await openSettings(page);

		await dialog.getByLabel('Název').fill('Čtyři uložené oblasti');
		await dialog.getByLabel('Popis').fill('Globálně uložený popis');
		await dialog.getByRole('tab', { name: 'Kategorie' }).click();
		await dialog.getByPlaceholder('Vlastní kategorie').fill('Globální kategorie');
		await dialog.getByRole('button', { name: 'Vytvořit kategorii' }).click();
		await dialog.getByRole('tab', { name: 'Vzhled' }).click();
		await dialog.getByRole('button', { name: 'Oceán' }).click();
		await dialog.getByRole('tab', { name: 'Obrázek a ořezy' }).click();
		const uploaded = page.waitForResponse(
			(response) => response.request().method() === 'PUT' && response.status() === 201,
		);
		await dialog.locator('input[type=file]').setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(dialog.getByRole('button', { name: 'Změnit obrázek' })).toBeVisible();
		await dialog.getByRole('radio', { name: /Přizpůsobit/ }).click();

		await dialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(dialog).not.toBeVisible();

		dialog = await openSettings(page);
		await expect(dialog.getByLabel('Název')).toHaveValue('Čtyři uložené oblasti');
		await expect(dialog.getByLabel('Popis')).toHaveValue('Globálně uložený popis');
		await dialog.getByRole('tab', { name: 'Kategorie' }).click();
		const customSection = dialog
			.getByRole('heading', { name: 'Vlastní kategorie' })
			.locator('..');
		await expect(customSection.locator('input:not([type="color"])')).toHaveValue(
			'Globální kategorie',
		);
		await dialog.getByRole('tab', { name: 'Vzhled' }).click();
		await expect(dialog.getByRole('button', { name: 'Oceán' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await dialog.getByRole('tab', { name: 'Obrázek a ořezy' }).click();
		await expect(dialog.getByRole('button', { name: 'Změnit obrázek' })).toBeVisible();
		await expect(dialog.getByRole('radio', { name: /Přizpůsobit/ })).toBeChecked();
		await page.context().close();
	});

	test('guarded Save and continue persists the draft before closing', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('settings-global-guard-save'),
		);
		await createWishlistAndNavigate(page, 'Guardovaný koncept');
		let dialog = await openSettings(page);
		await dialog.getByLabel('Popis').fill('Uložit před pokračováním');
		await dialog.getByRole('button', { name: 'Zavřít' }).click();
		await page.getByRole('button', { name: 'Uložit a pokračovat' }).click();
		await expect(dialog).not.toBeVisible();
		dialog = await openSettings(page);
		await expect(dialog.getByLabel('Popis')).toHaveValue('Uložit před pokračováním');
		await page.context().close();
	});
});
