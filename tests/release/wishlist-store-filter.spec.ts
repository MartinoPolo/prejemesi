import { test, expect, type Page } from '@playwright/test';
import { waitForAppHydration } from '../e2e/fixtures/auth-helpers.js';
import { openDesktopDisplaySubmenu } from '../e2e/fixtures/wishlist-helpers.js';
import * as m from '../../src/lib/paraglide/messages.js';

// Seeded „Vánoce 2026“ (src/lib/server/db/seed.ts): the PlayStation links to alza.cz and
// datart.cz, the headphones to datart.cz, the backpack and coffee maker to alza.cz.
const SEEDED_WISHLIST_PATH = '/w/xmas2026';
const DATART_GIFTS = ['PlayStation 5', 'Sluchátka Sony WH-1000XM5'];
const ALZA_GIFTS = ['PlayStation 5', 'Nový batoh Osprey', 'Kávovar DeLonghi'];
const ALZA_OR_DATART_GIFTS = [...DATART_GIFTS, 'Nový batoh Osprey', 'Kávovar DeLonghi'];

async function visibleGiftNames(page: Page): Promise<string[]> {
	const names = await page
		.locator('[data-gift-item]:visible')
		.getByRole('heading')
		.allTextContents();
	return names.map((name) => name.trim()).sort();
}

async function toggleStore(page: Page, store: string): Promise<void> {
	const filterMenu = await openDesktopDisplaySubmenu(page, /^Filtrovat/);
	// The store facet appears once its lazily loaded domain resolver arrives after hydration.
	await expect(
		filterMenu.getByText(m.gift_filter_store_heading(), { exact: true }),
	).toBeVisible();
	await filterMenu.getByRole('menuitemcheckbox', { name: store, exact: true }).click();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
}

test('a visitor filters a wishlist to the gifts buyable in the chosen stores @display-sheet', async ({
	page,
}) => {
	await page.goto(SEEDED_WISHLIST_PATH);
	await waitForAppHydration(page);
	const allGiftNames = await visibleGiftNames(page);
	expect(allGiftNames.length).toBeGreaterThan(ALZA_OR_DATART_GIFTS.length);

	await toggleStore(page, 'datart.cz');
	await expect.poll(() => visibleGiftNames(page)).toEqual([...DATART_GIFTS].sort());

	await toggleStore(page, 'alza.cz');
	await expect.poll(() => visibleGiftNames(page)).toEqual([...ALZA_OR_DATART_GIFTS].sort());

	await page
		.getByTestId('wishlist-toolbar-active-filters')
		.getByRole('button', { name: m.wishlist_detail_clear_filters(), exact: true })
		.click();
	await expect.poll(() => visibleGiftNames(page)).toEqual(allGiftNames);
});

test('a mobile visitor filters by stores in the Display sheet and removes them from the pill row @display-sheet', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(SEEDED_WISHLIST_PATH);
	await waitForAppHydration(page);
	const allGiftNames = await visibleGiftNames(page);

	await page.getByTestId('mobile-display-trigger').click();
	const sheet = page.getByRole('dialog', { name: m.gift_display_options() });
	await sheet.getByTestId('mobile-sheet-filter-switch').click();
	// The store facet appears once its lazily loaded domain resolver arrives after hydration.
	await expect(sheet.getByRole('heading', { name: m.gift_filter_store_heading() })).toBeVisible();
	await sheet.getByRole('checkbox', { name: 'alza.cz', exact: true }).click();
	await sheet.getByRole('checkbox', { name: 'datart.cz', exact: true }).click();
	await sheet
		.getByTestId('mobile-sheet-footer')
		.getByRole('button', {
			name: m.gift_filter_show_results_other({ count: ALZA_OR_DATART_GIFTS.length }),
		})
		.click();
	await expect(sheet).toBeHidden();
	await expect.poll(() => visibleGiftNames(page)).toEqual([...ALZA_OR_DATART_GIFTS].sort());

	const pillRow = page.getByTestId('wishlist-mobile-active-filters');
	const toolbar = page.getByTestId('wishlist-toolbar');
	await expect(
		pillRow.getByRole('button', { name: m.filter_remove({ label: 'alza.cz' }), exact: true }),
	).toBeVisible();

	const appScroller = page.locator('.app-content');
	const toolbarBefore = (await toolbar.boundingBox())!;
	const rowBefore = (await pillRow.boundingBox())!;
	// Scroll past the toolbar's resting position, so the toolbar sticks while the row moves on.
	const scrollDistance = Math.round(toolbarBefore.y) + 120;
	await appScroller.evaluate(
		(element, top) => element.scrollBy({ top, behavior: 'instant' }),
		scrollDistance,
	);
	await expect
		.poll(async () => rowBefore.y - (await pillRow.boundingBox())!.y, {
			message: 'the pill row scrolls away with the page',
		})
		.toBeGreaterThan(scrollDistance - 10);
	expect((await toolbar.boundingBox())!.y, 'the toolbar stays sticky').toBeGreaterThan(
		toolbarBefore.y - scrollDistance + 100,
	);
	await appScroller.evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }));

	await pillRow
		.getByRole('button', { name: m.filter_remove({ label: 'datart.cz' }), exact: true })
		.click();
	await expect.poll(() => visibleGiftNames(page)).toEqual([...ALZA_GIFTS].sort());

	await pillRow
		.getByRole('button', { name: m.wishlist_detail_clear_filters(), exact: true })
		.click();
	await expect.poll(() => visibleGiftNames(page)).toEqual(allGiftNames);
	await expect(pillRow).toBeHidden();
	await expect(page.getByTestId('mobile-display-trigger')).toBeFocused();
});
