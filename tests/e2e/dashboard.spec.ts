import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

test.describe('Dashboard', () => {
	test('shows empty state for new user', async ({ browser, request, baseURL }) => {
		const user = createTestUser('dash-empty');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
		await expect(page.getByText('Zatím žádné seznamy')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Vytvořit seznam' })).toBeVisible();

		await page.context().close();
	});

	test('create wishlist via modal and see it on dashboard', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('dash-create');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
		await page.getByRole('button', { name: 'Vytvořit seznam' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('textbox', { name: 'Nazev' }).fill('Vanoce 2026');
		await dialog.getByRole('button', { name: 'Vytvorit' }).click();

		await expect(page.getByRole('heading', { level: 1, name: 'Vanoce 2026' })).toBeVisible({
			timeout: 10_000,
		});

		await page.context().close();
	});

	test('view mode switcher works', async ({ browser, request, baseURL }) => {
		const user = createTestUser('dash-views');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
		const gridButton = page.getByRole('button', { name: 'Mřížka karet' });
		const listButton = page.getByRole('button', { name: 'Seznam', exact: true });

		await expect(gridButton).toHaveAttribute('aria-pressed', 'true');

		await listButton.click();
		await expect(listButton).toHaveAttribute('aria-pressed', 'true');
		await expect(gridButton).toHaveAttribute('aria-pressed', 'false');

		await page.context().close();
	});
});
