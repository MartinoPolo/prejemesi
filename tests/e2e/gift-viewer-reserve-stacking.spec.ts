import { test, expect, type Locator } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage, waitForAppHydration } from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	shareWishlist,
	waitForDialogMotionToSettle,
} from './fixtures/wishlist-helpers.js';

const GIFT_NAME = 'Darek pro vrstveni rezervace';

const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

const VIEWPORTS = [
	{ label: 'desktop', viewport: DESKTOP_VIEWPORT },
	{ label: 'mobile', viewport: { width: 390, height: 844 } },
] as const;

async function topmostElementIsInside(layer: Locator): Promise<boolean> {
	return layer.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		const topmost = document.elementFromPoint(
			bounds.left + bounds.width / 2,
			bounds.top + bounds.height / 2,
		);
		return topmost !== null && element.contains(topmost);
	});
}

for (const { label, viewport } of VIEWPORTS) {
	test.describe(`Gift viewer reservation stacking (${label})`, () => {
		test.use({ viewport });

		test('the reservation form opens above the Gift viewer', async ({
			browser,
			request,
			baseURL,
		}) => {
			const owner = createTestUser(`viewer-reserve-owner-${label}`);
			const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
			await ownerPage.setViewportSize(DESKTOP_VIEWPORT);
			await createWishlistAndNavigate(ownerPage, `Viewer reserve stacking ${label}`);
			await addGift(ownerPage, GIFT_NAME);
			await shareWishlist(ownerPage);
			const wishlistPath = new URL(ownerPage.url()).pathname;
			await ownerPage.context().close();

			const visitor = createTestUser(`viewer-reserve-visitor-${label}`);
			const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
			await visitorPage.setViewportSize(viewport);
			await visitorPage.goto(wishlistPath);
			await waitForAppHydration(visitorPage);
			await visitorPage.getByRole('heading', { name: GIFT_NAME, level: 3 }).click();

			const viewer = visitorPage.getByTestId('gift-viewer');
			await expect(viewer).toBeVisible({ timeout: 5_000 });
			await viewer.getByTestId('reserve-button').click();

			const reserveForm = visitorPage.getByRole('dialog', { name: 'Rezervovat dárek' });
			await expect(reserveForm).toBeVisible({ timeout: 5_000 });
			await waitForDialogMotionToSettle(reserveForm);

			expect(await topmostElementIsInside(reserveForm)).toBe(true);
			// A real click fails its actionability check when another layer intercepts it.
			await reserveForm.getByRole('button', { name: 'Zrušit' }).click({ timeout: 5_000 });
			await expect(reserveForm).not.toBeVisible({ timeout: 5_000 });
			await expect(viewer).toBeVisible();

			await visitorPage.context().close();
		});
	});
}
