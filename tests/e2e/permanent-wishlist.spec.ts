import postgres from 'postgres';
import { loadEnv } from 'vite';
import { test, expect, type Page } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { resolveDatabaseUrl } from '../../src/lib/config/runtime_environment.js';
import { createTestUser } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	openCreateWishlistDialog,
	shareWishlist,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';
import {
	gift,
	createAdditionalWishlist,
	dismissToasts,
	openMobileBulkAction,
	openMobileGiftActions,
	selectionCount,
	waitForToast,
} from './wishlist-gift-actions.helpers.js';

const LOCAL_DATABASE_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function localDatabaseUrl(): string {
	const databaseUrl = resolveDatabaseUrl({
		...loadEnv('development', process.cwd(), ''),
		...process.env,
	});
	if (databaseUrl === undefined || !LOCAL_DATABASE_HOSTNAMES.has(new URL(databaseUrl).hostname)) {
		throw new Error(
			'The permanent wishlist spec rewrites share timestamps on a local database only',
		);
	}
	return databaseUrl;
}

/**
 * Moves the share and the gifts' creation into the past so the post-share grace has closed,
 * instead of waiting out the real grace window.
 */
async function expireShareGrace(wishlistPath: string): Promise<void> {
	const shortId = wishlistPath.split('/').at(-1);
	const database = postgres(localDatabaseUrl(), { max: 1, connect_timeout: 5 });
	try {
		const sharedWishlists = await database<{ id: string }[]>`
			update wishlist set shared_at = now() - interval '10 minutes'
			where short_id = ${shortId ?? ''} and shared_at is not null
			returning id
		`;
		expect(sharedWishlists).toHaveLength(1);
		const backdatedGifts = await database`
			update gift set created_at = now() - interval '20 minutes'
			where wishlist_id = ${sharedWishlists[0]!.id}
		`;
		expect(backdatedGifts.count).toBeGreaterThan(0);
	} finally {
		await database.end({ timeout: 5 });
	}
}

/** Creates a permanent wishlist for the creator, or, given a recipient name, one they only manage. */
async function createPermanentWishlistAndNavigate(
	page: Page,
	title: string,
	{ recipientName }: { recipientName?: string } = {},
): Promise<string> {
	await page.goto('/my-lists');
	const dialog = await openCreateWishlistDialog(page);
	if (recipientName !== undefined) {
		await dialog.getByText('Pro někoho jiného', { exact: true }).click();
		const recipientInput = dialog.locator('#wishlist-recipient-name');
		await expect(recipientInput).toBeVisible({ timeout: 5_000 });
		await recipientInput.fill(recipientName);
	}
	await dialog.getByRole('textbox', { name: 'Název' }).fill(title);
	const kindGroup = dialog.getByRole('group', { name: m.wishlist_kind_label() });
	await expect(kindGroup.getByRole('radio', { name: m.wishlist_kind_occasion() })).toBeChecked();
	await expect(dialog.getByText(m.wishlist_event_date_label())).toBeVisible();
	await kindGroup.getByRole('radio', { name: m.wishlist_kind_permanent() }).click();
	await expect(kindGroup.getByRole('radio', { name: m.wishlist_kind_permanent() })).toBeChecked();
	await expect(dialog.getByText(m.wishlist_event_date_label())).toBeHidden();
	await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();

	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
	await expect(page.getByRole('button', { name: /Přidat dárek|Add gift/ }).first()).toBeEnabled();
	return new URL(page.url()).pathname;
}

async function openGiftEditor(page: Page, giftName: string) {
	await gift(page, giftName).getByRole('heading', { name: giftName, exact: true }).click();
	const dialog = page.getByRole('dialog', { name: m.gift_edit_title() });
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	return dialog;
}

function recipientGiftChangeWarning(page: Page) {
	return page.getByRole('dialog', { name: m.gift_recipient_change_warning_title() });
}

