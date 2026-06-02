import { test, expect, type Page } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

async function createWishlistAndNavigate(page: Page, title: string) {
	await page.goto('/my-lists');
	await page.waitForLoadState('networkidle');
	await page
		.getByRole('button', { name: /Vytvořit/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('textbox', { name: 'Nazev' }).fill(title);
	await dialog.getByRole('button', { name: 'Vytvorit' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	await page.waitForLoadState('networkidle');
}

async function addGift(page: Page, name: string) {
	await page
		.getByRole('button', { name: /Pridat/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('textbox', { name: /Nazev/i }).fill(name);
	await dialog.getByRole('button', { name: 'Pridat darek' }).click();
	await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
}

async function shareWishlist(page: Page) {
	await page
		.getByRole('button', { name: /Sdilet seznam/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('button', { name: 'Sdilet seznam' }).click();
	await expect(dialog.getByText('Seznam byl sdilen!')).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('button', { name: 'Hotovo' }).click();
	await page.waitForLoadState('networkidle');
}

// ── Gift editing (issue #9) ───────────────────────────────────────────────────

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

		// Open the gift detail modal by clicking the gift card
		await page.getByText(TEST_GIFT.name).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		// The modal should be in edit mode — change the name
		const updatedGiftName = 'Upraveny darek';
		const nameInput = dialog.getByRole('textbox', { name: /Nazev/i });
		await nameInput.clear();
		await nameInput.fill(updatedGiftName);

		// Save — button reads "Uložit" in edit mode
		await dialog.getByRole('button', { name: /Uložit|Ulozit|Save/i }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// The updated name should now appear on the page
		await expect(page.getByText(updatedGiftName)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(TEST_GIFT.name)).not.toBeVisible();

		await page.context().close();
	});
});

// ── Gift deletion (issue #9) ──────────────────────────────────────────────────

test.describe('Gift deletion', () => {
	test('owner can delete a gift on unshared wishlist', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gift-delete');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Delete Gift Test');
		await addGift(page, TEST_GIFT.name);

		// Open the gift detail modal
		await page.getByText(TEST_GIFT.name).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		// First click shows confirmation, second click confirms deletion
		await dialog.getByRole('button', { name: /Smazat/i }).click();
		await dialog.getByRole('button', { name: /Opravdu smazat/i }).click();

		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Gift should be gone from the list
		await expect(page.getByText(TEST_GIFT.name)).not.toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});

// ── Edit lock after sharing (issue #12) ──────────────────────────────────────

test.describe('Edit lock after sharing', () => {
	test('owner cannot edit existing gifts after sharing', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-lock');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Share Lock Test');
		await addGift(page, TEST_GIFT.name);

		// Share the wishlist — this locks pre-existing gifts
		await shareWishlist(page);

		// The shared banner should appear
		await expect(
			page.getByText(/Seznam je sdílený — stávající přání nelze upravovat/i),
		).toBeVisible({ timeout: 5_000 });

		// Click the existing (pre-share) gift — the edit modal should still open
		// but there should be no save / edit capability: the modal is read-only or no submit button
		await page.getByText(TEST_GIFT.name).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		// The "Uložit" submit button should not be present (gift is locked)
		await expect(dialog.getByRole('button', { name: /Uložit|Ulozit/i })).not.toBeVisible();

		await dialog.getByRole('button', { name: /Close|Zavřít|Zavrit/i }).click();

		// Owner CAN still add new gifts after sharing
		await addGift(page, 'Novy darek po sdileni');

		await page.context().close();
	});
});

// ── Wishlist archival (issue #6) ──────────────────────────────────────────────

test.describe('Wishlist archival', () => {
	test('owner can archive a wishlist', async ({ browser, request, baseURL }) => {
		const user = createTestUser('archive-owner');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Archive Test');
		await addGift(page, TEST_GIFT.name);
		await shareWishlist(page);

		// Click the "Archivovat" button in the header action row
		page.on('dialog', (nativeDialog) => void nativeDialog.accept());
		await page
			.getByRole('button', { name: /Archivovat seznam|Archivovat/i })
			.first()
			.click();

		// The archived banner should appear
		await expect(page.getByText(/Archivováno — seznam je uzavřen/i)).toBeVisible({
			timeout: 10_000,
		});

		await page.context().close();
	});

	test('archived wishlist is read-only for visitors', async ({ browser, request, baseURL }) => {
		// Set up owner and create+share wishlist
		const ownerUser = createTestUser('archive-owner2');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, ownerUser);

		await createWishlistAndNavigate(ownerPage, 'Visitor Archive Test');
		await addGift(ownerPage, TEST_GIFT.name);
		await shareWishlist(ownerPage);

		// Capture the wishlist URL before archiving
		const wishlistPath = new URL(ownerPage.url()).pathname;

		// Archive the wishlist
		ownerPage.on('dialog', (nativeDialog) => void nativeDialog.accept());
		await ownerPage
			.getByRole('button', { name: /Archivovat seznam|Archivovat/i })
			.first()
			.click();
		await expect(ownerPage.getByText(/Archivováno — seznam je uzavřen/i)).toBeVisible({
			timeout: 10_000,
		});

		// Create a new visitor and visit the archived wishlist
		const visitorUser = createTestUser('archive-visitor');
		const visitorCookies = await registerViaApi(request, baseURL!, visitorUser);
		const visitorContext = await createAuthenticatedContext(browser, visitorCookies, baseURL!);
		const visitorPage = await visitorContext.newPage();

		await visitorPage.goto(wishlistPath);
		await visitorPage.waitForLoadState('networkidle');

		// The gift should be visible
		await expect(visitorPage.getByText(TEST_GIFT.name)).toBeVisible({ timeout: 10_000 });

		// The "Rezervovat" button should be hidden on an archived list
		await expect(visitorPage.getByRole('button', { name: /Rezervovat/ })).not.toBeVisible();

		await visitorContext.close();
		await ownerPage.context().close();
	});
});
