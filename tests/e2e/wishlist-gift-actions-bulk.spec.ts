import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { openDialogFromTrigger, shareWishlist } from './fixtures/wishlist-helpers.js';
import {
	gift,
	createActionFixture,
	dismissToasts,
	openMobileGiftActions,
	selectionCount,
	waitForToast,
	applyNestedBulkOption,
	waitForReceivedState,
	createAdditionalWishlist,
} from './wishlist-gift-actions.helpers.js';

test('multi-select mutation and copy persist after source and destination reloads', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('gift-actions-mobile-bulk-persistence'),
	);
	try {
		await createActionFixture(page);
		await shareWishlist(page);
		const sourcePath = new URL(page.url()).pathname;
		const destinationPath = await createAdditionalWishlist(page, 'Cíl hromadného kopírování');
		await page.goto(sourcePath);
		await expect(page.locator('[data-gift-item]')).toHaveCount(2);
		await dismissToasts(page);
		await page.setViewportSize({ width: 390, height: 760 });

		let firstGift = gift(page, 'Kolo pro výlety');
		let secondGift = gift(page, 'Stan pro dva');
		const contextSheet = await openMobileGiftActions(page, firstGift, 'Kolo pro výlety');
		await contextSheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
		const toolbar = page.getByRole('region', { name: m.gift_selection_toolbar(), exact: true });
		await secondGift.click();
		await selectionCount(toolbar, 2);
		await expect(firstGift).toHaveAttribute('aria-selected', 'true');
		await expect(secondGift).toHaveAttribute('aria-selected', 'true');

		await toolbar.getByRole('button', { name: m.gift_selection_actions() }).click();
		const sheet = page.getByRole('dialog', { name: m.gift_selection_actions() });
		await applyNestedBulkOption(page, sheet, 'received', m.gift_mark_received(), 2);
		await sheet.locator('[data-mobile-bulk-action="copy"]').click();
		const copySheet = page.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		const copyButton = copySheet.getByRole('button', { name: m.gift_bulk_copy_confirm() });
		await expect(copyButton).toBeEnabled();
		await copyButton.click();
		await waitForToast(page, m.gift_bulk_copy_success({ count: 2 }));
		await selectionCount(toolbar, 2);
		await dismissToasts(page);

		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
		await toolbar.getByRole('button', { name: m.cancel() }).click();
		await page.reload({ waitUntil: 'load' });
		const displaySheet = page.getByRole('dialog', { name: m.gift_display_options() });
		await openDialogFromTrigger(page.getByTestId('mobile-display-trigger'), displaySheet);
		await displaySheet.getByTestId('mobile-sheet-filter-switch').click();
		await displaySheet.getByRole('checkbox', { name: m.gift_filter_show_received() }).check();
		await page.keyboard.press('Escape');
		await expect(displaySheet).toBeHidden();
		firstGift = gift(page, 'Kolo pro výlety');
		secondGift = gift(page, 'Stan pro dva');
		await waitForReceivedState(firstGift, true);
		await waitForReceivedState(secondGift, true);

		await page.goto(destinationPath, { waitUntil: 'load' });
		await page.reload({ waitUntil: 'load' });
		await expect(page.locator('[data-gift-item]')).toHaveCount(2);
		await expect(gift(page, 'Kolo pro výlety')).toHaveCount(1);
		await expect(gift(page, 'Stan pro dva')).toHaveCount(1);
	} finally {
		await page.context().close();
	}
});
