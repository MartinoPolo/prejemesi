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
	test('tablet layout keeps horizontal tabs, fixed scrolling content, and Save on every tab', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('settings-global-layout'),
		);
		await createWishlistAndNavigate(page, 'Globální nastavení');
		await page.setViewportSize({ width: 760, height: 420 });
		const dialog = await openSettings(page);
		const tabs = dialog.getByRole('tablist');
		expect(await tabs.getAttribute('aria-orientation')).toBe('horizontal');
		expect(await tabs.evaluate((node) => getComputedStyle(node).flexWrap)).toBe('nowrap');
		expect(await tabs.evaluate((node) => getComputedStyle(node).overflowX)).toBe('auto');
		const tabBoxes = await tabs
			.getByRole('tab')
			.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
		expect(new Set(tabBoxes.map((box) => Math.round(box.y))).size).toBe(1);
		expect(Math.max(...tabBoxes.map((box) => box.height))).toBeLessThan(60);

		const content = dialog.getByTestId('wishlist-settings-scroll-region');
		const footer = dialog.getByTestId('wishlist-settings-footer');
		expect(await content.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto');
		const footerY = (await footer.boundingBox())!.y;
		for (const tabName of ['Import a export', 'Nebezpečná zóna']) {
			await dialog.getByRole('tab', { name: tabName }).click();
			await expect(footer.getByRole('button', { name: 'Uložit' })).toBeVisible();
			await expect
				.poll(async () => Math.abs((await footer.boundingBox())!.y - footerY))
				.toBeLessThanOrEqual(3);
		}
		await page.context().close();
	});

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
