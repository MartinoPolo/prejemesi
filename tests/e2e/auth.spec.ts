import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerViaApi, registerAndGetPage } from './fixtures/auth-helpers.js';

test.describe('Authentication', () => {
	test('register with valid credentials redirects to my-lists', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('register');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.goto('/my-lists');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
		await page.context().close();
	});

	test('login with valid credentials', async ({ page, request, baseURL }) => {
		const user = createTestUser('login');
		await registerViaApi(request, baseURL!, user);

		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
		await page.getByRole('textbox', { name: 'Heslo' }).fill(user.password);
		await page.getByRole('button', { name: 'Prihlasit se' }).click();

		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible({
			timeout: 10_000,
		});
	});

	test('login with invalid credentials shows error', async ({ page }) => {
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		await page.getByRole('textbox', { name: 'Email' }).fill('nonexistent@test.cz');
		await page.getByRole('textbox', { name: 'Heslo' }).fill('wrongpassword123');
		await page.getByRole('button', { name: 'Prihlasit se' }).click();

		await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
	});

	test('unauthenticated user redirected from app routes to login', async ({ page }) => {
		await page.goto('/my-lists');
		await expect(page).toHaveURL(/\/login/);
	});

	test('register page shows password strength indicator', async ({ page }) => {
		await page.goto('/register');
		await page.getByRole('textbox', { name: 'Heslo' }).fill('abcdefgh');
		await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 5_000 });
	});

	test('magic link page accessible from login', async ({ page }) => {
		await page.goto('/login');
		await page.getByRole('link', { name: /odkazem/ }).click();
		await expect(page).toHaveURL(/\/magic-link/);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});
});
