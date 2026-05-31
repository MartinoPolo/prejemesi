import { test, expect } from '@playwright/test';
import { createTestUser, TEST_GIFT, ANONYMOUS_RESERVER } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

test.describe('Full flow: register → wishlist → gift → share → reserve', () => {
	test('complete wishlist lifecycle', async ({ browser, request, baseURL }) => {
		const user = createTestUser('fullflow');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		// Navigate to dashboard
		await page.goto('/my-lists');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();

		// Create wishlist
		await page.getByRole('button', { name: /Vytvořit seznam/ }).click();
		const createDialog = page.getByRole('dialog');
		await expect(createDialog).toBeVisible();
		await createDialog.getByRole('textbox', { name: 'Nazev' }).fill('Narozeniny');
		await createDialog.getByRole('button', { name: 'Vytvorit' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Narozeniny' })).toBeVisible();
		await page.waitForLoadState('networkidle');

		// Add gift
		await page
			.getByRole('button', { name: /Pridat/ })
			.first()
			.click();
		const giftDialog = page.getByRole('dialog');
		await expect(giftDialog).toBeVisible();
		await giftDialog.getByRole('textbox', { name: /Nazev/i }).fill(TEST_GIFT.name);
		await giftDialog.getByRole('button', { name: 'Pridat darek' }).click();
		await expect(page.getByText(TEST_GIFT.name)).toBeVisible();

		// Share
		await page
			.getByRole('button', { name: /Sdilet seznam/ })
			.first()
			.click();
		const shareDialog = page.getByRole('dialog');
		await expect(shareDialog).toBeVisible();
		await shareDialog.getByRole('button', { name: 'Sdilet seznam' }).click();
		await expect(shareDialog.getByText('Seznam byl sdilen!')).toBeVisible();
		await shareDialog.getByRole('button', { name: 'Hotovo' }).click();

		// Visit as anonymous and reserve
		const wishlistPath = new URL(page.url()).pathname;
		const anonymousContext = await browser.newContext();
		const visitorPage = await anonymousContext.newPage();
		await visitorPage.goto(wishlistPath);
		await visitorPage.waitForLoadState('networkidle');
		await expect(visitorPage.getByText(TEST_GIFT.name)).toBeVisible();
		await visitorPage
			.getByRole('button', { name: /Rezervovat/ })
			.first()
			.click();

		const reserveDialog = visitorPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible();
		await reserveDialog
			.getByRole('textbox', { name: /[Jj]meno|[Nn]ame/ })
			.fill(ANONYMOUS_RESERVER.name);
		await reserveDialog.getByRole('button', { name: /Rezervovat/ }).click();
		await expect(visitorPage.getByText(/[Rr]ezervov/).first()).toBeVisible();

		await anonymousContext.close();
		await page.context().close();
	});
});
