import { test, expect } from '@playwright/test';
import { createTestUser, TEST_GIFT, ANONYMOUS_RESERVER } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';

test.describe('Owner cannot see reservation state', () => {
	test('owner view hides reservation info after visitor reserves', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('owner-norsvp');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		// Create wishlist, add a gift, and share it
		await createWishlistAndNavigate(ownerPage, 'Tajny seznam');
		await addGift(ownerPage, TEST_GIFT.name);
		await shareWishlist(ownerPage);

		const wishlistPath = new URL(ownerPage.url()).pathname;

		// Reserve as anonymous visitor
		const visitorContext = await browser.newContext();
		const visitorPage = await visitorContext.newPage();
		await visitorPage.goto(wishlistPath);
		await visitorPage.waitForLoadState('networkidle');
		await visitorPage
			.getByRole('button', { name: /Rezervovat/ })
			.first()
			.click();
		const reserveDialog = visitorPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible({ timeout: 5_000 });
		await reserveDialog
			.getByRole('textbox', { name: /Vaše jméno/i })
			.fill(ANONYMOUS_RESERVER.name);
		await reserveDialog.getByRole('button', { name: /Rezervovat/ }).click();
		await expect(visitorPage.getByText(/[Rr]ezervov/).first()).toBeVisible({ timeout: 5_000 });
		await visitorContext.close();

		// Owner reloads and must NOT see reservation info
		await ownerPage.reload();
		await expect(ownerPage.getByText(TEST_GIFT.name)).toBeVisible();

		// Owner should NOT see "Rezervovano" badge
		await expect(ownerPage.getByText(/Rezervov[aá]no/)).not.toBeVisible();

		// Owner should NOT see "Rezervovat" button (owners can't reserve their own gifts)
		await expect(ownerPage.getByRole('button', { name: /Rezervovat/ })).not.toBeVisible();

		await ownerPage.context().close();
	});
});
