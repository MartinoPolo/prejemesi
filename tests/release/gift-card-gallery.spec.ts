import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from '../e2e/fixtures/auth-helpers.js';
import { SEED_PASSWORD } from '../../src/lib/server/db/seed_credentials.js';

// Read-only browsing of seeded gifts: the eight-image PS5, the three-image jacket and a
// single-image book. Display preferences live in localStorage, so seeded data stays untouched.
const SEED_WISHLIST_ID = 'seed-wl-xmas26';
const EIGHT_IMAGE_GIFT_ID = 'seed-g-ps5';
const THREE_IMAGE_GIFT_ID = 'seed-g-bunda';
const SINGLE_IMAGE_GIFT_ID = 'seed-g-sapiens';
const EIGHT_IMAGE_GIFT_NAME = 'PlayStation 5';

test.use({ viewport: { width: 1280, height: 900 } });

async function openSeedWishlistAsVisitor(page: Page, viewMode: 'card' | 'list'): Promise<void> {
	const baseURL = test.info().project.use.baseURL!;
	const cookies = await loginViaApi(page.request, baseURL, {
		email: 'petr@test.cz',
		password: SEED_PASSWORD,
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.addInitScript(
		({ wishlistId, mode }) => {
			localStorage.setItem('prejemesi-gift-view-mode', JSON.stringify(mode));
			localStorage.setItem(
				`prejemesi-wishlist:${wishlistId}:gift-grouping`,
				JSON.stringify('none'),
			);
		},
		{ wishlistId: SEED_WISHLIST_ID, mode: viewMode },
	);
	await page.goto('/w/xmas2026', { waitUntil: 'domcontentloaded' });
	await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();
	await waitForAppHydration(page);
	await expect(giftItem(page, EIGHT_IMAGE_GIFT_ID)).toBeVisible();
}

function giftItem(page: Page, giftId: string): Locator {
	return page.locator(`[data-gift-item][data-gift-id="${giftId}"]`);
}

function currentSlide(card: Locator): Promise<string | null> {
	return card.locator('[data-gallery-slide][data-current]').getAttribute('data-gallery-slide');
}

test.describe('Gift image gallery (issue #591)', () => {
	test('card arrows browse in place and the viewer opens on the browsed image', async ({
		page,
	}) => {
		await openSeedWishlistAsVisitor(page, 'card');
		const card = giftItem(page, EIGHT_IMAGE_GIFT_ID);
		const indicator = card.getByTestId('gift-gallery-indicator');
		await expect(indicator).toHaveAttribute('data-kind', 'counter');
		await expect(indicator).toContainText('1/8');
		await expect(
			giftItem(page, THREE_IMAGE_GIFT_ID).getByTestId('gift-gallery-indicator'),
		).toHaveAttribute('data-kind', 'dots');

		const next = card.getByTestId('gift-card-gallery-next');
		const previous = card.getByTestId('gift-card-gallery-previous');
		await card.hover();
		await expect(next).toBeVisible();
		await next.click();
		await next.click();
		await expect.poll(() => currentSlide(card)).toBe('2');
		await expect(indicator).toContainText('3/8');
		await previous.click();
		await previous.click();
		await previous.click();
		await expect.poll(() => currentSlide(card)).toBe('7');
		await expect(indicator).toContainText('8/8');
		await expect(page.getByRole('dialog')).toHaveCount(0);

		await card.getByRole('heading', { name: EIGHT_IMAGE_GIFT_NAME }).click();
		const viewer = page.getByRole('dialog');
		await expect(viewer).toBeVisible();
		const photo = viewer.getByTestId('gift-viewer-photo');
		await expect(photo).toHaveAttribute('data-gallery-index', '7');
		await expect(viewer.getByTestId('gift-viewer-thumbnail').nth(7)).toHaveAttribute(
			'aria-current',
			'true',
		);
		await page.keyboard.press('ArrowRight');
		await expect(photo).toHaveAttribute('data-gallery-index', '0');
		await page.keyboard.press('ArrowLeft');
		await expect(photo).toHaveAttribute('data-gallery-index', '7');

		const singleImageCard = giftItem(page, SINGLE_IMAGE_GIFT_ID);
		await expect(singleImageCard.getByTestId('gift-gallery-indicator')).toHaveCount(0);
		await expect(singleImageCard.getByTestId('gift-card-gallery-next')).toHaveCount(0);
	});

	test('list rows count the images after the cover', async ({ page }) => {
		await openSeedWishlistAsVisitor(page, 'list');

		await expect(
			giftItem(page, EIGHT_IMAGE_GIFT_ID).getByTestId('gift-gallery-count-chip'),
		).toContainText('+7');
		await expect(
			giftItem(page, THREE_IMAGE_GIFT_ID).getByTestId('gift-gallery-count-chip'),
		).toContainText('+2');
		await expect(
			giftItem(page, SINGLE_IMAGE_GIFT_ID).getByTestId('gift-gallery-count-chip'),
		).toHaveCount(0);
		await expect(
			giftItem(page, EIGHT_IMAGE_GIFT_ID).getByTestId('gift-card-gallery-next'),
		).toHaveCount(0);
	});
});
