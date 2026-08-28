import { test, expect } from '@playwright/test';

const SEEDED_WISHLIST_PATH = '/w/xmas2026';
const SEEDED_WISHLIST_TITLE = 'Vánoce 2026';
const SEEDED_WISHLIST_DESCRIPTION = 'Seznam přání pro Martin Novák';
const SEEDED_WISHLIST_URL = 'https://prejemesi.cz/w/xmas2026';

test('seeded bearer-link wishlist blocks indexing without breaking social unfurls', async ({
	page,
}) => {
	const response = await page.goto(SEEDED_WISHLIST_PATH);

	expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow, noarchive');

	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
		'content',
		SEEDED_WISHLIST_TITLE,
	);
	await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
		'content',
		SEEDED_WISHLIST_TITLE,
	);
	await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
		'content',
		SEEDED_WISHLIST_DESCRIPTION,
	);
	await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
		'content',
		SEEDED_WISHLIST_DESCRIPTION,
	);
	await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
		'content',
		SEEDED_WISHLIST_URL,
	);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		SEEDED_WISHLIST_URL,
	);
	await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
		'content',
		'summary_large_image',
	);

	const ogImageLocator = page.locator('meta[property="og:image"]');
	const ogImage = await ogImageLocator.getAttribute('content');
	expect(ogImage).toBeTruthy();
	expect(ogImage).toContain('seed/wl-xmas2026.jpg');
	await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', ogImage!);
});

['/w/xmas2026/settings', '/en/w/xmas2026', '/en/w/xmas2026/settings'].forEach((path) => {
	test(`wishlist response blocks indexing directly for ${path}`, async ({ request }) => {
		const response = await request.get(path, { maxRedirects: 0 });

		expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow, noarchive');
	});
});
