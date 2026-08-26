import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	addGift,
	shareWishlist,
	archiveWishlist,
} from './fixtures/wishlist-helpers.js';

/** The Details card form is the only one containing the "Popis" (description) textarea. */
function detailsForm(page: Page) {
	return page.locator('form').filter({ has: page.getByRole('textbox', { name: 'Popis' }) });
}

function shortIdFromPath(path: string): string {
	const id = path.split('/').filter(Boolean).pop();
	expect(id, 'wishlist short id present in path').toBeTruthy();
	return id!;
}

test.describe('Wishlist settings – non-image editing', () => {
	test('owner can edit title, description, and event date, and changes persist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-owner-edit');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		const path = await createWishlistAndNavigate(page, 'Detaily před úpravou');
		const shortId = shortIdFromPath(path);

		// The legacy settings URL redirects to the wishlist page and opens the settings modal.
		await page.goto(`/w/${shortId}/settings`);
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

		// The event date is a DatePicker popover (not a native input). Pick a deterministic
		// date 3 months out so the calendar – which opens on the current month – needs a fixed
		// number of "next month" steps regardless of when the suite runs.
		const eventDate = new Date();
		eventDate.setDate(1); // avoid month-length rollover when advancing the month
		eventDate.setMonth(eventDate.getMonth() + 3);
		eventDate.setDate(15);
		const eventDayLabel = String(eventDate.getDate());
		const expectedEventDate = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long' }).format(
			eventDate,
		);
		const monthsToAdvance = 3;

		const form = detailsForm(page);
		await form.getByRole('textbox', { name: 'Název' }).fill('Detaily po úpravě');
		await form.getByRole('textbox', { name: 'Popis' }).fill('Popis seznamu darů');

		const eventDateField = form.getByLabel('Datum události (volitelné)');
		await eventDateField.click();
		const calendarPopover = page.locator('[data-slot="popover-content"]');
		await expect(calendarPopover).toBeVisible({ timeout: 5_000 });
		for (let i = 0; i < monthsToAdvance; i++) {
			await calendarPopover.getByRole('button', { name: 'Next' }).click();
		}
		await calendarPopover
			.locator('[data-bits-day]:not([data-outside-month])', {
				hasText: new RegExp(`^${eventDayLabel}$`),
			})
			.first()
			.click();
		// Selecting a day closes the popover; the trigger now shows the localized long date.
		await expect(eventDateField).toContainText(expectedEventDate);

		await form.getByRole('button', { name: 'Uložit' }).click();

		await expect(page.getByText('Podrobnosti seznamu byly uloženy')).toBeVisible({
			timeout: 10_000,
		});

		// Changes survive a full reload / fresh SSR render. The redirect stripped the
		// ?settings marker, so reopen the modal from the toolbar's settings action.
		await page.reload();
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

		const reloaded = detailsForm(page);
		await expect(reloaded.getByRole('textbox', { name: 'Název' })).toHaveValue(
			'Detaily po úpravě',
		);
		await expect(reloaded.getByRole('textbox', { name: 'Popis' })).toHaveValue(
			'Popis seznamu darů',
		);
		await expect(reloaded.getByLabel('Datum události (volitelné)')).toContainText(
			expectedEventDate,
		);

		await page.context().close();
	});

	test('manager import and export actions live in settings instead of the toolbar', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-data-actions');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Datové akce');
		await addGift(page, 'Dárek pro export');

		await expect(page.getByRole('button', { name: 'Importovat z tabulky' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Exportovat do tabulky' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Barevná paleta seznamu' })).toHaveCount(0);

		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		const settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await expect(settingsDialog).toBeVisible({ timeout: 10_000 });
		await expect(settingsDialog.getByText('Import a export')).toBeVisible();

		const downloadPromise = page.waitForEvent('download');
		await settingsDialog.getByRole('button', { name: 'Exportovat do tabulky' }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/\.csv$/);

		await settingsDialog.getByRole('button', { name: 'Importovat z tabulky' }).click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 5_000 });
		await expect(page.getByRole('dialog', { name: 'Importovat dárky' })).toBeVisible({
			timeout: 10_000,
		});

		await page.context().close();
	});

	test('non-owner cannot use the settings action and cannot edit via direct URL', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-owner');
		const visitor = createTestUser('settings-visitor');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		const path = await createWishlistAndNavigate(ownerPage, 'Cizí seznam');
		const shortId = shortIdFromPath(path);
		await addGift(ownerPage, 'Test Gift');
		await shareWishlist(ownerPage);

		const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
		await visitorPage.goto(path);
		await visitorPage.waitForLoadState('networkidle');
		await expect(visitorPage.getByRole('heading', { level: 1 })).toContainText('Cizí seznam', {
			timeout: 10_000,
		});

		// The owner-only settings action must not be visible to a visitor.
		await expect(
			visitorPage.getByRole('button', { name: 'Nastavení seznamu' }),
		).not.toBeVisible();

		// Direct navigation to the legacy settings URL redirects to the wishlist page and opens
		// the settings modal, which shows the manager-only notice instead of the edit form.
		// wishlist_settings_owner_only was reworded from „…pouze vlastník" to the obdarovaný/správce
		// wording („…pouze obdarovaný nebo správce." / „Only the recipient or a manager can edit …").
		await visitorPage.goto(`/w/${shortId}/settings`);
		await visitorPage.waitForLoadState('networkidle');
		await expect(
			visitorPage.getByText(
				/Nastavení seznamu může upravovat pouze obdarovaný nebo správce\.|Only the recipient or a manager can edit the wishlist settings\./,
			),
		).toBeVisible({ timeout: 10_000 });
		await expect(visitorPage.getByRole('textbox', { name: 'Popis' })).not.toBeVisible();

		await ownerPage.context().close();
		await visitorPage.context().close();
	});

	test('archived wishlist cannot be edited from the settings UI', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-archived');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		const path = await createWishlistAndNavigate(page, 'Archivovaný seznam');
		const shortId = shortIdFromPath(path);

		await archiveWishlist(page);
		await expect(
			page.locator('[data-sonner-toast]').filter({ hasText: 'Seznam byl archivován' }),
		).toBeVisible({ timeout: 10_000 });

		// The settings modal (via the legacy URL redirect) surfaces a read-only notice
		// and hides the edit form.
		await page.goto(`/w/${shortId}/settings`);
		await page.waitForLoadState('networkidle');
		await expect(
			page.getByText('Tento seznam je archivovaný a nelze jej upravovat.'),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('textbox', { name: 'Popis' })).not.toBeVisible();

		await page.context().close();
	});
});
