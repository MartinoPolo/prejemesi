import { test, expect, type Locator, type Page } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	gift,
	createActionFixture,
	dismissToasts,
	openMobileBulkAction,
	openMobileGiftActions,
	selectionCount,
	waitForToast,
} from './wishlist-gift-actions.helpers.js';

const BULK_COPY_REMOTE = '**/_app/remote/**/bulkCopyGifts';

async function selectBothGifts(page: Page): Promise<Locator> {
	await page.setViewportSize({ width: 390, height: 760 });
	const contextSheet = await openMobileGiftActions(
		page,
		gift(page, 'Kolo pro výlety'),
		'Kolo pro výlety',
	);
	await contextSheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
	const toolbar = page.getByRole('region', { name: m.gift_selection_toolbar(), exact: true });
	await gift(page, 'Stan pro dva').click();
	await selectionCount(toolbar, 2);
	return toolbar;
}

async function openNewWishlistCopy(page: Page): Promise<{ copySheet: Locator; modal: Locator }> {
	await openMobileBulkAction(page, 'copy');
	const copySheet = page.getByRole('dialog', { name: m.gift_bulk_copy_title() });
	await expect(copySheet.getByTestId('bulk-copy-destination')).toHaveText(
		m.gift_bulk_copy_new_destination(),
	);
	await copySheet
		.getByRole('button', { name: m.gift_bulk_copy_new_destination_confirm() })
		.click();
	const modal = page.getByRole('dialog', { name: m.wishlist_create_title() });
	await expect(modal).toBeVisible();
	return { copySheet, modal };
}

/**
 * A successful mobile copy returns to the selection actions sheet; close it to reach the toast.
 * Selection must still be active here so the destination proves navigation itself clears it.
 */
async function openCopiedWishlistFromToast(page: Page, toolbar: Locator): Promise<void> {
	const toast = page
		.locator('[data-sonner-toast]')
		.filter({ hasText: m.gift_bulk_copy_success({ count: 2 }) });
	await expect(toast).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: m.gift_selection_actions() })).toBeHidden();
	await selectionCount(toolbar, 2);
	await toast.getByRole('button', { name: m.gift_bulk_copy_open_destination() }).click();
}

test('copies selected gifts into a wishlist created from the copy dialog', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('bulk-copy-new-wishlist'),
	);
	try {
		await createActionFixture(page);
		const sourcePath = new URL(page.url()).pathname;
		await dismissToasts(page);
		const toolbar = await selectBothGifts(page);

		const cancelled = await openNewWishlistCopy(page);
		await cancelled.modal.getByRole('button', { name: m.cancel(), exact: true }).click();
		await expect(cancelled.modal).toBeHidden();
		await expect(cancelled.copySheet).toBeVisible();
		await selectionCount(toolbar, 2);
		await expect(page.locator('[data-gift-item]')).toHaveCount(2);

		await cancelled.copySheet
			.getByRole('button', { name: m.gift_bulk_copy_new_destination_confirm() })
			.click();
		const modal = page.getByRole('dialog', { name: m.wishlist_create_title() });
		await modal.getByRole('textbox', { name: m.wishlist_name_label() }).fill('Nový cíl');
		await modal.getByRole('button', { name: m.create(), exact: true }).click();

		await waitForToast(page, m.gift_bulk_copy_success({ count: 2 }));
		expect(new URL(page.url()).pathname).toBe(sourcePath);
		await expect(page.locator('[data-gift-item]')).toHaveCount(2);
		await openCopiedWishlistFromToast(page, toolbar);

		await expect(page.getByRole('heading', { level: 1 })).toContainText('Nový cíl');
		await expect(toolbar).toBeHidden();
		await expect(page.locator('[data-gift-item]')).toHaveCount(2);
		await expect(gift(page, 'Kolo pro výlety')).toHaveCount(1);
		await expect(gift(page, 'Stan pro dva')).toHaveCount(1);
	} finally {
		await page.context().close();
	}
});

test('keeps the created wishlist when the copy into it fails', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('bulk-copy-new-wishlist-failure'),
	);
	try {
		await createActionFixture(page);
		await dismissToasts(page);
		const toolbar = await selectBothGifts(page);
		await page.route(BULK_COPY_REMOTE, (route) => route.abort('failed'));

		const { copySheet, modal } = await openNewWishlistCopy(page);
		await modal.getByRole('textbox', { name: m.wishlist_name_label() }).fill('Ponechaný cíl');
		await modal.getByRole('button', { name: m.create(), exact: true }).click();

		await waitForToast(page, m.error_generic());
		await expect(modal).toBeHidden();
		await expect(copySheet).toBeVisible();
		await expect(copySheet.getByTestId('bulk-copy-destination')).toContainText('Ponechaný cíl');

		await page.unroute(BULK_COPY_REMOTE);
		await dismissToasts(page);
		await copySheet.getByRole('button', { name: m.gift_bulk_copy_confirm() }).click();
		await expect(modal).toBeHidden();
		await openCopiedWishlistFromToast(page, toolbar);
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Ponechaný cíl');
		await expect(page.locator('[data-gift-item]')).toHaveCount(2);
	} finally {
		await page.context().close();
	}
});
