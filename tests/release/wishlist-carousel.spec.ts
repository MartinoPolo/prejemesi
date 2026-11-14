import { expect, test, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from '../e2e/fixtures/auth-helpers.js';
import {
	clickWishlistToolbarMoreAction,
	startGiftReorder,
} from '../e2e/fixtures/wishlist-helpers.js';
import { DEFAULT_PIXEL_TOLERANCE } from '../helpers/pixel-assertions.mjs';
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
			await expect(group.getByTestId('gift-section-count')).toHaveText(
				new RegExp(`^${cardCount}\\b`),
			);
			const cardTops = await group
				.locator('[data-gift-item]')
				.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
			expect(new Set(cardTops.map(Math.round)).size).toBe(1);
		}
	});

	// Smoke check on the real page; wishlist_gift_carousel.svelte.test.ts owns the width thresholds.
	test('peeks the next card at the right edge at 375 px', async ({ page, baseURL }) => {
		const width = 375;
		const fullCards = 2;
		const peek = 0.2;
		await openSeedWishlist(page, baseURL!, width, 'carousel');
		const row = page.getByTestId('gift-carousel-row').first();
		await expect(row.locator('[data-gift-item]').nth(fullCards)).toBeAttached();
		const cards = await row.locator('[data-gift-item]').evaluateAll((items) =>
			items.map((item) => ({
				left: item.getBoundingClientRect().left,
				width: item.getBoundingClientRect().width,
			})),
		);
		const expectedCardWidth = (width - PAGE_GUTTER - fullCards * CARD_GAP) / (fullCards + peek);
		expect(Math.abs(cards[0].width - expectedCardWidth)).toBeLessThanOrEqual(1);
		expect(Math.abs(cards[0].left - PAGE_GUTTER)).toBeLessThanOrEqual(1);
		const peekingCard = cards[fullCards];
		expect(Math.abs(width - peekingCard.left - peek * expectedCardWidth)).toBeLessThanOrEqual(
			1,
		);
	});

	test('disables “no grouping” in the display sheet while Carousel is active', async ({
		page,
		baseURL,
	}) => {
		await openSeedWishlist(page, baseURL!, 375, 'carousel');
		await page.getByTestId('mobile-display-trigger').click();
		const sheet = page.getByRole('dialog', { name: m.gift_display_options() });
		await expect(sheet).toBeVisible();
		await sheet.getByTestId('mobile-sheet-grouping-switch').click();
		await expect(sheet.getByRole('radio', { name: m.gift_grouping_none() })).toBeDisabled();
		await expect(sheet.getByRole('radio', { name: m.gift_grouping_priority() })).toBeChecked();
	});

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

	test('jumps from a group chip to that group, focusing its heading below the sticky chrome (#640)', async ({
		page,
		baseURL,
	}) => {
		await openSeedWishlist(page, baseURL!, 375, 'carousel');
		const chipBar = page.getByRole('navigation', { name: m.gift_carousel_jump_aria() });
		const groups = page.getByTestId('gift-carousel-group');
		await expect(chipBar.getByRole('link')).toHaveCount(await groups.count());
		const targetGroup = groups.nth(1);
		const targetHeading = targetGroup.getByRole('heading', { level: 2 });

		await chipBar.getByRole('link').nth(1).click();

		await expect(targetHeading).toBeFocused();
		await expect(chipBar.getByRole('link').nth(1)).toHaveAttribute('aria-current', 'location');
		await expect
			.poll(async () => {
				const toolbarBox = (await page.getByTestId('wishlist-toolbar').boundingBox())!;
				const chipBarBox = (await chipBar.boundingBox())!;
				return Math.abs(chipBarBox.y - (toolbarBox.y + toolbarBox.height));
			}, 'chip bar distance from the toolbar bottom')
			.toBeLessThanOrEqual(DEFAULT_PIXEL_TOLERANCE);
		await expect
			.poll(async () => {
				const chipBarBox = (await chipBar.boundingBox())!;
				const groupTop = (await targetGroup.boundingBox())!.y;
				return Math.abs(groupTop - (chipBarBox.y + chipBarBox.height));
			}, 'jumped-to group distance from the chip bar bottom')
			.toBeLessThanOrEqual(DEFAULT_PIXEL_TOLERANCE);
		expect(new URL(page.url()).hash).toBe('');
	});

	test('marks the chip of the group whose header passed the sticky chrome, and the last at the bottom (#640)', async ({
		page,
		baseURL,
	}) => {
		await openSeedWishlist(page, baseURL!, 375, 'carousel');
		const chipBar = page.getByRole('navigation', { name: m.gift_carousel_jump_aria() });
		const chips = chipBar.getByRole('link');
		await expect.poll(() => chips.count()).toBeGreaterThan(2);
		await expect(chips.first()).toHaveAttribute('aria-current', 'location');
		const scroller = page.getByRole('main');

		// Scroll the second group's top edge a few pixels past the bottom of the chip bar as it will
		// stick, at its sticky `top` inside the scroller, rather than where it rests before scrolling.
		const stuckChipBarBottom = await chipBar.evaluate(
			(bar) =>
				bar.closest('main')!.getBoundingClientRect().top +
				parseFloat(getComputedStyle(bar).top) +
				bar.getBoundingClientRect().height,
		);
		const groupTop = (await page.getByTestId('gift-carousel-group').nth(1).boundingBox())!.y;
		await scroller.evaluate(
			(element, distance) => {
				element.scrollBy({ top: distance, behavior: 'instant' });
			},
			groupTop - stuckChipBarBottom + 4,
		);
		await expect(chips.nth(1)).toHaveAttribute('aria-current', 'location');
		await expect(chipBar.locator('[aria-current="location"]')).toHaveCount(1);

		await scroller.evaluate((element) =>
			element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }),
		);
		await expect(chips.last()).toHaveAttribute('aria-current', 'location');
		await expect(chipBar.locator('[aria-current="location"]')).toHaveCount(1);
	});

	test('updates the row position text as the row scrolls (#640)', async ({ page, baseURL }) => {
		await openSeedWishlist(page, baseURL!, 375, 'carousel');
		const firstGroup = page.getByTestId('gift-carousel-group').first();
		const cardCount = await firstGroup.locator('[data-gift-item]').count();
		expect(cardCount).toBeGreaterThan(2);
		const position = firstGroup.getByTestId('gift-section-position');
		await expect(position).toHaveText(
			m.gift_carousel_position({ first: 1, last: 2, total: cardCount }),
		);
		await expect(position).toHaveAttribute('aria-hidden', 'true');

		await firstGroup
			.locator('[data-slot="carousel-content"]')
			.evaluate((viewport) =>
				viewport.scrollTo({ left: viewport.scrollWidth, behavior: 'instant' }),
			);
		await expect(position).toHaveText(
			m.gift_carousel_position({ first: cardCount - 1, last: cardCount, total: cardCount }),
		);
	});

	test('shows Card while selecting and returns to Carousel after leaving selection', async ({
		page,
		baseURL,
	}) => {
		await openSeedWishlist(page, baseURL!, 375, 'carousel');
		await expect(collection(page, 'carousel')).toHaveCount(1);
		await clickWishlistToolbarMoreAction(page, new RegExp(`^${m.gift_selection_toolbar()}$`));
		const selectionToolbar = page.getByRole('region', { name: m.gift_selection_toolbar() });
		await expect(selectionToolbar).toBeVisible();
		await expect(collection(page, 'card')).toHaveCount(1);
		await selectionToolbar
			.getByRole('button', { name: m.cancel(), exact: true })
			.filter({ visible: true })
			.click();
		await expect(selectionToolbar).toBeHidden();
		await expect(collection(page, 'carousel')).toHaveCount(1);
	});
});
