import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

test.describe('Authenticated shadow depth appearance flow', () => {
	test('desktop depth selection synchronizes and persists through navigation and reload', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('appearance-depth');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/home');

		const desktopPalette = page.getByRole('dialog', { name: 'Barevná paleta' });
		await expect(async () => {
			await page.getByRole('button', { name: 'Barevná paleta' }).click();
			await expect(desktopPalette).toBeVisible({ timeout: 2_000 });
		}).toPass({ timeout: 15_000 });
		const black = desktopPalette.getByRole('radio', { name: 'Černé' });
		await black.click();
		await expect(page.locator('html')).toHaveAttribute('data-depth', 'black');
		await expect(black).toBeChecked();

		await page.keyboard.press('Escape');
		await page.setViewportSize({ width: 900, height: 800 });
		await page.getByRole('button', { name: 'Vzhled' }).click();
		const appearanceMenu = page.getByRole('dialog', { name: 'Vzhled' });
		await expect(appearanceMenu.getByRole('radio', { name: 'Černé' })).toBeChecked();
		await page.keyboard.press('Escape');

		await page.getByRole('button', { name: new RegExp(user.name) }).click();
		await page.getByRole('menuitem', { name: 'Nastavení' }).click();
		await expect(page).toHaveURL(/\/settings\/?$/);
		await expect(page.locator('html')).toHaveAttribute('data-depth', 'black');
		await expect(page.getByRole('radio', { name: 'Černé' })).toBeChecked();

		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('data-depth', 'black');
		await expect(page.getByRole('radio', { name: 'Černé' })).toBeChecked();
		await page.context().close();
	});
});
