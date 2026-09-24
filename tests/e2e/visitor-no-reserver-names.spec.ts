import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	addGift,
	shareWishlist,
	generateInviteLink,
} from './fixtures/wishlist-helpers.js';

/**
 * Reserver names are moderator-only (issue #198): visitors may see that a gift is reserved, but
 * only a správce may see who reserved it. The same reservation fixture exercises both sides of
 * that privacy boundary so the positive cannot pass against unrelated state.
 */
test.describe('Reserver names are moderator-only (issue #198)', () => {
	test('visitor never sees the reserver name while a manager sees it', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('reserver-privacy-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'Reserver Privacy Test');
		await addGift(ownerPage, 'Privacy Gift');
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		const inviteUrl = await generateInviteLink(ownerPage);
		await ownerPage.keyboard.press('Escape');
		await ownerPage.context().close();

		const reserver = createTestUser('reserver-privacy-reserver');
		const reserverCookies = await registerViaApi(request, baseURL!, reserver);
		const reserverContext = await createAuthenticatedContext(
			browser,
			reserverCookies,
			baseURL!,
		);
		const reserverPage = await reserverContext.newPage();
		await reserverPage.goto(wishlistPath);
		await expect(reserverPage.getByTestId('reserve-button').first()).toBeVisible({
			timeout: 10_000,
		});
		await reserverPage.getByTestId('reserve-button').first().click();
		const reserveDialog = reserverPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible({ timeout: 5_000 });
		await reserveDialog.getByRole('button', { name: /Rezervovat/ }).click();
		await expect(reserveDialog).not.toBeVisible({ timeout: 10_000 });
		await reserverContext.close();

		const visitor = createTestUser('reserver-privacy-visitor');
		const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
		await visitorPage.goto(wishlistPath);
		const giftCard = visitorPage
			.locator('[data-gift-item]')
			.filter({ hasText: 'Privacy Gift' });
		await expect(giftCard.getByText(/Rezervováno|Reserved/).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(giftCard.getByTestId('reserve-button')).toHaveCount(0);
		await expect(visitorPage.getByText(reserver.name)).toHaveCount(0);
		await visitorPage.context().close();

		const manager = createTestUser('reserver-privacy-manager');
		const managerCookies = await registerViaApi(request, baseURL!, manager);
		const managerContext = await createAuthenticatedContext(browser, managerCookies, baseURL!);
		const managerPage = await managerContext.newPage();
		await managerPage.goto(new URL(inviteUrl).pathname);
		const acceptButton = managerPage.getByRole('button', { name: /Přijmout pozvánku/ });
		await expect(acceptButton).toBeVisible({ timeout: 5_000 });
		await expect(acceptButton).toBeEnabled();
		await acceptButton.click();
		await managerPage.waitForURL(`**${wishlistPath}`, { timeout: 10_000 });
		await expect(managerPage.getByText(reserver.name).first()).toBeVisible({
			timeout: 10_000,
		});

		await managerContext.close();
	});
});
