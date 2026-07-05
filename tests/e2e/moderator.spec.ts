import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

async function addGiftAndShare(page: Page, giftName: string) {
	await addGift(page, giftName);
	await shareWishlist(page);
}

async function openModeratorPanel(page: Page) {
	// The "Moderátoři" button is visible only to owners
	await page
		.getByRole('button', { name: /Moderátoři/ })
		.first()
		.click();
	const panel = page.getByRole('dialog');
	await expect(panel).toBeVisible({ timeout: 5_000 });
	return panel;
}

async function generateInviteLink(page: Page): Promise<string> {
	const panel = await openModeratorPanel(page);
	await panel.getByRole('button', { name: /Generovat pozvánku/ }).click();

	// Link element appears in the panel – grab the full URL shown
	const linkBox = panel.getByTestId('invite-link');
	await expect(linkBox).toBeVisible({ timeout: 5_000 });
	const inviteUrl = (await linkBox.textContent()) ?? '';
	return inviteUrl.trim();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Moderator system', () => {
	test('owner sees moderator management button on wishlist page', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('mod-owner-btn');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Mod Owner Btn Test');

		// The "Moderátoři" button (with UsersIcon) is rendered only for the owner
		await expect(page.getByRole('button', { name: /Moderátoři/ })).toBeVisible();

		await page.context().close();
	});

	test('owner can generate moderator invite link', async ({ browser, request, baseURL }) => {
		const owner = createTestUser('mod-invite-gen');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Mod Invite Gen Test');

		const panel = await openModeratorPanel(page);

		// "Generovat pozvánku" button is present
		await expect(panel.getByRole('button', { name: /Generovat pozvánku/ })).toBeVisible();

		// Click to generate
		await panel.getByRole('button', { name: /Generovat pozvánku/ }).click();

		// A monospace link box with the invite URL appears
		const linkBox = panel.getByTestId('invite-link');
		await expect(linkBox).toBeVisible({ timeout: 5_000 });
		const generatedUrl = (await linkBox.textContent()) ?? '';
		expect(generatedUrl.trim()).toContain('/invite/');

		// A copy button also becomes visible
		await expect(panel.getByTestId('copy-invite-link')).toBeVisible();

		await page.context().close();
	});

	test('another user can accept moderator invite and becomes moderator', async ({
		browser,
		request,
		baseURL,
	}) => {
		// ── Step 1: owner sets up wishlist + gift + sharing + invite ──────────
		const owner = createTestUser('mod-owner-flow');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(ownerPage, 'Mod Invite Flow Test');
		await addGiftAndShare(ownerPage, 'Invite Flow Gift');

		const inviteUrl = await generateInviteLink(ownerPage);
		// Close the moderator panel
		await ownerPage.keyboard.press('Escape');

		const wishlistPath = new URL(ownerPage.url()).pathname;

		// ── Step 2: new user accepts invite ───────────────────────────────────
		const invitee = createTestUser('mod-invitee');
		const inviteeCookies = await registerViaApi(request, baseURL!, invitee);
		const inviteeContext = await createAuthenticatedContext(browser, inviteeCookies, baseURL!);
		const inviteePage = await inviteeContext.newPage();

		// inviteUrl is a full URL string from the panel; navigate to the path portion
		const invitePath = new URL(inviteUrl).pathname;
		await inviteePage.goto(invitePath);
		await inviteePage.waitForLoadState('networkidle');

		// Invite acceptance page shows the pending state
		await expect(inviteePage.getByRole('button', { name: /Přijmout pozvánku/ })).toBeVisible({
			timeout: 5_000,
		});
		await inviteePage.getByRole('button', { name: /Přijmout pozvánku/ }).click();

		// After acceptance the page redirects to the wishlist
		await inviteePage.waitForURL(`**${wishlistPath}`, { timeout: 10_000 });
		await inviteePage.waitForLoadState('networkidle');

		// Moderator sees gift reservation status (same as visitor, with full detail)
		// The gift is visible and no "Moderátoři" button – moderators don't manage moderators
		await expect(inviteePage.getByText('Invite Flow Gift')).toBeVisible({ timeout: 5_000 });
		await expect(inviteePage.getByRole('button', { name: /Moderátoři/ })).not.toBeVisible();

		// ── Step 3: anonymous visitor reserves the gift ───────────────────────
		const anonymousContext = await browser.newContext();
		const anonymousPage = await anonymousContext.newPage();
		await anonymousPage.goto(wishlistPath);
		await anonymousPage.waitForLoadState('networkidle');

		await anonymousPage
			.getByRole('button', { name: /Rezervovat/ })
			.first()
			.click();
		const reserveDialog = anonymousPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible({ timeout: 5_000 });
		await reserveDialog.getByRole('textbox', { name: /Vaše jméno/i }).fill('Anon Reserver');
		await reserveDialog.getByRole('button', { name: /Rezervovat/ }).click();
		await expect(anonymousPage.getByText(/Rezervov[aá]no/).first()).toBeVisible({
			timeout: 5_000,
		});
		await anonymousContext.close();

		// ── Step 4: moderator can see the reservation status ──────────────────
		await inviteePage.reload();
		await inviteePage.waitForLoadState('networkidle');
		// As a moderator, gift shows as reserved
		await expect(inviteePage.getByText(/Rezervov[aá]no/).first()).toBeVisible({
			timeout: 5_000,
		});

		await inviteeContext.close();
		await ownerPage.context().close();
	});

	test('owner self-promote shows permanent disclosure banner', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('mod-self-promote');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Self Promote Test');

		// Share wishlist so the banner section is meaningful
		await shareWishlist(page);

		// Open moderator panel
		const panel = await openModeratorPanel(page);

		// "Aktivovat zobrazení" button is in the self-promote section
		await expect(panel.getByRole('button', { name: /Aktivovat zobrazení/ })).toBeVisible({
			timeout: 5_000,
		});
		await panel.getByRole('button', { name: /Aktivovat zobrazení/ }).click();

		// The panel updates in place (it does not close): the self-promote button is
		// replaced by the permanent active-disclosure text.
		await expect(panel.getByText(/Vidíte stav rezervací/)).toBeVisible({ timeout: 5_000 });
		await expect(panel.getByRole('button', { name: /Aktivovat zobrazení/ })).not.toBeVisible();

		// Close the panel and confirm the permanent disclosure banner on the wishlist header
		// (rendered when ownerIsModerator is true).
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0, {
			timeout: 5_000,
		});
		await page.waitForLoadState('networkidle');
		await expect(page.getByText(/Vlastník vidí stav rezervací/)).toBeVisible({
			timeout: 5_000,
		});

		await page.context().close();
	});
});
