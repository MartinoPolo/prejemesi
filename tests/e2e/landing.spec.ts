import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
	test('uses the locale landing URL for canonical and OpenGraph metadata', async ({ page }) => {
		for (const [pathname, canonicalUrl] of [
			['/', 'https://prejemesi.cz'],
			['/en', 'https://prejemesi.cz/en'],
		] as const) {
			await page.goto(pathname);
			await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
				'href',
				canonicalUrl,
			);
			await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
				'content',
				canonicalUrl,
			);
		}
	});

	test('publishes one alternate URL for each supported landing locale and x-default', async ({
		page,
	}) => {
		for (const pathname of ['/', '/en']) {
			await page.goto(pathname);
			for (const [hreflang, href] of [
				['cs', 'https://prejemesi.cz'],
				['en', 'https://prejemesi.cz/en'],
				['x-default', 'https://prejemesi.cz'],
			] as const) {
				const alternate = page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`);
				await expect(alternate).toHaveCount(1);
				await expect(alternate).toHaveAttribute('href', href);
			}
		}
	});

	test('shows hero and navigation', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('překvapením');
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
		await expect(page.getByText('Vy rezervace neuvidíte')).toBeVisible();
	});
});
