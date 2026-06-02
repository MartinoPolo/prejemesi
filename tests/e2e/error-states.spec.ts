import { test, expect, type Page } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import { registerViaApi, registerAndGetPage } from './fixtures/auth-helpers.js';

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

async function addGift(page: Page, giftName: string) {
	await page
		.getByRole('button', { name: /Pridat/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('textbox', { name: /Nazev/i }).fill(giftName);
	await dialog.getByRole('button', { name: 'Pridat darek' }).click();
	await expect(page.getByText(giftName)).toBeVisible({ timeout: 10_000 });
}

async function shareWishlist(page: Page) {
	await page
		.getByRole('button', { name: /Sdilet seznam/ })
		.first()
		.click();
	const shareDialog = page.getByRole('dialog');
	await expect(shareDialog).toBeVisible({ timeout: 5_000 });
	await shareDialog.getByRole('button', { name: 'Sdilet seznam' }).click();
	await expect(shareDialog.getByText('Seznam byl sdilen!')).toBeVisible({ timeout: 5_000 });
	await shareDialog.getByRole('button', { name: 'Hotovo' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('Error states and edge cases', () => {
	test('registering with existing email shows error', async ({ request, baseURL, page }) => {
		const user = createTestUser('dup-reg');

		// Register the user via API first
		await registerViaApi(request, baseURL!, user);

		// Now attempt to register again with the same email via the UI
		await page.goto('/register');
		await page.waitForLoadState('networkidle');

		await page.getByRole('textbox', { name: /Jméno/i }).fill(user.name);
		await page.getByLabel(/E-mail/i).fill(user.email);
		await page.getByRole('textbox', { name: /Heslo/i }).fill(user.password);
		await page.getByRole('button', { name: 'Vytvořit účet' }).click();

		await expect(
			page.getByText('Účet s tímto emailem již existuje. Zkuste se přihlásit.'),
		).toBeVisible({ timeout: 10_000 });
	});

	test('owner does not see reserve button on own wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('owner-no-reserve');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Owner Reserve Guard Test');
		await addGift(page, TEST_GIFT.name);
		await shareWishlist(page);

		// After sharing, owner must NOT see a reserve button for their own gift
		await expect(page.getByRole('button', { name: /Rezervovat/ })).not.toBeVisible();

		await page.context().close();
	});

	test('owner can add new gift after sharing but cannot edit existing', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('owner-edit-lock');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Edit Lock Test');
		await addGift(page, 'Original');
		await shareWishlist(page);

		// Can still add a new gift after sharing
		await addGift(page, 'New Gift');
		await expect(page.getByText('New Gift')).toBeVisible({ timeout: 5_000 });

		// After sharing, existing gifts must have no edit affordance for the owner
		await expect(
			page.getByRole('button', { name: /[Uu]pravit|[Ee]dit/ }).first(),
		).not.toBeVisible();

		await page.context().close();
	});

	test('settings page shows user profile', async ({ browser, request, baseURL }) => {
		const user = createTestUser('settings-view');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/settings');
		await page.waitForLoadState('networkidle');

		// Page heading
		await expect(page.getByRole('heading', { name: 'Nastavení' })).toBeVisible({
			timeout: 5_000,
		});

		// Name is pre-populated in the display name input
		await expect(page.getByLabel('Zobrazované jméno')).toHaveValue(user.name, {
			timeout: 5_000,
		});

		// Email is shown in the email input
		await expect(page.getByLabel('E-mail')).toHaveValue(user.email, { timeout: 5_000 });

		await page.context().close();
	});

	test('user can update their name in settings', async ({ browser, request, baseURL }) => {
		const user = createTestUser('settings-update');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		const updatedName = `${user.name} Updated`;

		await page.goto('/settings');
		await page.waitForLoadState('networkidle');

		const nameInput = page.getByLabel('Zobrazované jméno');
		await expect(nameInput).toBeVisible({ timeout: 5_000 });
		await nameInput.clear();
		await nameInput.fill(updatedName);

		await page.getByRole('button', { name: 'Uložit profil' }).click();

		// Wait for save confirmation
		await expect(page.getByRole('button', { name: /Uloženo/ })).toBeVisible({ timeout: 5_000 });

		// Reload and verify the name persisted
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.getByLabel('Zobrazované jméno')).toHaveValue(updatedName, {
			timeout: 5_000,
		});

		await page.context().close();
	});
});
