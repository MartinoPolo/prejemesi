import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	expectShareMethodsStep,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';

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

	test('first share visits methods before success and reopen starts at methods', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-share');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Share');
		await addGift(page, 'Share Test Gift');

		await page
			.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ })
			.first()
			.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await expect(
			dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }),
		).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Kopírovat' })).toHaveCount(0);

		await dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }).click();
		await expectShareMethodsStep(page);
		await expect(dialog.getByText(/Seznam byl sd.len!/i)).toHaveCount(0);
		await dialog.getByRole('button', { name: 'Hotovo' }).click();
		await expect(dialog.getByText(/Seznam byl sd.len!/i)).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('button', { name: 'Hotovo' }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });
		await waitForDialogOverlayRemoval(page);

		await expect(page.getByRole('main').getByText(/Sd.leno|Sdileno/)).toBeVisible({
			timeout: 5_000,
		});

		await page
			.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ })
			.first()
			.click();
		await expectShareMethodsStep(page);
		await expect(
			dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }),
		).toHaveCount(0);

		await page.context().close();
	});
});