test('creates a permanent wishlist without an event date and explains it to visitors', async ({
	browser,
	request,
	baseURL,
}) => {
	const ownerPage = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('permanent-create-owner'),
	);
	const visitorCookies = await registerViaApi(
		request,
		baseURL!,
		createTestUser('permanent-create-visitor'),
	);
	const visitorContext = await createAuthenticatedContext(browser, visitorCookies, baseURL!);
	try {
		const wishlistPath = await createPermanentWishlistAndNavigate(ownerPage, 'Stálé přání');
		await expect(ownerPage.getByTestId('wishlist-kind-chip')).toHaveText(
			m.wishlist_kind_permanent(),
		);
		await addGift(ownerPage, 'Kniha o horách');
		await shareWishlist(ownerPage);
		await expect(ownerPage.getByTestId('wishlist-permanent-note')).toHaveCount(0);

		const visitorPage = await visitorContext.newPage();
		await visitorPage.goto(wishlistPath);
		await expect(visitorPage.getByTestId('wishlist-kind-chip')).toHaveText(
			m.wishlist_kind_permanent(),
		);
		await expect(visitorPage.getByTestId('wishlist-permanent-note')).toContainText(
			m.wishlist_permanent_visitor_note(),
		);
	} finally {
		await visitorContext.close();
		await ownerPage.context().close();
	}
});

test('keeps unreserved gifts editable on a shared permanent wishlist after the share grace', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('permanent-post-share-edit'),
	);
	try {
		const occasionPath = await createWishlistAndNavigate(page, 'Narozeniny');
		await addGift(page, 'Deskovka');
		await shareWishlist(page);
		await expireShareGrace(occasionPath);

		const permanentPath = await createPermanentWishlistAndNavigate(page, 'Průběžná přání');
		await addGift(page, 'Termoska');
		await addGift(page, 'Pláštěnka');
		await shareWishlist(page);
		await expireShareGrace(permanentPath);

		// The occasion list proves the backdated share really closed the grace: its gift is locked.
		await page.goto(occasionPath);
		const lockedEditor = await openGiftEditor(page, 'Deskovka');
		await expect(lockedEditor.locator('#gift-name')).toBeDisabled();
		await expect(lockedEditor.getByRole('button', { name: m.gift_delete() })).toHaveCount(0);

		// Opening a gift is not a change: the recipient gets the editor without a warning.
		await page.goto(permanentPath);
		const editor = await openGiftEditor(page, 'Termoska');
		const warning = recipientGiftChangeWarning(page);
		const nameInput = editor.locator('#gift-name');
		await expect(nameInput).toBeEnabled();
		await expect(editor.getByRole('button', { name: m.gift_delete() })).toBeVisible();
		await expect(warning).toHaveCount(0);

		// The first edit warns; cancelling reverts the pending edit.
		await nameInput.fill('Termoska na kávu');
		await expect(warning).toBeVisible({ timeout: 5_000 });
		await expect(warning).toContainText(m.gift_recipient_change_warning_description());
		await warning.getByRole('button', { name: m.cancel() }).click();
		await expect(warning).toBeHidden();
		await expect(editor.locator('#gift-name')).toHaveValue('Termoska');

		await editor.locator('#gift-name').fill('Termoska na čaj');
		await expect(warning).toBeVisible({ timeout: 5_000 });
		await warning
			.getByRole('button', { name: m.gift_recipient_change_warning_continue() })
			.click();
		await expect(warning).toBeHidden();
		await expect(editor.locator('#gift-name')).toHaveValue('Termoska na čaj');
		await editor.getByRole('button', { name: /^(Uložit|Save)$/ }).click();
		await expect(editor).toBeHidden({ timeout: 10_000 });
		await expect(gift(page, 'Termoska na čaj')).toHaveCount(1);
		await expect(gift(page, 'Termoska')).toHaveCount(0);

		// Acknowledged once for this list in this browser session: a later edit does not warn.
		const reopenedEditor = await openGiftEditor(page, 'Termoska na čaj');
		await reopenedEditor.locator('#gift-name').fill('Termoska na výlety');
		await expect(reopenedEditor.locator('#gift-name')).toHaveValue('Termoska na výlety');
		await expect(warning).toHaveCount(0);
		await reopenedEditor.getByRole('button', { name: /^(Zrušit|Cancel)$/ }).click();
		await page
			.getByRole('dialog', { name: m.wishlist_settings_unsaved_title() })
			.getByRole('button', { name: m.wishlist_settings_discard() })
			.click();
		await expect(reopenedEditor).toBeHidden();
		await waitForDialogOverlayRemoval(page);

		// In a new browser session, Delete as the first change warns before the deletion confirm.
		const freshSessionPage = await page.context().newPage();
		try {
			await freshSessionPage.goto(permanentPath);
			const deleteEditor = await openGiftEditor(freshSessionPage, 'Pláštěnka');
			const freshWarning = recipientGiftChangeWarning(freshSessionPage);
			await expect(freshWarning).toHaveCount(0);
			await deleteEditor.getByRole('button', { name: m.gift_delete() }).click();
			await expect(freshWarning).toBeVisible({ timeout: 5_000 });
			await freshWarning
				.getByRole('button', { name: m.gift_recipient_change_warning_continue() })
				.click();
			await expect(freshWarning).toBeHidden();
			await deleteEditor.getByRole('button', { name: m.gift_delete_confirm() }).click();
			await expect(deleteEditor).toBeHidden({ timeout: 10_000 });
			await expect(gift(freshSessionPage, 'Pláštěnka')).toHaveCount(0);
		} finally {
			await freshSessionPage.close();
		}

		// Once the permanent list was shared, its recipient may only copy out of it, never move.
		await dismissToasts(page);
		await page.setViewportSize({ width: 390, height: 760 });
		const contextSheet = await openMobileGiftActions(
			page,
			gift(page, 'Termoska na čaj'),
			'Termoska na čaj',
		);
		await contextSheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
		const toolbar = page.getByRole('region', { name: m.gift_selection_toolbar(), exact: true });
		await selectionCount(toolbar, 1);
		await openMobileBulkAction(page, 'copy');
		const copySheet = page.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		await expect(
			copySheet.getByRole('button', { name: m.gift_bulk_copy_confirm() }),
		).toBeEnabled();
		await expect(
			copySheet.getByRole('checkbox', { name: m.gift_bulk_copy_remove_sources() }),
		).toHaveCount(0);
		await expect(page.getByRole('dialog', { name: m.gift_bulk_copy_move_title() })).toHaveCount(
			0,
		);
	} finally {
		await page.context().close();
	}
});

