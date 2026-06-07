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

		const form = detailsForm(page);
		await form.getByRole('textbox', { name: 'Název' }).fill('Detaily po úpravě');
		await form.getByRole('textbox', { name: 'Popis' }).fill('Popis seznamu darů');
		await form.getByLabel('Datum události (volitelné)').fill('2026-12-24');
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
		await expect(reloaded.getByLabel('Datum události (volitelné)')).toHaveValue('2026-12-24');

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
