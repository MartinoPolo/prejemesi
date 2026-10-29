import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';
import {
	addCategoryDraft,
	categoryRow,
	detailsForm,
	renameCategoryDraft,
	shortIdFromPath,
} from './wishlist-settings.helpers.js';

test.describe('Wishlist settings – details and categories', () => {
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
		const settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await expect(settingsDialog).toBeVisible({ timeout: 10_000 });

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

		// Save lives in the fixed dialog footer, outside the scrolling details form.
		const saveButton = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(form.getByRole('button', { name: 'Uložit' })).toHaveCount(0);
		await settingsDialog.locator('.overflow-y-auto').evaluate((content) => {
			content.scrollTop = content.scrollHeight;
		});
		await expect(saveButton).toBeVisible();
		await saveButton.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });

		// Changes survive a full reload / fresh SSR render. The redirect stripped the
		// ?settings marker, so reopen the modal from the toolbar's settings action.
		await page.reload();
		const settingsAction = page.getByRole('button', { name: 'Nastavení seznamu' });
		await expect(settingsAction).toBeVisible({ timeout: 10_000 });
		await settingsAction.click();
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

	test('new custom category is available in Add gift without reloading', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-category-live-refresh');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		const categoryLabel = 'Vizuální kategorie';

		await createWishlistAndNavigate(page, 'Kategorie bez obnovení');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		const settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();

		await expect(categoryRow(settingsDialog, 'Knihy')).toBeVisible();
		await addCategoryDraft(settingsDialog, categoryLabel);
		await settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' })
			.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });

		await page
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const giftDialog = page.getByRole('dialog');
		await giftDialog.getByRole('button', { name: 'Bez kategorie' }).click();
		await expect(page.getByRole('option', { name: categoryLabel, exact: true })).toBeVisible();

		await page.context().close();
	});

	test('custom category labels can be swapped atomically and persist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-category-label-swap');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Prohození kategorií');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		let settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();

		await addCategoryDraft(settingsDialog, 'Kategorie Alfa');
		await addCategoryDraft(settingsDialog, 'Kategorie Beta');
		const firstSave = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(firstSave).toBeEnabled();
		await firstSave.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 15_000 });
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();

		const alfaId = await categoryRow(settingsDialog, 'Kategorie Alfa').getAttribute(
			'data-category-id',
		);
		const betaId = await categoryRow(settingsDialog, 'Kategorie Beta').getAttribute(
			'data-category-id',
		);
		expect(alfaId).toBeTruthy();
		expect(betaId).toBeTruthy();
		// The list rejects a name another category still holds, so the swap passes through a
		// temporary name; the server receives both final labels in one save.
		await renameCategoryDraft(settingsDialog, 'Kategorie Alfa', 'Kategorie Gama');
		await renameCategoryDraft(settingsDialog, 'Kategorie Beta', 'Kategorie Alfa');
		await renameCategoryDraft(settingsDialog, 'Kategorie Gama', 'Kategorie Beta');
		const swapSave = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(swapSave).toBeEnabled();
		await swapSave.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });

		await page.reload();
		const settingsAction = page.getByRole('button', { name: 'Nastavení seznamu' });
		await expect(settingsAction).toBeVisible({ timeout: 10_000 });
		await settingsAction.click();
		settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
		await expect(settingsDialog.locator(`[data-category-id="${alfaId}"]`)).toHaveAttribute(
			'data-category-label',
			'Kategorie Beta',
		);
		await expect(settingsDialog.locator(`[data-category-id="${betaId}"]`)).toHaveAttribute(
			'data-category-label',
			'Kategorie Alfa',
		);

		await page.context().close();
	});

	test('a keyboard reorder and a preset rename persist in one save', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-category-reorder-rename');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		const otherDefaults = [
			'Oblečení',
			'Elektronika',
			'Domácnost',
			'Zážitky',
			'Předplatné',
			'Drogerie',
		];

		await createWishlistAndNavigate(page, 'Pořadí kategorií');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		let settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
		const rowLabels = (dialog: typeof settingsDialog) =>
			dialog
				.locator('[data-category-row]')
				.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-category-label')));
		await expect
			.poll(() => rowLabels(settingsDialog))
			.toEqual(['Hry', 'Hračky', 'Knihy', ...otherDefaults]);

		const booksGrip = settingsDialog.getByRole('button', { name: 'Přesunout kategorii Knihy' });
		await expect(booksGrip).toBeEnabled();
		await booksGrip.focus();
		await page.keyboard.press('ArrowUp');
		await expect(booksGrip).toBeFocused();
		await page.keyboard.press('ArrowUp');
		await expect
			.poll(() => rowLabels(settingsDialog))
			.toEqual(['Knihy', 'Hry', 'Hračky', ...otherDefaults]);
		await renameCategoryDraft(settingsDialog, 'Knihy', 'Četba');
		const save = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(save).toBeEnabled();
		await save.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });

		await page.reload();
		const settingsAction = page.getByRole('button', { name: 'Nastavení seznamu' });
		await expect(settingsAction).toBeVisible({ timeout: 10_000 });
		await settingsAction.click();
		settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
		await expect
			.poll(() => rowLabels(settingsDialog))
			.toEqual(['Četba', 'Hry', 'Hračky', ...otherDefaults]);

		await page.context().close();
	});

	test('confirmed category removal leaves its assigned gift uncategorized', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-category-removal');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		const giftName = 'Dárek v odebírané kategorii';
		const categoryLabel = 'Dočasná kategorie';

		await createWishlistAndNavigate(page, 'Odebrání přiřazené kategorie');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		let settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
		await addCategoryDraft(settingsDialog, categoryLabel);
		// A default category stays so the gift editor can visibly render „Bez kategorie"
		// after the custom category is removed.
		await expect(categoryRow(settingsDialog, 'Knihy')).toBeVisible();
		const categoryCreateSave = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(categoryCreateSave).toBeEnabled();
		await categoryCreateSave.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });

		await page
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		let giftDialog = page.getByRole('dialog');
		await giftDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);
		await giftDialog.getByRole('button', { name: 'Bez kategorie' }).click();
		await page.getByRole('option', { name: categoryLabel }).click();
		await giftDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(giftDialog).not.toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('heading', { name: giftName, level: 3 })).toBeVisible();

		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
		const usedCategory = categoryRow(settingsDialog, categoryLabel);
		await expect(usedCategory.getByTestId('gift-category-used-count')).toHaveText('Použito: 1');
		await usedCategory
			.getByRole('button', { name: `Odebrat kategorii ${categoryLabel}` })
			.click();
		await expect(usedCategory.getByTestId('gift-category-removal-note')).toHaveText(
			'Při uložení se odebere z 1 přání.',
		);
		await expect(usedCategory.getByRole('button', { name: 'Vrátit' })).toBeVisible();
		const categoryRemoveSave = settingsDialog
			.locator('[data-slot="dialog-footer"]')
			.getByRole('button', { name: 'Uložit' });
		await expect(categoryRemoveSave).toBeEnabled();
		await categoryRemoveSave.click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });
		await page.reload();

		await page.getByText(giftName, { exact: true }).click();
		giftDialog = page.getByRole('dialog');
		await expect(giftDialog.getByRole('button', { name: 'Bez kategorie' })).toBeVisible();

		await page.context().close();
	});
});
