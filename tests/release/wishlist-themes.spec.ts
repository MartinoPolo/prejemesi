import { test, expect, type Locator, type Page } from '@playwright/test';
import { createTestUser } from '../e2e/fixtures/test-data.js';
import { registerAndGetPage } from '../e2e/fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	waitForDialogOverlayRemoval,
} from '../e2e/fixtures/wishlist-helpers.js';

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

async function saveSettings(page: Page, dialog: Locator) {
	await dialog.getByTestId('wishlist-settings-save').click();
	await expect(dialog).toBeHidden();
	await waitForDialogOverlayRemoval(page);
}

function motifAnimationCounts(page: Page): Promise<number[]> {
	return page
		.getByTestId('wishlist-backdrop-motif')
		.evaluateAll((motifs) => motifs.map((motif) => motif.getAnimations().length));
}

test('discarding an unsaved theme leaves the wishlist unthemed', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(browser, request, baseURL!, createTestUser('themes'));
	await createWishlistAndNavigate(page, 'Motivy zahodit E2E');
	const shell = page.getByTestId('wishlist-page-shell');

	const dialog = await openAppearanceSettings(page);
	await dialog.getByRole('radio', { name: 'Vánoce', exact: true }).click();
	await expect(shell).toHaveAttribute('data-wishlist-theme', 'christmas');
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Zahodit změny' }).click();
	await expect(dialog).toBeHidden();

	await expect(shell).not.toHaveAttribute('data-wishlist-theme');
	await page.reload();
	await expect(shell).not.toHaveAttribute('data-wishlist-theme');
	await expect(page.getByTestId('wishlist-theme-backdrop')).toHaveCount(0);
	await page.context().close();
});

test('sharp corners square the wishlist surfaces after a reload', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(browser, request, baseURL!, createTestUser('themes'));
	await createWishlistAndNavigate(page, 'Motivy rohy E2E');
	const notebook = page.getByTestId('wishlist-banner');
	await expect(notebook).not.toHaveCSS('border-top-left-radius', '0px');

	const dialog = await openAppearanceSettings(page);
	await dialog.getByRole('radio', { name: 'Ostré', exact: true }).click();
	await saveSettings(page, dialog);

	await page.reload();
	await expect(notebook).toHaveCSS('border-top-left-radius', '0px');
	await page.context().close();
});

test('the OS reduced-motion setting stops the backdrop drift', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(browser, request, baseURL!, createTestUser('themes'));
	await createWishlistAndNavigate(page, 'Motivy pohyb E2E');
	const dialog = await openAppearanceSettings(page);
	await dialog.getByRole('radio', { name: 'Vánoce', exact: true }).click();
	await saveSettings(page, dialog);
	await page.reload();
	await expect(page.getByTestId('wishlist-backdrop-motif').first()).toBeAttached();

	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await expect
		.poll(async () => Math.max(...(await motifAnimationCounts(page))))
		.toBeGreaterThan(0);

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect.poll(async () => Math.max(...(await motifAnimationCounts(page)))).toBe(0);
	await page.context().close();
});
