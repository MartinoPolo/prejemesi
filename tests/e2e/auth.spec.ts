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
		await page.getByRole('textbox', { name: 'E-mail' }).fill(user.email);
		await page.getByRole('textbox', { name: 'Heslo' }).fill(user.password);
		await page.getByRole('button', { name: 'Přihlásit se', exact: true }).click();

		// Post-login default redirect now lands on the „Přehled" overview at /home (issue #225),
		// no longer /my-lists.
		await expect(page).toHaveURL(/\/home\/?$/);
		await expect(page.getByRole('heading', { name: 'Přehled', level: 1 })).toBeVisible({
			timeout: 10_000,
		});
	});

	test('login with invalid credentials shows error', async ({ page }) => {
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		await page.getByRole('textbox', { name: 'E-mail' }).fill('nonexistent@test.cz');
		await page.getByRole('textbox', { name: 'Heslo' }).fill('wrongpassword123');
		await page.getByRole('button', { name: 'Přihlásit se', exact: true }).click();

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
		// The anime-sky split-screen auth layout (#102, REQ-16) renders two h1s: the brand
		// panel tagline and the form heading. Assert the form heading specifically.
		await expect(
			page.getByRole('heading', { level: 1, name: 'Přihlášení odkazem' }),
		).toBeVisible();
	});

	for (const protectedRequest of [
		{
			name: 'registration',
			path: '/api/auth/sign-up/email',
			data: {
				name: 'Turnstile Test',
				email: 'turnstile-register@test.cz',
				password: 'password123',
			},
		},
		{
			name: 'magic link',
			path: '/api/auth/sign-in/magic-link',
			data: { email: 'turnstile-magic@test.cz', callbackURL: '/my-lists' },
		},
		{
			name: 'password reset request',
			path: '/api/auth/request-password-reset',
			data: { email: 'turnstile-reset@test.cz', redirectTo: '/reset-password' },
		},
	] as const) {
		test(`${protectedRequest.name} rejects a missing Turnstile token`, async ({
			request,
			baseURL,
		}) => {
			const response = await request.post(`${baseURL}${protectedRequest.path}`, {
				headers: { Origin: baseURL! },
				data: protectedRequest.data,
			});

			expect(response.status()).toBe(400);
			expect(await response.text()).toContain('Missing CAPTCHA response');
		});
	}
});
