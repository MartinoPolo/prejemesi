import { test, expect, type Page } from '@playwright/test';
import { waitForAppHydration } from '../e2e/fixtures/auth-helpers.js';
import { openDesktopDisplaySubmenu } from '../e2e/fixtures/wishlist-helpers.js';
import * as m from '../../src/lib/paraglide/messages.js';

// Seeded „Vánoce 2026“ (src/lib/server/db/seed.ts): the PlayStation links to alza.cz and
// datart.cz, the headphones to datart.cz, the backpack and coffee maker to alza.cz.
const SEEDED_WISHLIST_PATH = '/w/xmas2026';
const DATART_GIFTS = ['PlayStation 5', 'Sluchátka Sony WH-1000XM5'];
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
