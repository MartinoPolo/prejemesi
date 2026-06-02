import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';

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

		// All 5 presets should be visible (target the preset buttons — "Výchozí" also appears
		// in the current-theme badge, so a plain text match would be ambiguous).
		await expect(dialog.getByRole('button', { name: 'Výchozí' })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Vánoce' })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Narozeniny' })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Zábava' })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Elegantní' })).toBeVisible();

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

		// Select Christmas preset — the preset card exposes its selected state via aria-pressed
		const christmasPreset = dialog.getByRole('button', { name: /Vánoce/ });
		await christmasPreset.click();
		await expect(christmasPreset).toHaveAttribute('aria-pressed', 'true');

		// Save
		await dialog.getByRole('button', { name: /Uložit/ }).click();

		// Dialog should close
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Reopen the dialog — the saved preset should be the selected one
		await getThemeButton(page).click();
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await expect(dialog.getByRole('button', { name: /Vánoce/ })).toHaveAttribute(
			'aria-pressed',
			'true',
		);

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
		await dialog.getByRole('button', { name: /Vánoce/ }).click();
		await dialog.getByRole('button', { name: /Uložit/ }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Reload page
		await page.goto(wishlistUrl);
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Theme Persist', {
			timeout: 10_000,
		});

		// After reload the saved preset should still be selected in the theme dialog
		await getThemeButton(page).click();
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await expect(dialog.getByRole('button', { name: /Vánoce/ })).toHaveAttribute(
			'aria-pressed',
			'true',
		);

		await page.context().close();
	});

	test('cancel reverts theme preview', async ({ browser, request, baseURL }) => {
		const user = createTestUser('theme-cancel');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Theme Cancel');

		// Open theme dialog — default preset starts selected
		await getThemeButton(page).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await expect(dialog.getByRole('button', { name: /Výchozí/ })).toHaveAttribute(
			'aria-pressed',
			'true',
		);

		// Select Birthday (preview), then cancel
		const birthdayPreset = dialog.getByRole('button', { name: /Narozeniny/ });
		await birthdayPreset.click();
		await expect(birthdayPreset).toHaveAttribute('aria-pressed', 'true');
		await dialog.getByRole('button', { name: /Zrušit/ }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Reopen — selection should have reverted to the default preset
		await getThemeButton(page).click();
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await expect(dialog.getByRole('button', { name: /Výchozí/ })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await expect(dialog.getByRole('button', { name: /Narozeniny/ })).toHaveAttribute(
			'aria-pressed',
			'false',
		);

		await page.context().close();
	});

	test('themed wishlist banner is visible on wishlist page', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('theme-banner');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Theme Banner');

		// The header always shows a themed banner (theme-aware fallback hero when no image)
		const banner = page.getByTestId('wishlist-banner');
		await expect(banner).toBeVisible({ timeout: 5_000 });

		// Change to Christmas and verify banner stays visible
		await getThemeButton(page).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('button', { name: /Vánoce/ }).click();
		await dialog.getByRole('button', { name: /Uložit/ }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Banner should still be visible after the theme change
		await expect(banner).toBeVisible();

		await page.context().close();
	});

	test('non-owner cannot see theme button', async ({ browser, request, baseURL }) => {
		const owner = createTestUser('theme-owner');
		const visitor = createTestUser('theme-visitor');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(ownerPage, 'Theme Visibility');

		// Add a gift and share the wishlist
		await addGift(ownerPage, 'Test Gift');
		await shareWishlist(ownerPage);

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
