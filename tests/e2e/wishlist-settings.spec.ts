import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';

/** The Details card form is the only one containing the "Popis" (description) textarea. */
function detailsForm(page: Page) {
	return page.locator('form').filter({ has: page.getByRole('textbox', { name: 'Popis' }) });
}

function shortIdFromPath(path: string): string {
	const id = path.split('/').filter(Boolean).pop();
	expect(id, 'wishlist short id present in path').toBeTruthy();
	return id!;
}

test.describe('Wishlist settings — non-image editing', () => {
	test('owner can edit title, description, and event date, and changes persist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-owner-edit');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		const path = await createWishlistAndNavigate(page, 'Detaily před úpravou');
		const shortId = shortIdFromPath(path);

		await page.goto(`/w/${shortId}/settings`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

		// The event date is a DatePicker popover (not a native input). Pick a deterministic
		// date 3 months out so the calendar — which opens on the current month — needs a fixed
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

		// Changes survive a full reload / fresh SSR render.
		await page.reload();
		await page.waitForLoadState('networkidle');

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

		// Direct navigation to the settings URL shows the owner-only notice, not the edit form.
		await visitorPage.goto(`/w/${shortId}/settings`);
		await visitorPage.waitForLoadState('networkidle');
		await expect(
			visitorPage.getByText('Nastavení seznamu může upravovat pouze vlastník.'),
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

		// Archiving triggers a native confirm() dialog — auto-accept it.
		page.on('dialog', (dialog) => void dialog.accept());
		await page.getByRole('button', { name: 'Archivovat seznam' }).click();
		await expect(
			page.locator('[data-sonner-toast]').filter({ hasText: 'Seznam byl archivován' }),
		).toBeVisible({ timeout: 10_000 });

		// The settings page surfaces a read-only notice and hides the edit form.
		await page.goto(`/w/${shortId}/settings`);
		await page.waitForLoadState('networkidle');
		await expect(
			page.getByText('Tento seznam je archivovaný a nelze jej upravovat.'),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('textbox', { name: 'Popis' })).not.toBeVisible();

		await page.context().close();
	});
});
