import { test, expect, type Browser, type Page } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { ANONYMOUS_RESERVER, createTestUser } from './fixtures/test-data.js';
import {
	addGift,
	createWishlistAndNavigate,
	createWishlistForSomeoneAndNavigate,
	shareWishlist,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';

const SHARED_GIFT_NAME = 'Spolecna stavebnice';
const RECIPIENT_LIST_TITLE = 'Moje narozeniny';
const OTHER_LIST_TITLE = 'Pro Miminko';

async function openAnonymousPage(browser: Browser, wishlistPath: string): Promise<Page> {
	const page = await (await browser.newContext()).newPage();
	await page.goto(wishlistPath);
	await expect(page.getByRole('heading', { name: SHARED_GIFT_NAME, level: 3 })).toBeVisible();
	return page;
}

async function expectSharedWithoutReservationState(page: Page, wishlistPath: string) {
	await page.goto(wishlistPath);
	await expect(page.getByRole('heading', { name: SHARED_GIFT_NAME, level: 3 })).toBeVisible();
	await expect(page.getByRole('heading', { name: m.gift_band_shared(), level: 2 })).toBeVisible();
	await expect(page.locator('[data-slot="gift-shared-badge"]').first()).toBeVisible();
	// A manager would read the reserver's name here; the recipient reads nothing at all.
	await expect(page.getByText(/Rezervov|Zarezervov/)).toHaveCount(0);
	for (const reservationState of ['gift-state-overlay', 'gift-reserved-veil', 'reserve-button']) {
		await expect(page.getByTestId(reservationState)).toHaveCount(0);
	}
}

/**
 * Issue #737: one gift shared between the lists of two recipients is reserved once for both
 * lists, and a recipient never learns its reservation state on any of them, including a list
 * the recipient manages for someone else.
 */
test.describe('Shared gift across wishlists', () => {
	test('a reservation on one list shows on the other, hidden from the recipient', async ({
		browser,
		request,
		baseURL,
	}) => {
		const recipient = createTestUser('shared-gift-recipient');
		const recipientPage = await registerAndGetPage(browser, request, baseURL!, recipient);

		const recipientListPath = await createWishlistAndNavigate(
			recipientPage,
			RECIPIENT_LIST_TITLE,
		);
		await shareWishlist(recipientPage);

		const otherListPath = await createWishlistForSomeoneAndNavigate(recipientPage, {
			title: OTHER_LIST_TITLE,
			recipientName: 'Miminko',
		});
		await addGift(recipientPage, SHARED_GIFT_NAME);
		await shareWishlist(recipientPage);

		// The manager of the other list shares its gift onto the recipient's own list.
		await recipientPage.getByText(SHARED_GIFT_NAME, { exact: true }).first().click();
		const editor = recipientPage.getByRole('dialog');
		const sharedField = editor.getByTestId('gift-shared-field');
		await expect(sharedField).toBeVisible({ timeout: 10_000 });
		await sharedField
			.getByTestId('gift-share-list-row')
			.filter({ hasText: RECIPIENT_LIST_TITLE })
			.click();
		await expect(
			recipientPage.getByText(m.gift_shared_field_added({ title: RECIPIENT_LIST_TITLE })),
		).toBeVisible();
		await recipientPage.keyboard.press('Escape');
		await expect(editor).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(recipientPage);

		const gifterPage = await openAnonymousPage(browser, otherListPath);
		await gifterPage.getByTestId('reserve-button').first().click();
		const reserveDialog = gifterPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible({ timeout: 5_000 });
		await reserveDialog
			.getByRole('textbox', { name: /Vaše jméno/i })
			.fill(ANONYMOUS_RESERVER.name);
		await reserveDialog.getByRole('button', { name: /Rezervovat/ }).click();
		await expect(reserveDialog).toBeHidden();
		await gifterPage.context().close();

		const visitorPage = await openAnonymousPage(browser, recipientListPath);
		await expect(visitorPage.getByText(m.gift_reserved_by_other_overlay())).toBeVisible();
		await expect(visitorPage.getByTestId('reserve-button')).toHaveCount(0);
		await visitorPage.context().close();

		await expectSharedWithoutReservationState(recipientPage, recipientListPath);
		await expectSharedWithoutReservationState(recipientPage, otherListPath);
		await recipientPage.context().close();
	});
});
