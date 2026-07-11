import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

test.describe('Wishlist page', () => {
	test('shows draft status chip and single share action for unshared wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-draft');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Draft');

		// Anime-sky redesign (#102, REQ-12): the full-width draft lifecycle strip is removed.
		// The unshared state is surfaced by the compact "Koncept" status chip in the header.
		await expect(page.getByRole('main').getByText('Koncept')).toBeVisible();
		await expect(page.getByText(/Tento seznam (je.t.|jeste) nebyl sd.len/i)).toHaveCount(0);

		// A single „Sdílet" action opens the share wizard (replacing the removed strips).
		await expect(
			page.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }).first(),
		).toBeVisible();

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
		const cardBtn = page.getByRole('radio', { name: 'Karta' });
		const listBtn = page.getByRole('radio', { name: 'Seznam', exact: true });
		const compactBtn = page.getByRole('radio', { name: 'Kompakt' });

		await expect(cardBtn).toHaveAttribute('aria-checked', 'true');

		await listBtn.click();
		await expect(listBtn).toHaveAttribute('aria-checked', 'true');

		await compactBtn.click();
		await expect(compactBtn).toHaveAttribute('aria-checked', 'true');

		await page.context().close();
	});

	test('share wizard completes three steps', async ({ browser, request, baseURL }) => {
		const user = createTestUser('wl-share');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Share');

		await page
			.getByRole('button', {
				name: /P.idat p..n.|Pridat prani|P.idat d.rek|Pridat darek/,
			})
			.first()
			.click();
		let dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 10_000 });
		await dialog.getByRole('textbox', { name: /N.zev|Nazev/i }).fill('Share Test Gift');
		await dialog.getByRole('button', { name: /P.idat d.rek|Pridat darek/ }).click();
		await expect(page.getByText('Share Test Gift')).toBeVisible({ timeout: 5_000 });

		await page
			.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ })
			.first()
			.click();
		dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		await dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }).click();

		await expect(dialog.getByText(/Seznam byl sd.len!/i)).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('button', { name: 'Hotovo' }).click();

		await expect(page.getByRole('main').getByText(/Sd.leno|Sdileno/)).toBeVisible({
			timeout: 5_000,
		});

		await page.context().close();
	});
});
