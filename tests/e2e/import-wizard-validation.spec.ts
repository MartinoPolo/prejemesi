import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { openCreateWishlistDialog } from './fixtures/wishlist-helpers.js';
import { collectBrowserDiagnostics } from './fixtures/browser-diagnostics.js';

test('navbar import refreshes the home overview in place', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const user = createTestUser('navbar-home-import');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	const wishlistTitle = `Import z navigace ${Date.now()}`;
	const browserDiagnostics = collectBrowserDiagnostics(page);

	try {
		await page.goto('/home');
		const createButton = page
			.getByRole('button', { name: 'Vytvořit', exact: true })
			.filter({ hasText: 'Vytvořit' });
		await expect(createButton).toBeVisible();
		const createDialog = await openCreateWishlistDialog(page);
		await createDialog.getByRole('button', { name: 'Importovat dárky' }).click();

		const importDialog = page.getByRole('dialog', { name: 'Importovat dárky' });
		await expect(importDialog).toBeVisible({ timeout: 20_000 });

		const csv = 'Nazev,Odkaz\nDárek z navigace,https://example.com/navbar-gift\n';
		await importDialog.locator('input[type="file"]').setInputFiles({
			name: 'navbar-gifts.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from(csv, 'utf-8'),
		});

		const titleInput = importDialog.getByRole('textbox', { name: 'Název seznamu' });
		await expect(titleInput).toBeVisible({ timeout: 5_000 });
		await titleInput.fill(wishlistTitle);
		await importDialog.getByRole('button', { name: 'Pokračovat' }).click();
		await importDialog.getByRole('button', { name: 'Vytvořit seznam', exact: true }).click();

		await expect(importDialog).toContainText('Hotovo. Přidáno 1 dárků.', { timeout: 20_000 });
		await expect(page).toHaveURL(new URL('/home', baseURL!).toString());
		await importDialog.getByRole('button', { name: 'Zavřít' }).click();

		await expect(
			page.getByRole('main').getByRole('link', { name: wishlistTitle, exact: true }).first(),
		).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveURL(new URL('/home', baseURL!).toString());
	} catch (error) {
		await testInfo.attach('import-browser-diagnostics', {
			body: browserDiagnostics(),
			contentType: 'text/plain',
		});
		throw error;
	} finally {
		await page.context().close();
	}
});
