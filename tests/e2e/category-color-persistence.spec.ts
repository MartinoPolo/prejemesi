import { test, expect, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

const CATEGORY_NAME = 'Knihy';
const ACCEPTED_COLOR = '#123ABC';

async function openCategorySettings(page: Page): Promise<Locator> {
	const settingsTrigger = page.getByRole('button', { name: 'Nastavení seznamu' });
	await expect(settingsTrigger).toBeVisible();
	await settingsTrigger.click();

	const settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
	await expect(settingsDialog).toBeVisible();
	await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
	await expect(settingsDialog.getByRole('checkbox', { name: CATEGORY_NAME })).toBeChecked();
	return settingsDialog;
}

async function openCategoryColorPicker(settingsDialog: Locator): Promise<Locator> {
	await settingsDialog.getByRole('button', { name: CATEGORY_NAME, exact: true }).click();
	const pickerDialog = settingsDialog.page().getByRole('dialog', { name: CATEGORY_NAME });
	await expect(pickerDialog).toBeVisible();
	return pickerDialog;
}

test('category color persists only after the global settings Save', async ({
	browser,
	request,
	baseURL,
}) => {
	const owner = createTestUser('category-color-persistence');
	const page = await registerAndGetPage(browser, request, baseURL!, owner);
	try {
		const wishlistPath = await createWishlistAndNavigate(page, 'Uložení barvy kategorie');
		const settingsDialog = await openCategorySettings(page);
		const globalSave = settingsDialog.getByRole('button', { name: 'Uložit', exact: true });
		await expect(globalSave).toBeDisabled();

		const pickerDialog = await openCategoryColorPicker(settingsDialog);
		const hexInput = pickerDialog.getByRole('textbox', { name: 'Barva v hex formátu' });
		const baselineColor = await hexInput.inputValue();
		expect(baselineColor.toUpperCase()).not.toBe(ACCEPTED_COLOR);
		await hexInput.fill(ACCEPTED_COLOR);
		await pickerDialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(pickerDialog).not.toBeVisible();
		await expect(globalSave).toBeEnabled();

		const persistedPage = await page.context().newPage();
		await persistedPage.goto(wishlistPath);
		const persistedSettings = await openCategorySettings(persistedPage);
		const persistedPicker = await openCategoryColorPicker(persistedSettings);
		await expect(
			persistedPicker.getByRole('textbox', { name: 'Barva v hex formátu' }),
		).toHaveValue(baselineColor);
		await persistedPicker.getByRole('button', { name: 'Zrušit' }).click();
		await persistedSettings.getByRole('button', { name: 'Zavřít' }).click();
		await expect(persistedSettings).not.toBeVisible();
		await persistedPage.close();

		await expect(settingsDialog).toBeVisible();
		await expect(globalSave).toBeEnabled();
		await globalSave.click();
		await expect(settingsDialog).not.toBeVisible();

		await page.reload();
		const reloadedSettings = await openCategorySettings(page);
		const reloadedPicker = await openCategoryColorPicker(reloadedSettings);
		await expect(
			reloadedPicker.getByRole('textbox', { name: 'Barva v hex formátu' }),
		).toHaveValue(ACCEPTED_COLOR);
	} finally {
		await page.context().close();
	}
});
