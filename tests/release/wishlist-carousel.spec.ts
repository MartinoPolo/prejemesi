import { expect, test, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from '../e2e/fixtures/auth-helpers.js';
import { startGiftReorder } from '../e2e/fixtures/wishlist-helpers.js';
import * as m from '../../src/lib/paraglide/messages.js';
import { SEED_PASSWORD } from '../../src/lib/server/db/seed_credentials.js';

/** Martin's seeded list; its gifts carry priorities, so Carousel groups them by priority. */
const SEED_WISHLIST_ID = 'seed-wl-xmas26';
const VIEW_MODE_STORAGE_KEY = 'prejemesi-gift-view-mode';
const PAGE_GUTTER = 12;
const CARD_GAP = 8;

function collection(page: Page, viewMode: string) {
	return page.locator(
		`[data-wishlist-gift-collection][data-view-mode="${viewMode}"]:not([inert])`,
	);
}

/** Opens the seeded list with a saved view mode; display preferences live in localStorage only. */
async function openSeedWishlist(page: Page, baseURL: string, width: number, viewMode: string) {
	await page.setViewportSize({ width, height: 800 });
	const cookies = await loginViaApi(page.request, baseURL, {
		email: 'martin@test.cz',
		password: SEED_PASSWORD,
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.addInitScript(
		({ wishlistId, viewModeKey, savedViewMode }) => {
			localStorage.setItem(viewModeKey, JSON.stringify(savedViewMode));
			localStorage.setItem(
				`prejemesi-wishlist:${wishlistId}:gift-grouping`,
				JSON.stringify('none'),
			);
		},
		{
			wishlistId: SEED_WISHLIST_ID,
			viewModeKey: VIEW_MODE_STORAGE_KEY,
			savedViewMode: viewMode,
		},
	);
	await page.goto('/w/xmas2026', { waitUntil: 'domcontentloaded' });
	await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();
	await waitForAppHydration(page);
	await expect(page.locator('[data-gift-item]').first()).toBeVisible();
}

test.describe('Wishlist Carousel view (#580)', () => {
	test('offers Carousel on mobile and presents Card on desktop without rewriting the choice', async ({
		page,
		baseURL,
	}) => {
		await openSeedWishlist(page, baseURL!, 375, 'card');
		const carouselChoice = page.getByTestId('gift-view-carousel').filter({ visible: true });
		await expect(carouselChoice).toHaveAttribute('aria-label', m.gift_view_carousel());
		await carouselChoice.click();
		await expect(collection(page, 'carousel')).toHaveCount(1);

		await page.setViewportSize({ width: 1280, height: 800 });
		await expect(collection(page, 'card')).toHaveCount(1);
		await expect(page.getByTestId('gift-view-carousel').filter({ visible: true })).toHaveCount(
			0,
		);
		expect(await page.evaluate((key) => localStorage.getItem(key), VIEW_MODE_STORAGE_KEY)).toBe(
			JSON.stringify('carousel'),
		);
	});

	test('renders one row per group under a header with its gift count', async ({
		page,
		baseURL,
	}) => {
		await openSeedWishlist(page, baseURL!, 375, 'carousel');
		await expect(collection(page, 'carousel')).toHaveCount(1);
		const groups = page.getByTestId('gift-carousel-group');
		await expect.poll(() => groups.count()).toBeGreaterThan(1);
		for (const group of await groups.all()) {
			const cardCount = await group.locator('[data-gift-item]').count();
			expect(cardCount).toBeGreaterThan(0);
			await expect(group.getByTestId('gift-section-count')).toContainText(String(cardCount));
			const cardTops = await group
				.locator('[data-gift-item]')
				.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
			expect(new Set(cardTops.map(Math.round)).size).toBe(1);
		}
	});

	for (const { width, fullCards, peek } of [
		{ width: 320, fullCards: 1, peek: 0.5 },
		{ width: 375, fullCards: 2, peek: 0.2 },
		{ width: 430, fullCards: 2, peek: 0.2 },
	]) {
		test(`peeks the next card at the right edge at ${width} px`, async ({ page, baseURL }) => {
			await openSeedWishlist(page, baseURL!, width, 'carousel');
			const row = page.getByTestId('gift-carousel-row').first();
			await expect(row.locator('[data-gift-item]').nth(fullCards)).toBeAttached();
			const cards = await row.locator('[data-gift-item]').evaluateAll((items) =>
				items.map((item) => ({
					left: item.getBoundingClientRect().left,
					width: item.getBoundingClientRect().width,
				})),
			);
			const expectedCardWidth =
				(width - PAGE_GUTTER - fullCards * CARD_GAP) / (fullCards + peek);
			expect(Math.abs(cards[0].width - expectedCardWidth)).toBeLessThanOrEqual(1);
			expect(Math.abs(cards[0].left - PAGE_GUTTER)).toBeLessThanOrEqual(1);
			const peekingCard = cards[fullCards];
			expect(
				Math.abs(width - peekingCard.left - peek * expectedCardWidth),
			).toBeLessThanOrEqual(1);
		});
	}

	test('shows Card while reordering and returns to Carousel after Done', async ({
		page,
		baseURL,
	}) => {
		await openSeedWishlist(page, baseURL!, 375, 'carousel');
		await expect(collection(page, 'carousel')).toHaveCount(1);
		await startGiftReorder(page);
		await expect(collection(page, 'card')).toHaveCount(1);
		await page
			.getByRole('button', { name: m.done(), exact: true })
			.filter({ visible: true })
			.click();
		await expect(page.getByTestId('gift-reorder-temporary-notice')).toBeHidden();
		await expect(collection(page, 'carousel')).toHaveCount(1);
	});
});
