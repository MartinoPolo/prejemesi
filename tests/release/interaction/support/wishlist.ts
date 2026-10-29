import { expect, type Locator, type Page } from '@playwright/test';
import * as m from '../../../../src/lib/paraglide/messages.js';
import { waitForAppHydration } from '../../../e2e/fixtures/auth-helpers.js';
import { waitForDialogOverlayRemoval } from '../../../e2e/fixtures/wishlist-helpers.js';

export interface FixtureGift {
	name: string;
	priority?: string;
	link?: string;
	/** Several categories, in order; the first is the primary one. */
	categories?: readonly string[];
}

/** Adds a gift through the editor, which the shared e2e helper offers only with one category. */
export async function addFixtureGift(page: Page, gift: FixtureGift): Promise<void> {
	await page
		.getByRole('button', { name: /Přidat/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await dialog.getByRole('textbox', { name: 'Název' }).fill(gift.name);
	if (gift.link !== undefined) {
		await dialog.getByRole('button', { name: 'Přidat odkaz' }).click();
		await dialog.getByTestId('gift-link-url').fill(gift.link);
	}
	if (gift.priority !== undefined) {
		await dialog.getByRole('button', { name: 'Bez priority' }).click();
		await page.getByRole('option', { name: gift.priority, exact: true }).click();
	}
	if (gift.categories !== undefined) {
		await dialog.getByTestId('gift-category-select').click();
		for (const category of gift.categories) {
			await page.getByRole('option', { name: category, exact: true }).click();
		}
		await page.keyboard.press('Escape');
		await expect(page.getByRole('listbox')).toHaveCount(0);
		await expect(dialog.getByTestId('gift-category-chips').getByRole('listitem')).toHaveCount(
			gift.categories.length,
		);
	}
	await dialog.getByRole('button', { name: 'Přidat dárek' }).click();
	await expect(dialog).toBeHidden({ timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
	await expect(page.getByRole('heading', { name: gift.name, level: 3 })).toBeVisible();
}

export function settingsDialog(page: Page): Locator {
	return page.getByRole('dialog', { name: m.wishlist_settings_title() });
}

export function saveButton(page: Page): Locator {
	return page.getByTestId('wishlist-settings-save');
}

const SETTINGS_TABS = {
	categories: () => m.wishlist_settings_categories_tab(),
	image: () => m.wishlist_settings_image_section(),
	appearance: () => m.wishlist_settings_appearance_tab(),
};

export type SettingsTab = keyof typeof SETTINGS_TABS;

export async function openSettingsTab(page: Page, wishlistPath: string, tab: SettingsTab) {
	const settingsTrigger = page.getByRole('button', {
		name: m.wishlist_settings_title(),
		exact: true,
	});
	if (new URL(page.url()).pathname === wishlistPath && (await settingsTrigger.isVisible())) {
		// Reopening in place is much faster than loading the page again.
		await settingsTrigger.click();
		await settingsDialog(page).getByRole('tab', { name: SETTINGS_TABS[tab]() }).click();
	} else {
		await page.goto(`${wishlistPath}?settings=${tab}`);
		await waitForAppHydration(page);
		await page.waitForURL((url) => !url.searchParams.has('settings'));
	}
	await expect(settingsDialog(page)).toBeVisible();
}

/** Closes a dirty draft through the unsaved-changes guard, discarding it. */
async function discardDraft(page: Page) {
	await settingsDialog(page).getByRole('button', { name: m.close() }).click();
	await page.getByRole('button', { name: m.wishlist_settings_discard() }).click();
	await expect(settingsDialog(page)).toBeHidden();
}

/** Shows `tab` with the saved settings: a dirty draft is discarded and a closed dialog reopened. */
export async function showSavedSettings(page: Page, wishlistPath: string, tab: SettingsTab) {
	if ((await settingsDialog(page).isVisible()) && (await saveButton(page).isEnabled())) {
		await discardDraft(page);
	}
	if (!(await settingsDialog(page).isVisible())) {
		await openSettingsTab(page, wishlistPath, tab);
	}
	await expect(saveButton(page), 'the case starts from the saved settings').toBeDisabled();
}
