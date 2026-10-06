import { test, expect, type Page } from '@playwright/test';
import { waitForAppHydration } from './fixtures/auth-helpers.js';

/**
 * Public entry pages (/ and /login) must not download authenticated app code before user
 * intent (issue #106). Policy and the landing demo exceptions: docs/PERFORMANCE.md.
 *
 * The suite runs against the Vite dev server, which serves source modules unbundled, so
 * request URLs name the exact source files a page pulls in.
 */

// Bounded settle window after hydration: long enough to catch any eager `preloadCode()`
// (which fires right after hydration) and the idle-time preload window, without
// `networkidle` (SSE surfaces hang).
const POST_HYDRATION_SETTLE_MILLISECONDS = 2_500;

// Matched against decoded request URLs.
const FORBIDDEN_MODULE_PATH_FRAGMENTS = [
	'/routes/(app)/', // all authenticated routes: dashboards, settings, /w/ management
	'/lib/modules/import/', // import wizard
	'/lib/modules/wishlists/', // wishlist management module
	'/lib/modules/gifts/', // gift management module
	'/lib/modules/notifications/', // authenticated shell notifications
	// Authenticated app-shell chrome only. NOT the whole navbar/ folder: LogoMark there is a
	// dependency-light shared logo used by the public LandingNav/Footer and the auth pages.
	'/lib/components/blocks/navbar/Navbar.svelte',
	'/lib/components/blocks/navbar/UserMenu.svelte',
	'/lib/components/blocks/navbar/MobileNav.svelte',
	'/lib/components/blocks/navbar/NavDropdown.svelte',
];

// The landing demo (issue #218) server-renders the real gift views so it can never drift from
// the shipped product, which makes these presentation modules public by design. Enumerated
// file by file so management code and every `*.remote.ts` stay forbidden.
const LANDING_DEMO_PUBLIC_MODULE_PATHS = [
	'/lib/modules/gifts/types.ts',
	'/lib/modules/gifts/gift_display.ts',
	'/lib/modules/gifts/gift_display_state.ts',
	'/lib/modules/gifts/gift_url.ts',
	'/lib/modules/gifts/gifts.context.svelte.ts',
	'/lib/modules/gifts/gift_ordering.ts',
	'/lib/modules/wishlists/types.ts',
	'/lib/modules/wishlists/wishlist_capabilities.ts',
	'/lib/modules/wishlists/dashboard_types.ts',
	'/lib/modules/wishlists/event_countdown.ts',
] as const;

// Locale-resilient: the link text differs per locale, but LandingNav always links to a
// path ending in /login (with an optional locale prefix).
function loginLink(page: Page) {
	return page.locator('a[href$="/login"], a[href="/login"]').first();
}

async function collectInitialRequestUrls(
	page: Page,
	path: string,
	readyLocator: (page: Page) => ReturnType<Page['locator']>,
): Promise<string[]> {
	const urls: string[] = [];
	page.on('request', (request) => urls.push(decodeURIComponent(request.url())));

	await page.goto(path);
	await expect(readyLocator(page)).toBeVisible({ timeout: 30_000 });
	await waitForAppHydration(page);
	await page.waitForTimeout(POST_HYDRATION_SETTLE_MILLISECONDS);

	return urls;
}

function findForbiddenRequests(
	urls: readonly string[],
	allowedModulePaths: readonly string[] = [],
): string[] {
	return urls.filter(
		(url) =>
			FORBIDDEN_MODULE_PATH_FRAGMENTS.some((fragment) => url.includes(fragment)) &&
			!allowedModulePaths.some((allowedPath) => url.includes(allowedPath)),
	);
}

test.describe('Public code isolation', () => {
	test('landing page requests no authenticated app code', async ({ page }) => {
		const urls = await collectInitialRequestUrls(page, '/', (p) =>
			p.getByRole('heading', { level: 1 }).first(),
		);

		expect(findForbiddenRequests(urls, LANDING_DEMO_PUBLIC_MODULE_PATHS)).toEqual([]);
	});

	test('login page requests no authenticated app code', async ({ page }) => {
		const urls = await collectInitialRequestUrls(page, '/login', (p) =>
			p.getByRole('textbox', { name: /e-?mail/i }),
		);

		expect(findForbiddenRequests(urls)).toEqual([]);
	});

	test('hover intent preloads the login route code from the landing page', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
			timeout: 30_000,
		});
		// The server-rendered h1 can appear before SvelteKit installs its hover-preload listener,
		// and a fixed delay can still land inside hydration on a busy CI server. Retry the real
		// intent instead; moving away first guarantees a fresh mousemove over the link each time.
		await expect(async () => {
			const loginModuleRequest = page.waitForRequest(
				(request) => decodeURIComponent(request.url()).includes('/routes/(auth)/login/'),
				{ timeout: 5_000 },
			);
			await page.mouse.move(0, 0);
			await loginLink(page).hover();
			await loginModuleRequest;
		}).toPass({ timeout: 30_000, intervals: [250, 500, 1_000] });

		await loginLink(page).click();
		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByRole('textbox', { name: /e-?mail/i })).toBeVisible();
	});
});
