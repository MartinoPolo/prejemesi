import { expect, type Page } from '@playwright/test';

/**
 * Shared wishlist/gift interaction helpers for E2E specs.
 *
 * Selectors target the app's real Czech accessible names (with diacritics) – do not
 * strip diacritics: Playwright's accessible-name matching is diacritic-sensitive, so
 * `'Nazev'` does NOT match the rendered label `'Název'`.
 */

/**
 * Wait for any modal overlay to fully detach. The dialog content hides immediately on
 * close, but the separate overlay element animates out and keeps intercepting pointer
 * events until removed – so the next click can be swallowed unless we wait for it.
 */
async function waitForOverlayGone(page: Page): Promise<void> {
	await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0, { timeout: 5_000 });
}

/** Create a wishlist from /my-lists via the modal and wait until its detail page loads. */
export async function createWishlistAndNavigate(page: Page, title: string): Promise<string> {
	await page.goto('/my-lists');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Vytvořit seznam' }).first().click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('textbox', { name: 'Název' }).fill(title);
	await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();

	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	await page.waitForLoadState('networkidle');
	return new URL(page.url()).pathname;
}

/** Add a gift (name only) to the currently open wishlist detail page. */
export async function addGift(page: Page, name: string): Promise<void> {
	await page
		.getByRole('button', { name: /Přidat/ })
		.first()
		.click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('textbox', { name: 'Název' }).fill(name);
	await dialog.getByRole('button', { name: 'Přidat dárek' }).click();

	// Wait for the dialog to close so its lingering input value can't pollute later
	// name-based locators, then confirm the gift card (an <h3> heading) rendered.
	await expect(dialog).not.toBeVisible({ timeout: 10_000 });
	await waitForOverlayGone(page);
	await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible({ timeout: 10_000 });
}

/** Run the share wizard to completion, making the wishlist active/shared. */
export async function shareWishlist(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Sdílet seznam' }).first().click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('button', { name: 'Sdílet seznam' }).click();
	await expect(dialog.getByText('Seznam byl sdílen!')).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('button', { name: 'Hotovo' }).click();
	// Wait for the dialog (and its overlay) to fully close before returning, otherwise the
	// closing overlay can intercept clicks on header buttons in the following steps.
	await expect(dialog).not.toBeVisible({ timeout: 5_000 });
	await waitForOverlayGone(page);
	await page.waitForLoadState('networkidle');
}
