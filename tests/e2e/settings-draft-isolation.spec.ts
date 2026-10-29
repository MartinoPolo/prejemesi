import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

async function openSettings(page: Page) {
	await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
	const dialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
	await expect(dialog).toBeVisible();
	return dialog;
}

/** Client-side navigation through the navbar's recent-list menu keeps the wishlist page mounted. */
async function navigateToWishlistFromNavMenu(page: Page, title: string) {
	await page.getByRole('link', { name: 'Moje seznamy' }).first().hover();
	await page.getByRole('menuitem', { name: new RegExp(title) }).click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
}

test.describe('wishlist settings draft isolation (#527)', () => {
	test('a saved settings draft never leaks into the next wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('settings-draft-isolation'),
		);
		const secondPath = await createWishlistAndNavigate(page, 'Druhý seznam');
		const firstPath = await createWishlistAndNavigate(page, 'První seznam');

		let dialog = await openSettings(page);
		await dialog.getByLabel('Název').fill('První seznam upravený');
		await dialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole('heading', { level: 1 })).toContainText(
			'První seznam upravený',
		);

		await navigateToWishlistFromNavMenu(page, 'Druhý seznam');
		dialog = await openSettings(page);
		await expect(dialog.getByLabel('Název')).toHaveValue('Druhý seznam');
		await dialog.getByRole('tab', { name: 'Nebezpečná zóna' }).click();
		await dialog.getByRole('button', { name: 'Smazat seznam' }).click();
		await expect(
			page.getByRole('dialog', { name: /Smazat seznam "Druhý seznam"/ }),
		).toBeVisible();
		await expect(page.getByRole('dialog', { name: 'Máte neuložené změny' })).toHaveCount(0);

		await page.goto(secondPath);
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Druhý seznam');
		await page.goto(firstPath);
		await expect(page.getByRole('heading', { level: 1 })).toContainText(
			'První seznam upravený',
		);
		await page.context().close();
	});
});
