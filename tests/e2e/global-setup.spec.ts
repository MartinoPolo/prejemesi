import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerViaApi, createAuthenticatedContext } from './fixtures/auth-helpers.js';

test('warmup: compile all route modules', async ({ page, request, browser }) => {
	const baseURL = 'http://localhost:5173';

	await page.goto('/');
	await page.waitForLoadState('networkidle');

	await page.goto('/register');
	await page.waitForLoadState('networkidle');

	await page.goto('/login');
	await page.waitForLoadState('networkidle');

	const user = createTestUser('warmup');
	const cookies = await registerViaApi(request, baseURL, user);
	const ctx = await createAuthenticatedContext(browser, cookies, baseURL);
	const authPage = await ctx.newPage();

	await authPage.goto('/my-lists');
	await authPage.waitForLoadState('networkidle');
	await expect(authPage.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();

	await ctx.close();
});
