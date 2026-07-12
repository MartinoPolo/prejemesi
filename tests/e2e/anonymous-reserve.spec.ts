import { test, expect } from '@playwright/test';
import { createTestUser, TEST_GIFT, ANONYMOUS_RESERVER } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';

test.describe('Anonymous visitor reservation', () => {
	test('anonymous visitor can view and reserve on shared wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('anon-owner');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		// Create wishlist, add a gift, and share it
		await createWishlistAndNavigate(page, 'Anonymni Test');
		await addGift(page, TEST_GIFT.name);
		await shareWishlist(page);

		const wishlistPath = new URL(page.url()).pathname;
		await page.context().close();

		// Anonymous visitor
		const visitorContext = await browser.newContext();
		const visitorPage = await visitorContext.newPage();
		await visitorPage.addInitScript(() => {
			(window as unknown as { turnstile: unknown }).turnstile = {
				render: (
					_container: HTMLElement,
					options: { callback: (token: string) => void },
				) => {
					queueMicrotask(() => options.callback('XXXX.DUMMY.TOKEN.XXXX'));
					return 'playwright-turnstile';
				},
				reset: () => undefined,
				remove: () => undefined,
			};
		});
		await visitorPage.goto(wishlistPath);
		await visitorPage.waitForLoadState('networkidle');
		await expect(visitorPage.getByText(TEST_GIFT.name)).toBeVisible();
		await expect(visitorPage.getByRole('button', { name: /Rezervovat/ })).toBeVisible();

		// Reserve
		await visitorPage
			.getByRole('button', { name: /Rezervovat/ })
			.first()
			.click();
		const reserveDialog = visitorPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible();
		await reserveDialog
			.getByRole('textbox', { name: /Vaše jméno/i })
			.fill(ANONYMOUS_RESERVER.name);
		const submitReservationButton = reserveDialog.getByRole('button', { name: /Rezervovat/ });
		await expect(submitReservationButton).toBeEnabled();
		await submitReservationButton.click();
		await expect(visitorPage.getByText(/[Rr]ezervov/).first()).toBeVisible();

		await visitorContext.close();
	});
});
