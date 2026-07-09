import { test, expect } from '@playwright/test';
import { createTestUser, TEST_GIFT, ANONYMOUS_RESERVER } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';

/**
 * Recipient-privacy invariant (issue #99): the RECIPIENT never sees reservation state.
 *
 * `createWishlistAndNavigate` creates a for-me list, so the creator is the linked
 * recipient (role `recipient`) — not a správce. Reservation info must stay hidden even
 * after a visitor reserves, and the recipient can never reserve their own gifts. This is
 * the same invariant the old owner model enforced, re-keyed to the recipient role.
 */
test.describe('Recipient cannot see reservation state', () => {
	test('recipient view hides reservation info after visitor reserves', async ({
		browser,
		request,
		baseURL,
	}) => {
		const recipient = createTestUser('recipient-norsvp');
		const recipientPage = await registerAndGetPage(browser, request, baseURL!, recipient);

		// Create a for-me wishlist (creator = linked recipient), add a gift, and share it
		await createWishlistAndNavigate(recipientPage, 'Tajny seznam');
		await addGift(recipientPage, TEST_GIFT.name);
		await shareWishlist(recipientPage);

		const wishlistPath = new URL(recipientPage.url()).pathname;

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

		// Recipient reloads and must NOT see reservation info
		await recipientPage.reload();
		await expect(recipientPage.getByText(TEST_GIFT.name)).toBeVisible();

		// Recipient must NOT see a „Rezervováno" badge
		await expect(recipientPage.getByText(/Rezervov[aá]no/)).not.toBeVisible();

		// Recipient must NOT see a „Rezervovat" button (recipients can't reserve their own gifts)
		await expect(recipientPage.getByRole('button', { name: /Rezervovat/ })).not.toBeVisible();

		await recipientPage.context().close();
	});
});
