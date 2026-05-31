import { test, expect } from '@playwright/test';
import { createTestUser, TEST_GIFT, ANONYMOUS_RESERVER } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

test.describe('Owner cannot see reservation state', () => {
	test('owner view hides reservation info after visitor reserves', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('owner-norsvp');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		// Create wishlist and add gift
		await ownerPage.goto('/my-lists');
		await ownerPage.waitForLoadState('networkidle');
		await expect(ownerPage.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
		await ownerPage
			.getByRole('button', { name: /Vytvořit/ })
			.first()
			.click();
		const createDialog = ownerPage.getByRole('dialog');
		await expect(createDialog).toBeVisible({ timeout: 10_000 });
		await createDialog.getByRole('textbox', { name: 'Nazev' }).fill('Tajny seznam');
		await createDialog.getByRole('button', { name: 'Vytvorit' }).click();
		await expect(ownerPage.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
		await ownerPage.waitForLoadState('networkidle');

		await ownerPage
			.getByRole('button', { name: /Pridat/ })
			.first()
			.click();
		const giftDialog = ownerPage.getByRole('dialog');
		await expect(giftDialog).toBeVisible({ timeout: 5_000 });
		await giftDialog.getByRole('textbox', { name: /Nazev/i }).fill(TEST_GIFT.name);
		await giftDialog.getByRole('button', { name: 'Pridat darek' }).click();
		await expect(ownerPage.getByText(TEST_GIFT.name)).toBeVisible({ timeout: 5_000 });

		// Share the wishlist
		await ownerPage
			.getByRole('button', { name: /Sdilet seznam/ })
			.first()
			.click();
		const shareDialog = ownerPage.getByRole('dialog');
		await expect(shareDialog).toBeVisible({ timeout: 5_000 });
		await shareDialog.getByRole('button', { name: 'Sdilet seznam' }).click();
		await expect(shareDialog.getByText('Seznam byl sdilen!')).toBeVisible({ timeout: 5_000 });
		await shareDialog.getByRole('button', { name: 'Hotovo' }).click();

		const wishlistPath = new URL(ownerPage.url()).pathname;

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
			.getByRole('textbox', { name: /[Jj]meno|[Nn]ame/ })
			.fill(ANONYMOUS_RESERVER.name);
		await reserveDialog.getByRole('button', { name: /Rezervovat/ }).click();
		await expect(visitorPage.getByText(/[Rr]ezervov/).first()).toBeVisible({ timeout: 5_000 });
		await visitorContext.close();

		// Owner reloads and must NOT see reservation info
		await ownerPage.reload();
		await expect(ownerPage.getByText(TEST_GIFT.name)).toBeVisible();

		// Owner should NOT see "Rezervovano" badge
		await expect(ownerPage.getByText(/Rezervov[aá]no/)).not.toBeVisible();

		// Owner should NOT see "Rezervovat" button (owners can't reserve their own gifts)
		await expect(ownerPage.getByRole('button', { name: /Rezervovat/ })).not.toBeVisible();

		await ownerPage.context().close();
	});
});
