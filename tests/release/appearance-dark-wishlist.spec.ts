import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from '../e2e/fixtures/test-data.js';
import { registerAndGetPage, waitForAppHydration } from '../e2e/fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from '../e2e/fixtures/wishlist-helpers.js';

async function switchToDarkMode(page: Page) {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.evaluate(() => localStorage.setItem('mode-watcher-mode', 'dark'));
	await page.reload();
	await waitForAppHydration(page);
	await expect(page.locator('html')).toHaveClass(/\bdark\b/);
}

async function openDisplayMenu(page: Page) {
	await page.mouse.move(0, 0);
	const trigger = page.getByTestId('desktop-display-trigger').filter({ visible: true });
	await trigger.focus();
	await trigger.press('Enter');
	const menu = page
		.locator('[data-slot="dropdown-menu-content"][data-state="open"]:visible')
		.last();
	await expect(menu).toBeVisible({ timeout: 5_000 });
	return menu;
}

test.describe('Dark wishlist appearance', () => {
	test('wishlist menus take the wishlist palette in dark mode, and the dark page background persists', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('appearance-dark-wishlist');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.setViewportSize({ width: 1280, height: 800 });
		const wishlistPath = await createWishlistAndNavigate(page, 'Tmavý seznam');
		const wishlistPalette = await page
			.getByTestId('wishlist-page-shell')
			.getAttribute('data-palette');
		expect(wishlistPalette).toBeTruthy();

		await switchToDarkMode(page);
		await expect(await openDisplayMenu(page)).toHaveAttribute(
			'data-dark-palette',
			wishlistPalette!,
		);
		await page.keyboard.press('Escape');

		await page.goto('/settings');
		await waitForAppHydration(page);
		const backgroundGroup = page.getByRole('group', { name: 'Pozadí seznamu v tmavém režimu' });
		await expect(backgroundGroup.getByRole('radio', { name: 'Barvy aplikace' })).toBeChecked();
		await backgroundGroup.getByRole('radio', { name: 'Jemný nádech' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-dark-wishlist-background', 'tint');

		await expect(async () => {
			await page.reload();
			await expect(page.locator('html')).toHaveAttribute(
				'data-dark-wishlist-background',
				'tint',
				{ timeout: 2_000 },
			);
		}).toPass({ timeout: 15_000 });
		await page.goto(wishlistPath);
		await expect(page.locator('html')).toHaveAttribute('data-dark-wishlist-background', 'tint');
		await page.context().close();
	});
});
