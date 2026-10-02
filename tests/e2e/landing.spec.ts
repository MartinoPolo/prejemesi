import { test, expect } from '@playwright/test';
import { createPixelAssertions } from '../helpers/pixel-assertions.mjs';

const pixels = createPixelAssertions(expect);

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

	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 1280, height: 900 },
	]) {
		test(`renders the copy-link demo as one decorative joined field at ${viewport.width}px`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			await page.goto('/');
			const demoField = page.getByTestId('landing-copy-link-demo');
			await demoField.scrollIntoViewIfNeeded();
			await expect(demoField).toBeVisible();

			const geometry = await demoField.evaluate((field) => {
				const segment = field.querySelector<HTMLElement>(
					'[data-slot="input-group-segment"]',
				)!;
				const fieldRect = field.getBoundingClientRect();
				const segmentRect = segment.getBoundingClientRect();
				return {
					border: Number.parseFloat(getComputedStyle(field).borderTopWidth),
					fieldRect: {
						top: fieldRect.top,
						bottom: fieldRect.bottom,
						right: fieldRect.right,
					},
					segmentRect: {
						top: segmentRect.top,
						bottom: segmentRect.bottom,
						right: segmentRect.right,
					},
					segmentShadow: getComputedStyle(segment).boxShadow,
					buttonCount: field.querySelectorAll('button').length,
					scrollWidth: document.documentElement.scrollWidth,
					viewportWidth: window.innerWidth,
				};
			});
			pixels.expectPixelsNear(
				geometry.segmentRect.top,
				geometry.fieldRect.top + geometry.border,
			);
			pixels.expectPixelsNear(
				geometry.segmentRect.bottom,
				geometry.fieldRect.bottom - geometry.border,
			);
			pixels.expectPixelsNear(
				geometry.segmentRect.right,
				geometry.fieldRect.right - geometry.border,
			);
			expect(geometry.segmentShadow).toBe('none');
			expect(geometry.buttonCount).toBe(0);
			pixels.expectPixelsAtMost(geometry.scrollWidth, geometry.viewportWidth, undefined, 0);
			await expect(demoField).toHaveAttribute('aria-hidden', 'true');
		});
	}

	test('keyboard tabbing never lands on the decorative copy-link demo', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByTestId('landing-copy-link-demo')).toBeAttached();
		const visitedElements = new Set<string>();
		for (let tabIndex = 0; tabIndex < 200; tabIndex += 1) {
			await page.keyboard.press('Tab');
			const focused = await page.evaluate(() => {
				const active = document.activeElement;
				if (!active || active === document.body) {
					return null;
				}
				return {
					insideDemo: active.closest('[data-testid="landing-copy-link-demo"]') !== null,
					description: `${active.tagName}:${active.textContent?.trim().slice(0, 40)}:${
						active.getAttribute('href') ?? ''
					}:${Array.from(document.querySelectorAll('*')).indexOf(active)}`,
				};
			});
			if (focused === null) {
				continue;
			}
			expect(focused.insideDemo, focused.description).toBe(false);
			if (visitedElements.has(focused.description)) {
				break;
			}
			visitedElements.add(focused.description);
		}
		expect(visitedElements.size).toBeGreaterThan(0);
	});

	test.describe('narrow viewport without JavaScript', () => {
		test.use({ viewport: { width: 375, height: 812 }, javaScriptEnabled: false });

		test('English landing page does not scroll horizontally', async ({ page }) => {
			await page.goto('/en');
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
			const widths = await page.evaluate(async () => {
				await document.fonts.ready;
				return {
					scrollWidth: document.documentElement.scrollWidth,
					viewportWidth: window.innerWidth,
				};
			});
			pixels.expectPixelsAtMost(
				widths.scrollWidth,
				widths.viewportWidth,
				'landing page fits the mobile viewport',
				0,
			);
		});
	});
});
