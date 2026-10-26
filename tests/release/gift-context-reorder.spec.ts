import { test, expect, type Page } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from '../e2e/fixtures/test-data.js';
import { registerAndGetPage } from '../e2e/fixtures/auth-helpers.js';
import { addGift, createWishlistAndNavigate } from '../e2e/fixtures/wishlist-helpers.js';
import { gift, waitForReceivedState } from '../e2e/wishlist-gift-actions.helpers.js';

const REORDER_ENTRY = m.gift_context_reorder();

async function visibleGiftNames(page: Page): Promise<string[]> {
	return page
		.locator('[data-gift-item]:not([data-gift-reorder-overlay])')
		.getByRole('heading', { level: 3 })
		.allTextContents();
}

test('the gift context menu starts reorder mode and Done restores the browsing filters', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-context-reorder'),
	);
	try {
		await createWishlistAndNavigate(page, 'Řazení z menu dárku');
		for (const name of ['Menu Gift A', 'Menu Gift B', 'Menu Gift C']) {
			await addGift(page, name);
		}
		// Marking received enables the received filter, which reorder mode bypasses until Done.
		const receivedGift = gift(page, 'Menu Gift C');
		await receivedGift.getByTestId('gift-received-toggle').click();
		await waitForReceivedState(receivedGift, true);
		await expect.poll(() => visibleGiftNames(page)).toHaveLength(3);

		await gift(page, 'Menu Gift A')
			.getByRole('heading', { name: 'Menu Gift A', exact: true })
			.click({ button: 'right' });
		const menuLabels = await page.getByRole('menuitem').allTextContents();
		const selectIndex = menuLabels.findIndex((label) =>
			label.includes(m.gift_context_select_multiple()),
		);
		expect(menuLabels[selectIndex + 1]).toContain(REORDER_ENTRY);
		await page.getByRole('menuitem', { name: REORDER_ENTRY }).click();

		await expect(page.getByTestId('gift-reorder-temporary-notice')).toBeVisible();
		await expect.poll(() => visibleGiftNames(page)).toEqual(['Menu Gift A', 'Menu Gift B']);
		const grip = gift(page, 'Menu Gift A').getByRole('button', {
			name: m.gift_reorder_grip_label(),
		});
		await expect(grip).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect.poll(() => visibleGiftNames(page)).toEqual(['Menu Gift B', 'Menu Gift A']);

		await page.getByRole('button', { name: m.gift_reorder_done(), exact: true }).click();
		await expect(page.getByTestId('gift-reorder-temporary-notice')).toHaveCount(0);
		await expect
			.poll(() => visibleGiftNames(page))
			.toEqual(['Menu Gift B', 'Menu Gift A', 'Menu Gift C']);
	} finally {
		await page.context().close();
	}
});

test('the mobile gift More sheet starts reorder mode', async ({ browser, request, baseURL }) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-context-reorder-mobile'),
	);
	try {
		await page.setViewportSize({ width: 390, height: 844 });
		await createWishlistAndNavigate(page, 'Řazení z mobilního menu');
		await addGift(page, 'Mobile Gift A');
		await addGift(page, 'Mobile Gift B');

		await gift(page, 'Mobile Gift A').getByTestId('gift-more-actions').click();
		const sheet = page.getByRole('dialog', { name: 'Mobile Gift A' });
		await sheet.getByRole('button', { name: REORDER_ENTRY }).click();
		await expect(sheet).toBeHidden();
		await expect(page.getByTestId('gift-reorder-temporary-notice')).toBeVisible();
		await expect(
			gift(page, 'Mobile Gift A').getByRole('button', { name: m.gift_reorder_grip_label() }),
		).toBeFocused();
	} finally {
		await page.context().close();
	}
});
