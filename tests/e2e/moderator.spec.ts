import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	createWishlistForSomeoneAndNavigate,
	shareWishlist,
	openModeratorPanel,
	generateInviteLink,
} from './fixtures/wishlist-helpers.js';

test.describe('Moderator system', () => {
	test('another user can accept a manager invite and use the Správci capability', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('mod-owner-flow');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistForSomeoneAndNavigate(ownerPage, {
			title: 'Mod Invite Flow Test',
			recipientName: 'Invite Recipient',
		});
		const wishlistPath = new URL(ownerPage.url()).pathname;
		const inviteUrl = await generateInviteLink(ownerPage);
		await ownerPage.keyboard.press('Escape');

		const invitee = createTestUser('mod-invitee');
		const inviteeCookies = await registerViaApi(request, baseURL!, invitee);
		const inviteeContext = await createAuthenticatedContext(browser, inviteeCookies, baseURL!);
		const inviteePage = await inviteeContext.newPage();
		await inviteePage.goto(new URL(inviteUrl).pathname);

		const acceptButton = inviteePage.getByRole('button', { name: /Přijmout pozvánku/ });
		await expect(acceptButton).toBeVisible({ timeout: 5_000 });
		await acceptButton.click();
		await inviteePage.waitForURL(`**${wishlistPath}`, { timeout: 10_000 });

		// The invitee is neither the linked recipient nor the creator. Reaching the Správci
		// management surface proves the accepted invite granted the manager capability.
		const panel = await openModeratorPanel(inviteePage);
		await expect(panel).toBeVisible();
		await expect(
			panel.getByRole('button', { name: /Generovat pozvánku|Generate invite/ }),
		).toBeVisible();

		await inviteeContext.close();
		await ownerPage.context().close();
	});

	test('recipient self-promote shows in-panel disclosure and the loud visitor trust warning', async ({
		browser,
		request,
		baseURL,
	}) => {
		// A linked recipient (for-me list) self-promotes to also see reservation state.
		// Anime-sky redesign (#102, REQ-13): the bespoke purple header strip is gone. The
		// recipient's own confirmation is the permanent in-panel active disclosure; the
		// visitor-facing notice becomes the loud accent trust warning Alert (shown to any
		// viewer who is NOT the recipient), which is the notice visitors must not miss.
		const recipient = createTestUser('mod-self-promote');
		const page = await registerAndGetPage(browser, request, baseURL!, recipient);

		const wishlistPath = await createWishlistAndNavigate(page, 'Self Promote Test');

		// Share wishlist so the disclosure is meaningful
		await shareWishlist(page);

		// Open the správci panel
		const panel = await openModeratorPanel(page);

		// „Aktivovat zobrazení" / „Activate visibility" button is in the self-promote section
		await expect(
			panel.getByRole('button', { name: /Aktivovat zobrazení|Activate visibility/ }),
		).toBeVisible({ timeout: 5_000 });
		await panel
			.getByRole('button', { name: /Aktivovat zobrazení|Activate visibility/ })
			.click();

		// The panel updates in place (it does not close): the self-promote button is replaced by
		// the permanent active-disclosure text (moderator_active_disclosure). This is the
		// recipient's permanent disclosure now that the header strip is removed.
		await expect(
			panel.getByText(/Vidíte stav rezervací|You can see reservation status/),
		).toBeVisible({ timeout: 5_000 });
		await expect(
			panel.getByRole('button', { name: /Aktivovat zobrazení|Activate visibility/ }),
		).not.toBeVisible();

		await page.context().close();

		// A separate visitor to the shared list sees the loud trust warning (REQ-13): the
		// recipient is also a manager and can see reservations. Shown for any non-recipient
		// viewer; the recipient themselves never sees this header alert.
		const visitorUser = createTestUser('self-promote-visitor');
		const visitorCookies = await registerViaApi(request, baseURL!, visitorUser);
		const visitorContext = await createAuthenticatedContext(browser, visitorCookies, baseURL!);
		const visitorPage = await visitorContext.newPage();

		await visitorPage.goto(wishlistPath);
		await expect(
			visitorPage.getByText(
				new RegExp(`${recipient.name}.*(zároveň správcem|is also a manager)`),
			),
		).toBeVisible({ timeout: 10_000 });

		await visitorContext.close();
	});

	test('recipient rename via the header pencil reflects in the wishlist banner without reload', async ({
		browser,
		request,
		baseURL,
	}) => {
		// Issue #150 relocated recipient editing out of the správci panel: the header „Pro: {name}"
		// pencil opens the shared EditRecipientDialog (rename mode on free-text lists). Regression
		// (issue #119): the page banner (data-testid="wishlist-banner", driven by the page-local
		// getWishlistByShortId query) must update in place — the old panel save never refreshed it.
		const manager = createTestUser('recipient-rename-header');
		const page = await registerAndGetPage(browser, request, baseURL!, manager);

		await createWishlistForSomeoneAndNavigate(page, {
			title: 'Recipient Rename Test',
			recipientName: 'Rosie',
		});

		const banner = page.getByTestId('wishlist-banner');
		await expect(banner).toContainText('Rosie');

		// Open the header recipient-edit pencil → shared dialog (rename mode on free-text lists).
		await page.getByTestId('edit-recipient-button').click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		const recipientInput = dialog.getByLabel(/Jméno obdarovaného|Recipient name/);
		await expect(recipientInput).toHaveValue('Rosie');
		await recipientInput.fill('Rosalie');
		await dialog.getByRole('button', { name: /Uložit jméno|Save name/ }).click();

		await expect(
			page.getByText(/Jméno obdarovaného bylo změněno|Recipient name updated/),
		).toBeVisible({
			timeout: 5_000,
		});

		// No page.reload() – the banner must update from the refreshed query alone.
		await expect(banner).toContainText('Rosalie', { timeout: 5_000 });
		await expect(banner).not.toContainText('Rosie po');

		await page.context().close();
	});
});
