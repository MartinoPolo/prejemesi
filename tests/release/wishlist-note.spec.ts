import { test, expect, type Page } from '@playwright/test';
import { SEED_PASSWORD } from '../../src/lib/server/db/seed_credentials.js';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from '../e2e/fixtures/auth-helpers.js';
import { clickWishlistToolbarMoreAction } from '../e2e/fixtures/wishlist-helpers.js';

const SHOW_NOTE = /^(Zobrazit vzkaz|Show message)$/;
const FOLD = /^(Sbalit vzkaz|Collapse message)$/;
const UNFOLD = /^(více|more)$/;
const DISMISS = /^(Skrýt vzkaz|Hide message)$/;
const DISMISS_CONFIRM = /^(Skrýt|Hide)$/;
const KEEP = /^(Ponechat|Keep)$/;

async function reloadWishlist(page: Page): Promise<void> {
	await page.reload({ waitUntil: 'domcontentloaded' });
	await waitForAppHydration(page, { timeout: 60_000 });
}

test.describe('wishlist note', () => {
	test('a visitor folds, keeps, hides and restores the note across reloads', async ({
		page,
		baseURL,
	}) => {
		test.setTimeout(180_000);
		const cookies = await loginViaApi(page.request, baseURL!, {
			email: 'petr@test.cz',
			password: SEED_PASSWORD,
		});
		await page.context().addCookies(parseCookiesForContext(cookies, baseURL!));
		await page.goto('/w/bdaymart', { waitUntil: 'domcontentloaded', timeout: 90_000 });
		await waitForAppHydration(page, { timeout: 90_000 });
		await page.evaluate(() => localStorage.clear());
		await reloadWishlist(page);

		const note = page.getByTestId('wishlist-note');
		const moreTrigger = page.getByTestId('desktop-more-trigger');
		await expect(note).toContainText('Budu mít 30!');
		await expect(note.getByRole('button', { name: FOLD })).toBeVisible();

		await moreTrigger.click();
		const moreMenu = page.getByRole('menu');
		await expect(moreMenu).toBeVisible();
		await expect(moreMenu.getByRole('menuitem', { name: SHOW_NOTE })).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(moreMenu).toBeHidden();

		await note.getByRole('button', { name: FOLD }).click();
		await expect(note.getByRole('button', { name: UNFOLD })).toBeFocused();
		await reloadWishlist(page);
		await expect(note.getByRole('button', { name: UNFOLD })).toBeVisible();
		await expect(note.getByRole('button', { name: FOLD })).toHaveCount(0);

		await note.getByRole('button', { name: DISMISS }).click();
		await note.getByRole('button', { name: KEEP }).click();
		await expect(note.getByRole('button', { name: UNFOLD })).toBeVisible();

		await note.getByRole('button', { name: DISMISS }).click();
		await note.getByRole('button', { name: DISMISS_CONFIRM }).click();
		await expect(note).toHaveCount(0);
		await expect(moreTrigger).toBeFocused();

		await reloadWishlist(page);
		await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();
		await expect(note).toHaveCount(0);

		await clickWishlistToolbarMoreAction(page, SHOW_NOTE);
		await expect(note.getByRole('button', { name: FOLD })).toBeVisible();
		await expect(note).toContainText('Budu mít 30!');
	});
});
