import { test, expect } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

async function createWishlistAndNavigate(page: import('@playwright/test').Page, title: string) {
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

test.describe('Wishlist page', () => {
	test('shows draft banner for unshared wishlist', async ({ browser, request, baseURL }) => {
		const user = createTestUser('wl-draft');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Draft');
		await expect(page.getByText('Tento seznam jeste nebyl sdilen')).toBeVisible();
		await expect(page.getByRole('main').getByText('Koncept')).toBeVisible();

		await page.context().close();
	});

	test('can add a gift with all fields', async ({ browser, request, baseURL }) => {
		const user = createTestUser('wl-gift');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Gifts');
		await page
			.getByRole('button', { name: /Pridat/ })
			.first()
			.click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('textbox', { name: /Nazev/i }).fill(TEST_GIFT.name);
		await dialog.getByRole('textbox', { name: /Popis/i }).fill('Testovaci popis darku');
		await dialog.getByLabel(/Cena/).fill(TEST_GIFT.price);
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();

		await expect(page.getByText(TEST_GIFT.name)).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});

	test('view switcher toggles between card/list/compact', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-views');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Views');
		const cardBtn = page.getByRole('button', { name: 'Karta' });
		const listBtn = page.getByRole('button', { name: 'Seznam', exact: true });
		const compactBtn = page.getByRole('button', { name: 'Kompakt' });

		await expect(cardBtn).toHaveAttribute('aria-pressed', 'true');

		await listBtn.click();
		await expect(listBtn).toHaveAttribute('aria-pressed', 'true');

		await compactBtn.click();
		await expect(compactBtn).toHaveAttribute('aria-pressed', 'true');

		await page.context().close();
	});

	test('share wizard completes three steps', async ({ browser, request, baseURL }) => {
		const user = createTestUser('wl-share');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Share');

		// Add a gift first (required before sharing in some UIs)
		await page
			.getByRole('button', { name: /Pridat/ })
			.first()
			.click();
		let dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 10_000 });
		await dialog.getByRole('textbox', { name: /Nazev/i }).fill('Share Test Gift');
		await dialog.getByRole('button', { name: 'Pridat darek' }).click();
		await expect(page.getByText('Share Test Gift')).toBeVisible({ timeout: 5_000 });

		// Start sharing
		await page
			.getByRole('button', { name: /Sdilet seznam/ })
			.first()
			.click();
		dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		// Step 1: confirm
		await dialog.getByRole('button', { name: 'Sdilet seznam' }).click();

		// Step 3: success
		await expect(dialog.getByText('Seznam byl sdilen!')).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('button', { name: 'Hotovo' }).click();

		// After sharing, status should change
		await expect(page.getByRole('main').getByText('Sdíleno')).toBeVisible({ timeout: 5_000 });

		await page.context().close();
	});
});
