import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
	test('shows hero and navigation', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Překvapení');
		await expect(page.getByRole('link', { name: 'Přihlásit se' }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'Registrovat' }).first()).toBeVisible();
	});

	test('CTA navigates to register', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Registrovat' }).first().click();
		await expect(page).toHaveURL(/\/register/);
	});

	test('login link navigates to login', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Přihlásit se' }).first().click();
		await expect(page).toHaveURL(/\/login/);
	});

	test('feature sections are visible', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: /Čtyři kroky/ })).toBeVisible();
		await expect(page.getByText('Tajné rezervace')).toBeVisible();
	});
});
