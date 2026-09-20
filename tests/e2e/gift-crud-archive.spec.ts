import { test, expect } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	addGift,
	shareWishlist,
	archiveWishlist,
	openDesktopDisplaySubmenu,
} from './fixtures/wishlist-helpers.js';

test.describe('Gift editing', () => {
	test('owner can edit a gift name on unshared wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-edit');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Edit Gift Test');
		await addGift(page, TEST_GIFT.name);
		await page.getByText(TEST_GIFT.name).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		const updatedGiftName = 'Upraveny darek';
		const nameInput = dialog.getByRole('textbox', { name: 'Název' });
		await nameInput.clear();
		await nameInput.fill(updatedGiftName);
		await dialog.getByRole('button', { name: /Uložit|Ulozit|Save/i }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });
		await expect(page.getByText(updatedGiftName)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(TEST_GIFT.name)).not.toBeVisible();

		await page.context().close();
	});

	test('editing a gift preserves its priority on save', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gift-priority');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Priority Persist Test');
		await page
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const createDialog = page.getByRole('dialog');
		await expect(createDialog).toBeVisible({ timeout: 5_000 });
		await createDialog.getByRole('textbox', { name: 'Název' }).fill('Darek s prioritou');
		await createDialog.getByRole('button', { name: 'Bez priority' }).click();
		await page.getByRole('option', { name: 'Vysoká' }).click();
		await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(createDialog).not.toBeVisible({ timeout: 10_000 });

		const groupingMenu = await openDesktopDisplaySubmenu(page, /Seskupení|Grouping/);
		await groupingMenu
			.getByRole('menuitemradio', { name: /Bez seskupení|No grouping/ })
			.click();
		const card = page.getByRole('button', { name: /Darek s prioritou/ });
		await expect(card).toContainText('Vysoká', { timeout: 10_000 });

		await page.getByText('Darek s prioritou').click();
		const editDialog = page.getByRole('dialog');
		await expect(editDialog).toBeVisible({ timeout: 5_000 });
		await expect(editDialog.getByRole('button', { name: 'Vysoká' })).toBeVisible();
		await editDialog.getByRole('button', { name: /^(Uložit|Ulozit|Save)$/ }).click();
		await expect(editDialog).not.toBeVisible({ timeout: 5_000 });
		await expect(card).toContainText('Vysoká', { timeout: 10_000 });

		await page.context().close();
	});
});

test.describe('Gift deletion', () => {
	test('owner can delete a gift on unshared wishlist', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gift-delete');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Delete Gift Test');
		await addGift(page, TEST_GIFT.name);
		await page.getByText(TEST_GIFT.name).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('button', { name: /Smazat/i }).click();
		await dialog.getByRole('button', { name: /Opravdu smazat/i }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });
		await expect(page.getByText(TEST_GIFT.name)).not.toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});

test.describe('Post-share editing rules', () => {
	test('shared list shows status and full gift editing during share grace', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-lock');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Share Lock Test');
		await addGift(page, TEST_GIFT.name);
		await shareWishlist(page);
		await expect(
			page.getByTestId('wishlist-banner').getByText('Sdíleno', { exact: true }),
		).toBeVisible({ timeout: 5_000 });

		await page.getByText(TEST_GIFT.name).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await expect(dialog.getByText(/Právě sdíleno/i)).toBeVisible({ timeout: 5_000 });
		await expect(dialog.locator('#gift-name')).toBeEnabled();

		await page.context().close();
	});
});

test.describe('Wishlist archival', () => {
	test('archived wishlist is read-only for visitors', async ({ browser, request, baseURL }) => {
		const ownerUser = createTestUser('archive-owner2');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, ownerUser);

		await createWishlistAndNavigate(ownerPage, 'Visitor Archive Test');
		await addGift(ownerPage, TEST_GIFT.name);
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await archiveWishlist(ownerPage);
		await expect(ownerPage.getByText(/Archivováno: seznam je uzavřen/i)).toBeVisible({
			timeout: 10_000,
		});

		const visitorUser = createTestUser('archive-visitor');
		const visitorCookies = await registerViaApi(request, baseURL!, visitorUser);
		const visitorContext = await createAuthenticatedContext(browser, visitorCookies, baseURL!);
		const visitorPage = await visitorContext.newPage();
		await visitorPage.goto(wishlistPath);
		await expect(visitorPage.getByText(TEST_GIFT.name)).toBeVisible({ timeout: 10_000 });
		await expect(visitorPage.getByTestId('reserve-button')).not.toBeVisible();

		await visitorContext.close();
		await ownerPage.context().close();
	});
});
