import { test, expect, type Browser, type Page } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import {
	createAuthenticatedContext,
	loginViaApi,
	registerAndGetPage,
} from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	shareWishlist,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';

/**
 * Administrator release override (issue #213). The administrator is env-based
 * (`ADMIN_EMAILS` → `isAppAdmin`), so this spec depends on `playwright.config.ts` passing
 * `ADMIN_EMAILS=tomas@test.cz` to the dev server.
 *
 * CAVEAT: `webServer.reuseExistingServer` is true — an already-running `pnpm run dev` keeps
 * the env it was started with, and `tomas@test.cz` will NOT be an administrator there. If the
 * release control never appears, restart the dev server (or let Playwright start its own).
 *
 * Personas come from the seed (`pnpm db:seed`, shared password below): tomáš is the
 * administrator and is neither obdarovaný nor správce anywhere in this spec; petr is the
 * signed-in gifter whose reservation only an administrator may release. The wishlist and gift
 * are created fresh per run, so the spec is repeatable without reseeding.
 */
const SEED_PASSWORD = 'password123';
const ADMIN_USER = { email: 'tomas@test.cz', password: SEED_PASSWORD };
const GIFTER_USER = { email: 'petr@test.cz', password: SEED_PASSWORD };
const GIFTER_DISPLAY_NAME = 'Petr Svoboda';

async function signInAs(
	browser: Browser,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
	user: { email: string; password: string },
): Promise<Page> {
	const cookies = await loginViaApi(request, baseURL, user);
	const context = await createAuthenticatedContext(browser, cookies, baseURL);
	return context.newPage();
}

/** Reserve the single gift on the open wishlist page through the reserve dialog. */
async function reserveTheGift(page: Page): Promise<void> {
	await page.getByTestId('reserve-button').first().click();
	const reserveDialog = page.getByRole('dialog');
	await expect(reserveDialog).toBeVisible({ timeout: 5_000 });
	await reserveDialog.getByRole('button', { name: 'Rezervovat', exact: true }).click();
	await expect(reserveDialog).not.toBeVisible({ timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
	// The gift now reads as held by this gifter: the control flips to the cancel action.
	await expect(page.getByTestId('reserve-button').first()).toHaveText(/Zrušit rezervaci/);
}

test.describe('Administrator releases another gifter reservation (issue #213)', () => {
	test('releases a signed-in gifter reservation from a gift card and frees the capacity', async ({
		browser,
		request,
		baseURL,
	}) => {
		// Fresh list from a fresh owner: nobody in this spec is its obdarovaný or správce.
		const owner = createTestUser('release-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'E2E uvolneni rezervace');
		await addGift(ownerPage, TEST_GIFT.name, { price: TEST_GIFT.price });
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		// Petr (signed in) reserves the gift — the case that returns 403 for everyone but the
		// app administrator.
		const gifterPage = await signInAs(browser, request, baseURL!, GIFTER_USER);
		await gifterPage.goto(wishlistPath);
		await gifterPage.waitForLoadState('networkidle');
		await reserveTheGift(gifterPage);
		await gifterPage.context().close();

		// Tomáš (administrator, plain visitor on this list) sees the release control.
		const adminPage = await signInAs(browser, request, baseURL!, ADMIN_USER);
		await adminPage.goto(wishlistPath);
		await adminPage.waitForLoadState('networkidle');

		const reserveButton = adminPage.getByTestId('reserve-button').first();
		await expect(reserveButton).toBeDisabled();
		await expect(reserveButton).toHaveText(/Rezervováno/);

		const releaseButton = adminPage.getByTestId('release-reservation-button').first();
		await expect(releaseButton).toBeVisible({ timeout: 15_000 });
		await releaseButton.click();

		// One reservation on the gift → the picker is skipped and the confirmation names both
		// the gifter and the gift (REQ-4/REQ-8).
		const confirmation = adminPage.getByTestId('release-reservation-confirm');
		await expect(confirmation).toBeVisible({ timeout: 5_000 });
		await expect(confirmation).toContainText(GIFTER_DISPLAY_NAME);
		await expect(confirmation).toContainText(TEST_GIFT.name);

		await adminPage.getByTestId('release-reservation-confirm-action').click();
		await waitForDialogOverlayRemoval(adminPage);

		// Released capacity returns immediately: the gift stops reading as fully reserved and
		// there is nothing left to release.
		await expect(adminPage.getByTestId('reserve-button').first()).toBeEnabled({
			timeout: 15_000,
		});
		await expect(adminPage.getByTestId('reserve-button').first()).toHaveText(/Rezervovat/);
		await expect(adminPage.getByTestId('release-reservation-button')).toHaveCount(0);

		await adminPage.context().close();
	});

	test('renders no release control for a signed-in visitor who is not the administrator', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('release-denied-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'E2E bez uvolneni');
		await addGift(ownerPage, TEST_GIFT.name, { price: TEST_GIFT.price });
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		const gifterPage = await signInAs(browser, request, baseURL!, GIFTER_USER);
		await gifterPage.goto(wishlistPath);
		await gifterPage.waitForLoadState('networkidle');
		await reserveTheGift(gifterPage);
		await gifterPage.context().close();

		// A plain signed-in visitor: sees the reserved state, never the release control (REQ-7).
		const visitor = createTestUser('release-denied-visitor');
		const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
		await visitorPage.goto(wishlistPath);
		await visitorPage.waitForLoadState('networkidle');

		await expect(visitorPage.getByTestId('reserve-button').first()).toBeDisabled();
		await expect(visitorPage.getByTestId('release-reservation-button')).toHaveCount(0);

		await visitorPage.context().close();
	});
});
