import { expect, test, type BrowserContextOptions, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from '../e2e/fixtures/auth-helpers.js';
import { SEED_PASSWORD } from '../../src/lib/server/db/seed_credentials.js';

// The (app) layout scrolls `main.app-content`, not the window, so SvelteKit's own scroll
// restoration never sees these offsets.
const SEEDED_WISHLIST_PATH = '/w/xmas2026';
const RESTORED_OFFSET_SHARE = 0.6;
/** Card tracks may settle after the restore; scroll anchoring keeps the same gift in view. */
const ANCHOR_TOLERANCE_PX = 32;
/** Long enough for late mounting batches and image loads to move the content if they would. */
const SETTLE_CHECK_DELAY_MS = 750;

const viewports: { name: string; options: BrowserContextOptions }[] = [
	// A short desktop window, because the seeded list overview fits a tall one.
	{ name: 'desktop', options: { viewport: { width: 1280, height: 540 } } },
	{
		name: 'mobile',
		options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
	},
];

function contentScrollTop(page: Page): Promise<number> {
	return page.locator('main.app-content').evaluate((scroller) => scroller.scrollTop);
}

function maximumContentTop(page: Page): Promise<number> {
	return page
		.locator('main.app-content')
		.evaluate((scroller) => scroller.scrollHeight - scroller.clientHeight);
}

async function scrollContentTo(page: Page, top: number): Promise<void> {
	await page
		.locator('main.app-content')
		.evaluate((scroller, value) => scroller.scrollTo({ top: value, behavior: 'instant' }), top);
	await expect.poll(() => contentScrollTop(page)).toBe(top);
}

/** The first gift at or below the scroller's top edge, and its distance from that edge. */
function giftAtContentTop(page: Page): Promise<{ name: string; offset: number } | null> {
	return page.locator('main.app-content').evaluate((scroller) => {
		const edge = scroller.getBoundingClientRect().top;
		for (const gift of scroller.querySelectorAll<HTMLElement>('[data-gift-item]')) {
			const top = gift.getBoundingClientRect().top;
			if (top >= edge) {
				return {
					name: gift.querySelector('h3, h2')?.textContent?.trim() ?? '',
					offset: top - edge,
				};
			}
		}
		return null;
	});
}

/** Reaches `expected` within `tolerance`, then holds it, so a late jump fails too. */
async function expectSettledContentTop(
	page: Page,
	expected: number,
	tolerance: number,
	message: string,
): Promise<void> {
	const distance = async () => Math.abs((await contentScrollTop(page)) - expected);
	await expect.poll(distance, { message }).toBeLessThanOrEqual(tolerance);
	await page.waitForTimeout(SETTLE_CHECK_DELAY_MS);
	expect(await distance(), `${message}, and stays there`).toBeLessThanOrEqual(tolerance);
}

async function waitForAllGifts(page: Page): Promise<void> {
	await expect(page.locator('[data-gift-item]').first()).toBeVisible();
	await expect(page.locator('[aria-busy="true"], [data-gift-collection-mounting]')).toHaveCount(
		0,
	);
}

for (const { name, options } of viewports) {
	test(`${name}: back navigation restores the wishlist's content scroll and new pages start at the top @scroll @wishlist`, async ({
		browser,
		baseURL,
		request,
	}) => {
		const cookies = await loginViaApi(request, baseURL!, {
			email: 'martin@test.cz',
			password: SEED_PASSWORD,
		});
		const context = await browser.newContext({ ...options, baseURL });
		await context.addCookies(parseCookiesForContext(cookies, baseURL!));
		const page = await context.newPage();

		await page.goto('/my-lists');
		await waitForAppHydration(page);
		const myListsTop = await maximumContentTop(page);
		expect(myListsTop, 'the list overview scrolls').toBeGreaterThan(0);
		await scrollContentTo(page, myListsTop);
		// A programmatic click keeps Playwright from scrolling the link into view first.
		await page
			.locator(`main a[href$="${SEEDED_WISHLIST_PATH}"]`)
			.first()
			.evaluate((link: HTMLAnchorElement) => link.click());
		await expect(page).toHaveURL(new RegExp(`${SEEDED_WISHLIST_PATH}$`));
		await waitForAllGifts(page);
		expect(await contentScrollTop(page), 'a link opens the wishlist at its top').toBe(0);

		const savedTop = Math.round((await maximumContentTop(page)) * RESTORED_OFFSET_SHARE);
		await scrollContentTo(page, savedTop);
		const anchor = await giftAtContentTop(page);
		expect(anchor?.name, 'a named gift sits at the saved offset').toBeTruthy();

		// The overview is tall as it commits, so only the reset keeps it from opening clamped at
		// the wishlist's offset.
		await page
			.locator(`header a[href$="/my-lists"]`)
			.first()
			.evaluate((link: HTMLAnchorElement) => link.click());
		await expect(page).toHaveURL(/\/my-lists$/);
		await expectSettledContentTop(page, 0, 0, 'a link opens the overview at its top');

		const expectWishlistRestored = async (direction: string) => {
			await expect(page).toHaveURL(new RegExp(`${SEEDED_WISHLIST_PATH}$`));
			await waitForAllGifts(page);
			await expectSettledContentTop(
				page,
				savedTop,
				ANCHOR_TOLERANCE_PX,
				`${direction} restores the offset`,
			);
			const restoredAnchor = await giftAtContentTop(page);
			expect(restoredAnchor?.name, 'the same gift is back at the top').toBe(anchor!.name);
			expect(Math.abs(restoredAnchor!.offset - anchor!.offset)).toBeLessThanOrEqual(
				ANCHOR_TOLERANCE_PX,
			);
		};

		await page.goBack();
		await expectWishlistRestored('back');

		await page.goBack();
		await expect(page).toHaveURL(/\/my-lists$/);
		await expectSettledContentTop(page, myListsTop, 0, 'back restores the list overview too');

		await page.goForward();
		await expectWishlistRestored('forward');

		await page.goForward();
		await expect(page).toHaveURL(/\/my-lists$/);
		await expectSettledContentTop(page, 0, 0, 'forward returns to an overview left at its top');

		await context.close();
	});
}
