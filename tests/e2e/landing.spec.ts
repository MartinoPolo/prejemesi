import { test, expect } from '@playwright/test';

const LANDING_LOCALES = [
	{ pathname: '/', canonicalUrl: 'https://prejemesi.cz' },
	{ pathname: '/en', canonicalUrl: 'https://prejemesi.cz/en' },
] as const;

const LANDING_ALTERNATES = [
	{ hreflang: 'cs', href: 'https://prejemesi.cz' },
	{ hreflang: 'en', href: 'https://prejemesi.cz/en' },
	{ hreflang: 'x-default', href: 'https://prejemesi.cz' },
] as const;

test.describe('Landing page', () => {
	test('publishes canonical OpenGraph and alternate URLs for each locale', async ({ page }) => {
		for (const { pathname, canonicalUrl } of LANDING_LOCALES) {
			await page.goto(pathname);
			await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
				'href',
				canonicalUrl,
			);
			await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
				'content',
				canonicalUrl,
			);

			for (const { hreflang, href } of LANDING_ALTERNATES) {
				const alternate = page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`);
				await expect(alternate).toHaveCount(1);
				await expect(alternate).toHaveAttribute('href', href);
			}
		}
	});

	test('shows the landing journey and links its primary actions to auth destinations', async ({
		page,
	}) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('překvapením');
		await expect(page.getByRole('heading', { name: /Čtyři kroky/ })).toBeVisible();
		await expect(page.getByText('Vy rezervace neuvidíte')).toBeVisible();

		const createLinks = page.getByRole('link', { name: 'Vytvořit seznam' });
		await expect(createLinks).toHaveCount(2);
		for (const createLink of await createLinks.all()) {
			await expect(createLink).toHaveAttribute('href', '/register');
		}
		const loginLink = page.getByRole('link', { name: 'Přihlásit se' }).first();
		await expect(loginLink).toHaveAttribute('href', '/login');

		await createLinks.first().click();
		await expect(page).toHaveURL(/\/register\/?$/);

		await page.goto('/');
		await page.getByRole('link', { name: 'Přihlásit se' }).first().click();
		await expect(page).toHaveURL(/\/login\/?$/);
	});
});
