import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

async function createWishlistAndNavigate(page: Page, title: string) {
	await page.goto('/my-lists');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
	await page
		.getByRole('button', { name: /Vytvořit/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('textbox', { name: 'Nazev' }).fill(title);
	await dialog.getByRole('button', { name: 'Vytvorit' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	await page.waitForLoadState('networkidle');
}

function getThemeButton(page: Page) {
	return page.getByRole('button', { name: /Změnit motiv|Motiv/ });
}

test.describe('Theme change workflow', () => {
	test('owner can open theme dialog and see presets', async ({ browser, request, baseURL }) => {
		const user = createTestUser('theme-open');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Theme Test Open');

		await getThemeButton(page).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await expect(dialog.getByText('Motiv seznamu')).toBeVisible();

		// All 5 presets should be visible
		await expect(dialog.getByText('Výchozí')).toBeVisible();
		await expect(dialog.getByText('Vánoce')).toBeVisible();
		await expect(dialog.getByText('Narozeniny')).toBeVisible();
		await expect(dialog.getByText('Zábava')).toBeVisible();
		await expect(dialog.getByText('Elegantní')).toBeVisible();

		// Custom color option
		await expect(dialog.getByText('Vlastní barva')).toBeVisible();

		await page.context().close();
	});

	test('owner can select a preset and save', async ({ browser, request, baseURL }) => {
		const user = createTestUser('theme-save');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Theme Test Save');

		// Open theme dialog
		await getThemeButton(page).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		// Select Christmas preset
		await dialog.getByText('Vánoce').click();

		// Save
		await dialog.getByRole('button', { name: /Uložit/ }).click();

		// Dialog should close
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Theme CSS variables should be applied — check that the wrapper has custom properties
		const primaryColor = await page.evaluate(() => {
			const wrapper = document.querySelector('[style*="--wishlist-primary"]');
			return wrapper
				? getComputedStyle(wrapper).getPropertyValue('--wishlist-primary')
				: null;
		});
		expect(primaryColor).not.toBeNull();

		await page.context().close();
	});

	test('theme persists after page reload', async ({ browser, request, baseURL }) => {
		const user = createTestUser('theme-persist');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Theme Persist');
		const wishlistUrl = page.url();

		// Set Christmas theme
		await getThemeButton(page).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await dialog.getByText('Vánoce').click();
		await dialog.getByRole('button', { name: /Uložit/ }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Capture the primary color
		const colorBeforeReload = await page.evaluate(() => {
			const wrapper = document.querySelector('[style*="--wishlist-primary"]');
			return wrapper ? wrapper.getAttribute('style') : null;
		});
		expect(colorBeforeReload).not.toBeNull();

		// Reload page
		await page.goto(wishlistUrl);
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Theme Persist', {
			timeout: 10_000,
		});

		// Theme should still be applied
		const colorAfterReload = await page.evaluate(() => {
			const wrapper = document.querySelector('[style*="--wishlist-primary"]');
			return wrapper ? wrapper.getAttribute('style') : null;
		});
		expect(colorAfterReload).not.toBeNull();
		expect(colorAfterReload).toContain('--wishlist-primary');

		await page.context().close();
	});

	test('cancel reverts theme preview', async ({ browser, request, baseURL }) => {
		const user = createTestUser('theme-cancel');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Theme Cancel');

		// Capture default theme style
		const defaultStyle = await page.evaluate(() => {
			const wrapper = document.querySelector('[style*="--wishlist-primary"]');
			return wrapper ? wrapper.getAttribute('style') : null;
		});

		// Open theme dialog, select Birthday, then cancel
		await getThemeButton(page).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await dialog.getByText('Narozeniny').click();

		// Cancel
		await dialog.getByRole('button', { name: /Zrušit/ }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Style should revert to default
		const styleAfterCancel = await page.evaluate(() => {
			const wrapper = document.querySelector('[style*="--wishlist-primary"]');
			return wrapper ? wrapper.getAttribute('style') : null;
		});
		expect(styleAfterCancel).toEqual(defaultStyle);

		await page.context().close();
	});

	test('theme gradient banner is visible on wishlist page', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('theme-banner');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Theme Banner');

		// Gradient banner should be visible (default theme has a gradient)
		const banner = page.getByTestId('theme-gradient-banner');
		await expect(banner).toBeVisible({ timeout: 5_000 });

		// Change to Christmas and verify banner updates
		await getThemeButton(page).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await dialog.getByText('Vánoce').click();
		await dialog.getByRole('button', { name: /Uložit/ }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Banner should still be visible with updated gradient
		await expect(banner).toBeVisible();
		const bannerStyle = await banner.getAttribute('style');
		expect(bannerStyle).toContain('background');

		await page.context().close();
	});

	test('non-owner cannot see theme button', async ({ browser, request, baseURL }) => {
		const owner = createTestUser('theme-owner');
		const visitor = createTestUser('theme-visitor');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(ownerPage, 'Theme Visibility');

		// Share the wishlist
		await ownerPage
			.getByRole('button', { name: /Pridat/ })
			.first()
			.click();
		let dialog = ownerPage.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 10_000 });
		await dialog.getByRole('textbox', { name: /Nazev/i }).fill('Test Gift');
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();
		await expect(ownerPage.getByText('Test Gift')).toBeVisible({ timeout: 5_000 });

		await ownerPage
			.getByRole('button', { name: /Sdilet seznam/ })
			.first()
			.click();
		dialog = ownerPage.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('button', { name: 'Sdilet seznam' }).click();
		await expect(dialog.getByText('Seznam byl sdilen!')).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('button', { name: 'Hotovo' }).click();

		const wishlistPath = new URL(ownerPage.url()).pathname;

		// Visit as another user
		const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
		await visitorPage.goto(wishlistPath);
		await visitorPage.waitForLoadState('networkidle');
		await expect(visitorPage.getByRole('heading', { level: 1 })).toContainText(
			'Theme Visibility',
			{ timeout: 10_000 },
		);

		// Theme button should not be visible to visitor
		await expect(getThemeButton(visitorPage)).not.toBeVisible();

		await ownerPage.context().close();
		await visitorPage.context().close();
	});
});
