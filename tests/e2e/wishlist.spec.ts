import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	expectShareMethodsStep,
	openShareWishlistDialog,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';

test.describe('Wishlist page', () => {
	test('first share visits methods before success and reopen starts at methods', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-share');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Share');
		await expect(
			page
				.getByRole('main')
				.locator(
					'[data-testid="wishlist-mobile-hero"]:visible, [data-testid="wishlist-banner"]:visible',
				)
				.getByText('Koncept'),
		).toBeVisible();
		await expect(page.getByText(/Tento seznam (je.t.|jeste) nebyl sd.len/i)).toHaveCount(0);
		await addGift(page, 'Share Test Gift');

		const dialog = await openShareWishlistDialog(page);
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

		await expect(
			page
				.getByRole('main')
				.locator(
					'[data-testid="wishlist-mobile-hero"]:visible, [data-testid="wishlist-banner"]:visible',
				)
				.getByText(/Sd.leno|Sdileno/),
		).toBeVisible({ timeout: 5_000 });

		await openShareWishlistDialog(page);
		await expectShareMethodsStep(page);
		await expect(
			dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }),
		).toHaveCount(0);

		await page.context().close();
	});
});
