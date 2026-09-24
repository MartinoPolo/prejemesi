import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

test.describe('Dashboard', () => {
	test('shows empty state for new user', async ({ browser, request, baseURL }) => {
		const user = createTestUser('dash-empty');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Zatím žádné seznamy' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Vytvořit seznam' })).toBeVisible();

		await page.context().close();
	});
});
