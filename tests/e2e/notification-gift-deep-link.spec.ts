import { test, expect, type Page } from '@playwright/test';
import { createAuthenticatedContext, loginViaApi } from './fixtures/auth-helpers.js';

const MARTIN = { email: 'martin@test.cz', password: 'password123' };
const SEEDED_WISHLIST_PATH = '/w/xmas2026';
const SEEDED_GIFT_ID = 'seed-g-ps5';
const SEEDED_GIFT_NAME = 'PlayStation 5';

async function expectGiftMarkerConsumed(page: Page): Promise<void> {
	await expect
		.poll(() => new URL(page.url()).searchParams.has('gift'), {
			message: 'gift query marker is removed after the route consumes it',
		})
		.toBe(false);
}

test('notification gift marker is consumed once and only fresh valid markers reopen the gift', async ({
	browser,
	request,
	baseURL,
}) => {
	const cookies = await loginViaApi(request, baseURL!, MARTIN);
	const context = await createAuthenticatedContext(browser, cookies, baseURL!);
	const page = await context.newPage();
	const dialog = page.getByRole('dialog');

	await page.goto(`${SEEDED_WISHLIST_PATH}?gift=${SEEDED_GIFT_ID}`);
	await expect(page.getByRole('heading', { name: 'Vánoce 2026' }).first()).toBeVisible();
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('#gift-name')).toHaveValue(SEEDED_GIFT_NAME);
	await expectGiftMarkerConsumed(page);

	await dialog.getByRole('button', { name: /Zavřít|Close/ }).click();
	await expect(dialog).not.toBeVisible();
	await page.waitForTimeout(250);
	await expect(dialog).not.toBeVisible();

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Vánoce 2026' }).first()).toBeVisible();
	await expect(dialog).not.toBeVisible();

	await page.goto(`${SEEDED_WISHLIST_PATH}?gift=${SEEDED_GIFT_ID}`);
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('#gift-name')).toHaveValue(SEEDED_GIFT_NAME);
	await expectGiftMarkerConsumed(page);
	await dialog.getByRole('button', { name: /Zavřít|Close/ }).click();
	await expect(dialog).not.toBeVisible();

	await page.goto(`${SEEDED_WISHLIST_PATH}?gift=not-a-seeded-gift`);
	await expect(page.getByRole('heading', { name: 'Vánoce 2026' }).first()).toBeVisible();
	await expectGiftMarkerConsumed(page);
	await expect(dialog).not.toBeVisible();
	await page.waitForTimeout(250);
	await expect(dialog).not.toBeVisible();

	await context.close();
});
