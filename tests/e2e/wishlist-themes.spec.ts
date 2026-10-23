import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';

async function openAppearanceSettings(page: Page) {
	await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
	const dialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
	await dialog.getByRole('tab', { name: 'Vzhled' }).click();
	return dialog;
}

/**
 * Wishlist themes (#535): a theme chosen in Settings → Vzhled is saved with the global Save and
 * renders after a reload; switching the background to „Žádné" removes the backdrop. Runs on a
 * freshly created list so no seeded wishlist changes.
 */
test('a saved theme survives a reload and the background can be turned off', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(browser, request, baseURL!, createTestUser('themes'));
	await createWishlistAndNavigate(page, 'Motivy E2E');
	const shell = page.getByTestId('wishlist-page-shell');
	await expect(shell).not.toHaveAttribute('data-wishlist-theme');

	let dialog = await openAppearanceSettings(page);
	await dialog.getByRole('radio', { name: 'Vánoce', exact: true }).click();
	await expect(shell).toHaveAttribute('data-wishlist-theme', 'christmas');
	await dialog.getByTestId('wishlist-settings-save').click();
	await expect(dialog).toBeHidden();
	await waitForDialogOverlayRemoval(page);

	await page.reload();
	await expect(shell).toHaveAttribute('data-wishlist-theme', 'christmas');
	await expect(page.getByTestId('wishlist-theme-backdrop')).toBeAttached();

	dialog = await openAppearanceSettings(page);
	await dialog.getByRole('radio', { name: 'Žádné', exact: true }).click();
	await dialog.getByTestId('wishlist-settings-save').click();
	await expect(dialog).toBeHidden();

	await page.reload();
	await expect(shell).toHaveAttribute('data-wishlist-background', 'none');
	await expect(shell).not.toHaveAttribute('data-wishlist-theme');
	await expect(page.getByTestId('wishlist-theme-backdrop')).toHaveCount(0);
	await page.context().close();
});