test('lets a správce move gifts out of a permanent wishlist, leaving reserved ones', async ({
	browser,
	request,
	baseURL,
}) => {
	const ownerPage = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('permanent-copy-owner'),
	);
	const gifterCookies = await registerViaApi(
		request,
		baseURL!,
		createTestUser('permanent-copy-gifter'),
	);
	const gifterContext = await createAuthenticatedContext(browser, gifterCookies, baseURL!);
	try {
		// A non-recipient správce may move gifts out even after the list was shared.
		const sourcePath = await createPermanentWishlistAndNavigate(ownerPage, 'Stálý zdroj', {
			recipientName: 'Babička',
		});
		await addGift(ownerPage, 'Kolo pro výlety');
		await addGift(ownerPage, 'Stan pro dva');
		await shareWishlist(ownerPage);

		const gifterPage = await gifterContext.newPage();
		await gifterPage.goto(sourcePath);
		await gift(gifterPage, 'Stan pro dva').getByTestId('reserve-button').first().click();
		const reserveDialog = gifterPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible({ timeout: 5_000 });
		await reserveDialog.getByRole('button', { name: 'Rezervovat', exact: true }).click();
		await expect(reserveDialog).toBeHidden({ timeout: 10_000 });
		await expect(
			gift(gifterPage, 'Stan pro dva').getByTestId('reserve-button').first(),
		).toHaveText(/Zrušit rezervaci/);

		const destinationPath = await createAdditionalWishlist(ownerPage, 'Vánoce');
		await ownerPage.goto(sourcePath);
		await expect(ownerPage.locator('[data-gift-item]')).toHaveCount(2);

		// A non-recipient správce edits a shared permanent list without the recipient warning.
		const editor = await openGiftEditor(ownerPage, 'Kolo pro výlety');
		await editor.locator('#gift-name').fill('Kolo pro výlety do hor');
		await expect(editor.locator('#gift-name')).toHaveValue('Kolo pro výlety do hor');
		await editor.getByRole('button', { name: m.gift_delete() }).click();
		await expect(editor.getByRole('button', { name: m.gift_delete_confirm() })).toBeVisible();
		await expect(ownerPage.getByTestId('recipient-gift-change-warning')).toHaveCount(0);
		await editor.getByRole('button', { name: /^(Zrušit|Cancel)$/ }).click();
		await ownerPage
			.getByRole('dialog', { name: m.wishlist_settings_unsaved_title() })
			.getByRole('button', { name: m.wishlist_settings_discard() })
			.click();
		await expect(editor).toBeHidden();
		await waitForDialogOverlayRemoval(ownerPage);

		await dismissToasts(ownerPage);
		await ownerPage.setViewportSize({ width: 390, height: 760 });

		const contextSheet = await openMobileGiftActions(
			ownerPage,
			gift(ownerPage, 'Kolo pro výlety'),
			'Kolo pro výlety',
		);
		await contextSheet.getByRole('button', { name: /Vybrat více dárků/ }).click();
		const toolbar = ownerPage.getByRole('region', {
			name: m.gift_selection_toolbar(),
			exact: true,
		});
		await gift(ownerPage, 'Stan pro dva').click();
		await selectionCount(toolbar, 2);

		const actionSheet = await openMobileBulkAction(ownerPage, 'copy');
		const copySheet = ownerPage.getByRole('dialog', { name: m.gift_bulk_copy_title() });
		const removeSources = copySheet.getByRole('checkbox', {
			name: m.gift_bulk_copy_remove_sources(),
		});
		const moveSheet = ownerPage.getByRole('dialog', { name: m.gift_bulk_copy_move_title() });
		await expect(removeSources).not.toBeChecked();

		// A cancelled move choice does not carry over to the next opening.
		await removeSources.click();
		await expect(
			moveSheet.getByRole('checkbox', { name: m.gift_bulk_copy_remove_sources() }),
		).toBeChecked();
		await ownerPage.keyboard.press('Escape');
		await expect(moveSheet).toBeHidden();
		await openMobileBulkAction(ownerPage, 'copy');
		await expect(copySheet).toBeVisible();
		await expect(removeSources).not.toBeChecked();
		await expect(moveSheet).toHaveCount(0);

		// Unchecked, the správce copies and the source keeps every gift.
		await copySheet.getByRole('button', { name: m.gift_bulk_copy_confirm() }).click();
		await waitForToast(ownerPage, m.gift_bulk_copy_success({ count: 2 }));
		await expect(ownerPage.locator('[data-gift-item]')).toHaveCount(2);
		await dismissToasts(ownerPage);

		await actionSheet.locator('[data-mobile-bulk-action="copy"]').click();
		await expect(removeSources).not.toBeChecked();
		await removeSources.click();
		await expect(
			moveSheet.getByRole('checkbox', { name: m.gift_bulk_copy_remove_sources() }),
		).toBeChecked();
		await expect(moveSheet.getByText(m.gift_bulk_copy_move_description())).toBeVisible();
		const moveButton = moveSheet.getByRole('button', { name: m.gift_bulk_copy_move_confirm() });
		await expect(moveButton).toBeEnabled();
		await moveButton.click();
		await waitForToast(ownerPage, m.gift_bulk_copy_moved_success({ count: 2, removed: 1 }));

		// The reserved gift stays on the source; the unreserved one left without a reload.
		await expect(ownerPage.locator('[data-gift-item]')).toHaveCount(1);
		await expect(gift(ownerPage, 'Stan pro dva')).toHaveCount(1);
		await expect(gift(ownerPage, 'Kolo pro výlety')).toHaveCount(0);

		// The destination holds the earlier copy and the moved gifts.
		await ownerPage.goto(destinationPath);
		await expect(ownerPage.locator('[data-gift-item]')).toHaveCount(4);
		await expect(gift(ownerPage, 'Kolo pro výlety')).toHaveCount(2);
		await expect(gift(ownerPage, 'Stan pro dva')).toHaveCount(2);
	} finally {
		await gifterContext.close();
		await ownerPage.context().close();
	}
});
