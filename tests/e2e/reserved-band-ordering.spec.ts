import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';

/**
 * Role-aware reserved-gift ordering (issue #224).
 *
 * The visitor/gifter view splits gifts into bands: the viewer's own reservations pin to the top
 * under „Vaše rezervace", available gifts follow, and foreign fully-reserved gifts sink to the
 * bottom. The recipient sees no reservation data, so the same fixture must retain owner order.
 *
 * Ordering is asserted in LIST view (single column) so a card's vertical position is a faithful
 * proxy for its render order — the card grid is multi-column, where same-row cards share a `y`.
 */

const OWN_BAND_HEADER = /Vaše rezervace|Your reservations/;
const OTHER_BAND_HEADER = /Ostatní dárky|Other gifts/;

async function switchToListView(page: Page): Promise<void> {
	const listViewRadio = page.getByRole('radio', { name: /Seznam|List/ });
	await listViewRadio.click();
	await expect(listViewRadio).toBeChecked();
	await expect(
		page.locator('[data-wishlist-gift-collection][data-view-mode=list]'),
	).toBeVisible();
}

async function reserveGiftByName(page: Page, name: string): Promise<void> {
	const item = page.locator('[data-gift-item]', { hasText: name });
	await item.getByTestId('reserve-button').first().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await dialog.getByRole('button', { name: /Rezervovat|Reserve/ }).click();
	await expect(dialog).not.toBeVisible({ timeout: 10_000 });
	await expect(
		item.getByRole('button', { name: /Zrušit rezervaci|Cancel reservation/ }),
	).toBeVisible({ timeout: 10_000 });
}

async function giftTop(page: Page, name: string): Promise<number> {
	const box = await page.getByRole('heading', { name, level: 3 }).first().boundingBox();
	if (box === null) {
		throw new Error(`Gift "${name}" not found on page`);
	}
	return box.y;
}

test.describe('Reserved-band ordering (issue #224)', () => {
	test('gifter gets reservation bands while the recipient retains owner order', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('band-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'Band Ordering List');
		await addGift(ownerPage, 'Alpha Gift');
		await addGift(ownerPage, 'Bravo Gift');
		await addGift(ownerPage, 'Charlie Gift');
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;

		const foreigner = createTestUser('band-foreigner');
		const foreignerPage = await registerAndGetPage(browser, request, baseURL!, foreigner);
		await foreignerPage.goto(wishlistPath);
		await expect(
			foreignerPage.getByRole('heading', { name: 'Alpha Gift', level: 3 }),
		).toBeVisible();
		await reserveGiftByName(foreignerPage, 'Alpha Gift');
		await foreignerPage.context().close();

		const gifter = createTestUser('band-gifter');
		const gifterPage = await registerAndGetPage(browser, request, baseURL!, gifter);
		await gifterPage.goto(wishlistPath);
		await expect(
			gifterPage.getByRole('heading', { name: 'Bravo Gift', level: 3 }),
		).toBeVisible();
		await reserveGiftByName(gifterPage, 'Bravo Gift');

		await gifterPage.reload();
		await expect(
			gifterPage.getByRole('heading', { name: 'Bravo Gift', level: 3 }),
		).toBeVisible();
		await switchToListView(gifterPage);

		await expect(gifterPage.getByText(OWN_BAND_HEADER)).toBeVisible({ timeout: 10_000 });
		await expect(gifterPage.getByText(OTHER_BAND_HEADER)).toBeVisible({ timeout: 10_000 });
		const headerBox = await gifterPage.getByText(OWN_BAND_HEADER).first().boundingBox();
		const otherHeaderBox = await gifterPage.getByText(OTHER_BAND_HEADER).first().boundingBox();
		const headerY = headerBox?.y ?? Infinity;
		const otherHeaderY = otherHeaderBox?.y ?? Infinity;
		const bravoY = await giftTop(gifterPage, 'Bravo Gift');
		const charlieY = await giftTop(gifterPage, 'Charlie Gift');
		const alphaY = await giftTop(gifterPage, 'Alpha Gift');

		expect(headerY).toBeLessThan(bravoY);
		expect(bravoY).toBeLessThan(charlieY);
		await expect(gifterPage.getByRole('heading', { name: 'Bravo Gift', level: 3 })).toHaveCount(
			1,
		);
		expect(otherHeaderY).toBeGreaterThan(bravoY);
		expect(otherHeaderY).toBeLessThan(charlieY);
		expect(alphaY).toBeGreaterThan(charlieY);

		await ownerPage.goto(wishlistPath);
		await expect(
			ownerPage.getByRole('heading', { name: 'Alpha Gift', level: 3 }),
		).toBeVisible();
		await switchToListView(ownerPage);
		await expect(ownerPage.getByText(OWN_BAND_HEADER)).toHaveCount(0);
		await expect(ownerPage.getByText(OTHER_BAND_HEADER)).toHaveCount(0);
		const ownerAlphaY = await giftTop(ownerPage, 'Alpha Gift');
		const ownerBravoY = await giftTop(ownerPage, 'Bravo Gift');
		const ownerCharlieY = await giftTop(ownerPage, 'Charlie Gift');
		expect(ownerAlphaY).toBeLessThan(ownerBravoY);
		expect(ownerBravoY).toBeLessThan(ownerCharlieY);

		await gifterPage.context().close();
		await ownerPage.context().close();
	});
});
