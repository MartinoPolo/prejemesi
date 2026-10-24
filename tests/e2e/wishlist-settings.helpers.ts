import { expect, type Locator, type Page } from '@playwright/test';

/** The Details card form is the only one containing the description textarea. */
export function detailsForm(page: Page) {
	return page.locator('form').filter({ has: page.getByRole('textbox', { name: 'Popis' }) });
}

export function shortIdFromPath(path: string): string {
	const id = path.split('/').filter(Boolean).pop();
	expect(id, 'wishlist short id present in path').toBeTruthy();
	return id!;
}

/** A row of the Kategorie settings list, matched by its current label. */
export function categoryRow(scope: Locator, label: string) {
	return scope.locator(`[data-category-row][data-category-label="${label}"]`);
}

/** Appends a category through the inline „Nová kategorie" row, opening it when closed. */
export async function addCategoryDraft(scope: Locator, label: string) {
	const input = scope.getByRole('textbox', { name: 'Název kategorie' });
	// The row stays open after an add, so exactly one of its input and its opener is shown.
	const newCategoryEntry = input.or(scope.getByRole('button', { name: 'Nová kategorie' }));
	await newCategoryEntry.waitFor();
	// Opens a closed row, or only focuses the input of an open one.
	await newCategoryEntry.click();
	await input.fill(label);
	await scope.getByRole('button', { name: 'Přidat', exact: true }).click();
	await expect(categoryRow(scope, label)).toBeVisible();
}

/** Renames a category through its badge; Enter keeps the new name. */
export async function renameCategoryDraft(scope: Locator, from: string, to: string) {
	const row = categoryRow(scope, from);
	await row.getByRole('button', { name: `Přejmenovat kategorii ${from}` }).click();
	const input = row.getByRole('textbox', { name: 'Název kategorie' });
	await input.fill(to);
	await input.press('Enter');
	await expect(categoryRow(scope, to)).toBeVisible();
}
