import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';
import { openDesktopDisplaySubmenu } from './fixtures/wishlist-helpers.js';
import * as m from '../../src/lib/paraglide/messages.js';
import { SEED_PASSWORD } from '../../src/lib/server/db/seed_credentials.js';

const SEED_WISHLIST_ID = 'seed-wl-xmas26';

function exactName(label: string): RegExp {
	return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

async function waitForCardGrid(page: Page): Promise<void> {
	await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();
	await waitForAppHydration(page);
	await expect(
		page.locator('[data-wishlist-gift-collection][data-view-mode="card"]'),
	).toBeVisible();
	await expect(page.locator('[data-gift-item]').first()).toBeVisible();
}

function firstRowCardCount(page: Page): Promise<number> {
	return page.locator('[data-gift-item]').evaluateAll((items) => {
		const rects = items.map((item) => item.getBoundingClientRect());
		const firstRowTop = rects[0]?.top ?? 0;
		const firstRowLefts = rects
			.filter((rect) => Math.abs(rect.top - firstRowTop) < 1)
			.map((rect) => Math.round(rect.left));
		return new Set(firstRowLefts).size;
	});
}

async function openColumnsSubmenu(page: Page): Promise<Locator> {
	return openDesktopDisplaySubmenu(page, new RegExp(`^${m.gift_card_columns_label()}`));
}

async function closeDisplayMenus(page: Page): Promise<void> {
	const visibleLayers = page.locator(
		'[data-slot="dropdown-menu-sub-content"]:visible, [data-slot="dropdown-menu-content"]:visible',
	);
	await expect(async () => {
		if ((await visibleLayers.count()) > 0) {
			await page.keyboard.press('Escape');
		}
		await expect(visibleLayers).toHaveCount(0, { timeout: 1_000 });
	}).toPass({ timeout: 5_000 });
}

test.describe('Gift card column choice (issue #451)', () => {
	test('renders five chosen columns, keeps them after a reload, and falls back to four on a narrower viewport', async ({
		page,
		request,
		baseURL,
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const cookies = await loginViaApi(request, baseURL!, {
			email: 'martin@test.cz',
			password: SEED_PASSWORD,
		});
		await page.context().addCookies(parseCookiesForContext(cookies, baseURL!));
		// Display preferences live in localStorage only, so the seeded data stays untouched.
		await page.addInitScript((wishlistId) => {
			localStorage.setItem('prejemesi-gift-view-mode', JSON.stringify('card'));
			localStorage.setItem(
				`prejemesi-wishlist:${wishlistId}:gift-grouping`,
				JSON.stringify('none'),
			);
		}, SEED_WISHLIST_ID);

		await page.goto('/w/xmas2026', { waitUntil: 'domcontentloaded' });
		await waitForCardGrid(page);
		await expect.poll(() => page.locator('[data-gift-item]').count()).toBeGreaterThanOrEqual(6);

		const columnsMenu = await openColumnsSubmenu(page);
		const fiveColumns = columnsMenu.getByRole('menuitemradio', {
			name: exactName(m.gift_card_columns_five()),
		});
		await expect(fiveColumns).not.toHaveAttribute('aria-disabled', 'true');
		await fiveColumns.click();
		await expect(fiveColumns).toHaveAttribute('aria-checked', 'true');
		await closeDisplayMenus(page);

		await expect.poll(() => firstRowCardCount(page)).toBe(5);
		const firstCardActions = page
			.locator('[data-gift-item]')
			.first()
			.getByTestId('gift-action-row')
			.locator('button:visible');
		await expect(firstCardActions.first()).toBeVisible();
		const actionTops = await firstCardActions.evaluateAll((actions) =>
			actions.map((action) => Math.round(action.getBoundingClientRect().top)),
		);
		expect(new Set(actionTops).size).toBe(1);

		await page.reload({ waitUntil: 'domcontentloaded' });
		await waitForCardGrid(page);
		await expect.poll(() => firstRowCardCount(page)).toBe(5);

		await page.setViewportSize({ width: 1024, height: 900 });
		await expect.poll(() => firstRowCardCount(page)).toBe(4);
		const narrowColumnsMenu = await openColumnsSubmenu(page);
		await expect(
			narrowColumnsMenu.getByRole('menuitemradio', {
				name: exactName(m.gift_card_columns_five()),
			}),
		).toHaveAttribute('aria-disabled', 'true');
		await expect(
			narrowColumnsMenu.getByRole('menuitemradio', {
				name: exactName(m.gift_card_columns_four()),
			}),
		).not.toHaveAttribute('aria-disabled', 'true');
		await closeDisplayMenus(page);
	});
});
