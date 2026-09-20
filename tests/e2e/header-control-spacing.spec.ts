import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

const VIEWPORTS = [
	{ width: 320, height: 900 },
	{ width: 390, height: 844 },
	{ width: 1024, height: 768 },
	{ width: 1700, height: 900 },
] as const;

const logoName = /^(Přejeme si – domovská stránka|Přejeme si – home)$/;
const notificationName = /^(Upozornění \(|Notifications \()/;
const accountName = /(– menu uživatele|– user menu)$/;

async function box(locator: Locator) {
	return locator.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
	});
}

async function contentEdges(page: Page) {
	return page.locator('.app-content-inner').evaluate((element) => {
		const rect = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		return {
			left: rect.left + Number.parseFloat(style.paddingLeft),
			right: rect.right - Number.parseFloat(style.paddingRight),
		};
	});
}

test('header brand and account align with the shared app-shell content edges', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('header-shell-alignment');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await page.goto('/my-lists');
	await page.waitForSelector('h1');

	for (const viewport of VIEWPORTS) {
		await page.setViewportSize(viewport);
		const edges = await contentEdges(page);
		const logo = await box(page.getByRole('banner').getByRole('link', { name: logoName }));
		const account = await box(
			page.getByRole('banner').getByRole('button', { name: accountName }),
		);

		expect(logo.left, `${viewport.width}px brand edge`).toBeCloseTo(edges.left, 0);
		expect(account.right, `${viewport.width}px account edge`).toBeCloseTo(edges.right, 0);
	}

	await page.context().close();
});

test('wishlist shell uses the same content edges as the header', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('wishlist-shell-alignment');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await createWishlistAndNavigate(page, 'Shell alignment');

	for (const viewport of VIEWPORTS) {
		await page.setViewportSize(viewport);
		const shell = await box(page.getByTestId('wishlist-page-shell'));
		const logo = await box(page.getByRole('banner').getByRole('link', { name: logoName }));
		const account = await box(
			page.getByRole('banner').getByRole('button', { name: accountName }),
		);

		expect(shell.left, `${viewport.width}px wishlist left edge`).toBeCloseTo(logo.left, 0);
		expect(shell.right, `${viewport.width}px wishlist right edge`).toBeCloseTo(
			account.right,
			0,
		);
	}

	await page.context().close();
});

test('notification and account triggers use responsive shared sizing with an 8px peer gap', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('header-trigger-sizing');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await page.goto('/my-lists');
	await page.waitForSelector('h1');
	const header = page.getByRole('banner');

	for (const viewport of [VIEWPORTS[1], VIEWPORTS[2]]) {
		await page.setViewportSize(viewport);
		const notification = await box(header.getByRole('button', { name: notificationName }));
		const account = await box(header.getByRole('button', { name: accountName }));
		const expectedSize = viewport.width < 640 ? 40 : 32;

		expect(notification.width).toBe(expectedSize);
		expect(notification.height).toBe(expectedSize);
		expect(account.width).toBe(expectedSize);
		expect(account.height).toBe(expectedSize);
		expect(account.left - notification.right).toBeCloseTo(8, 0);
	}

	await page.context().close();
});

test('authenticated header keeps all controls visible, keyboard reachable, and inside narrow viewports', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('header-mobile-bounds');
	const page = await registerAndGetPage(browser, request, baseURL!, user);

	const viewport = VIEWPORTS[0];
	await page.setViewportSize(viewport);
	await page.goto('/my-lists');
	await page.waitForSelector('h1');
	const header = page.getByRole('banner');
	const expectedControls = [
		header.getByRole('link', { name: logoName }),
		header.getByRole('button', { name: /^(Otevření menu|Open menu)$/ }),
		header.getByRole('button', { name: /^(Vytvořit|Create)$/ }),
		header.getByRole('button', { name: notificationName }),
		header.getByRole('button', { name: accountName }),
	];
	const visibleHeaderControls = header.locator('a:visible, button:visible');

	for (const control of expectedControls) {
		await expect(control).toBeVisible();
		const controlBox = await box(control);
		expect(controlBox.left).toBeGreaterThanOrEqual(0);
		expect(controlBox.right).toBeLessThanOrEqual(viewport.width);
	}
	expect(
		await visibleHeaderControls.count(),
		`${viewport.width}px header exposes every required keyboard control`,
	).toBe(expectedControls.length);

	for (const control of expectedControls) {
		await page.keyboard.press('Tab');
		await expect(control).toBeFocused();
		const focusTreatment = await control.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				focusVisible: element.matches(':focus-visible'),
				outlineStyle: style.outlineStyle,
				outlineWidth: Number.parseFloat(style.outlineWidth),
				boxShadow: style.boxShadow,
			};
		});
		expect(focusTreatment.focusVisible).toBe(true);
		expect(
			(focusTreatment.outlineStyle !== 'none' && focusTreatment.outlineWidth > 0) ||
				focusTreatment.boxShadow !== 'none',
			'keyboard focus has visible treatment',
		).toBe(true);
	}

	const documentWidth = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
	}));
	expect(documentWidth.scrollWidth).toBeLessThanOrEqual(documentWidth.clientWidth);

	await page.context().close();
});
