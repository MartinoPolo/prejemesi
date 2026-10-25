import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

test.describe('Wishlist settings deep link', () => {
	test('a fresh load of ?settings=<tab> opens that tab and strips the marker', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-deep-link');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		const wishlistPath = await createWishlistAndNavigate(page, 'Odkaz do nastavení');

		await page.goto(`${wishlistPath}?settings=categories`);

		const settings = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await expect(settings).toBeVisible();
		await expect(settings.locator('#wishlist-settings-panel-categories')).toBeVisible();
		await expect(page).toHaveURL((url) => !url.searchParams.has('settings'));

		await page.context().close();
	});

	test('the legacy /settings route opens the details tab', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-legacy-route');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		const wishlistPath = await createWishlistAndNavigate(page, 'Starý odkaz do nastavení');

		await page.goto(`${wishlistPath}/settings`);

		const settings = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await expect(settings).toBeVisible();
		await expect(settings.locator('#wishlist-settings-panel-details')).toBeVisible();
		await expect(page).toHaveURL((url) => url.pathname === wishlistPath && url.search === '');

		await page.context().close();
	});
});
