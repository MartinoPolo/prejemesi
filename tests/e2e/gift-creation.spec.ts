import { test, expect, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

async function openAddGiftDialog(page: Page): Promise<ReturnType<Page['getByRole']>> {
	await page
		.getByRole('button', { name: /Přidat/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	return dialog;
}

async function fillGiftUrl(dialog: Locator, url: string) {
	const urlInput = dialog.getByTestId('gift-link-url').first();
	if (!(await urlInput.isVisible().catch(() => false))) {
		await dialog.getByRole('button', { name: /Přidat odkaz|Add link/ }).click();
	}
	await urlInput.fill(url);
}

test.describe('Gift creation', () => {
	test('creates gift with supplied description, price, and link', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gc-full');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Full Gift Test');
		const dialog = await openAddGiftDialog(page);

		await dialog.getByRole('textbox', { name: 'Název' }).fill('Plný dárek');
		await dialog.getByRole('textbox', { name: /Popis/i }).fill('Testovací popis');
		await dialog.getByLabel(/Cena/).fill('1500');
		await fillGiftUrl(dialog, 'https://example.com/gift');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();

		await expect(page.getByText('Plný dárek')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(/1\s?500/)).toBeVisible({ timeout: 10_000 });

		await page.reload();
		await page.getByText('Plný dárek').click();
		const savedGiftDialog = page.getByRole('dialog');
		await expect(savedGiftDialog).toBeVisible({ timeout: 5_000 });
		await expect(
			savedGiftDialog.getByRole('textbox', { name: 'Popis', exact: true }),
		).toHaveValue('Testovací popis');
		await expect(savedGiftDialog.getByTestId('gift-link-url').first()).toHaveValue(
			'https://example.com/gift',
		);
		await expect(savedGiftDialog.getByLabel(/Cena/)).toHaveValue('1500');

		await page.context().close();
	});

	test('new gifts appear without page reload', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-refresh');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Refresh Test');

		let dialog = await openAddGiftDialog(page);
		await dialog.getByRole('textbox', { name: 'Název' }).fill('První dárek');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(dialog).not.toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('heading', { name: 'První dárek', level: 3 })).toBeVisible({
			timeout: 10_000,
		});

		dialog = await openAddGiftDialog(page);
		await dialog.getByRole('textbox', { name: 'Název' }).fill('Druhý dárek');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(dialog).not.toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('heading', { name: 'Druhý dárek', level: 3 })).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByRole('heading', { name: 'První dárek', level: 3 })).toBeVisible();

		await page.context().close();
	});
});
