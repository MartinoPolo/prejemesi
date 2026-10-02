import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage, waitForAppHydration } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';
import { createPixelAssertions } from '../helpers/pixel-assertions.mjs';

const { expectPixelsAtLeast, expectPixelsAtMost, expectPixelsNear } = createPixelAssertions(expect);

const VIEWPORTS = [
	{ width: 320, height: 900 },
	{ width: 390, height: 844 },
	{ width: 640, height: 900 },
	{ width: 767, height: 900 },
	{ width: 768, height: 900 },
	{ width: 1024, height: 768 },
	{ width: 1700, height: 900 },
] as const;

const logoName = /^(Přejeme si – domovská stránka|Přejeme si – home)$/;
const notificationName = /^(Upozornění \(|Notifications \()/;
const accountName = /(– menu uživatele|– user menu)$/;
const menuName = /^(Otevření menu|Open menu)$/;

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
		const header = page.getByRole('banner');
		const leadingControl =
			viewport.width < 768
				? header.getByRole('button', { name: menuName })
				: header.getByRole('link', { name: logoName });
		const leading = await box(leadingControl);
		const account = await box(header.getByRole('button', { name: accountName }));

		expectPixelsNear(leading.left, edges.left, `${viewport.width}px leading edge`);
		expectPixelsNear(account.right, edges.right, `${viewport.width}px account edge`);
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
		const header = page.getByRole('banner');
		const leadingControl =
			viewport.width < 768
				? header.getByRole('button', { name: menuName })
				: header.getByRole('link', { name: logoName });
		const leading = await box(leadingControl);
		const account = await box(header.getByRole('button', { name: accountName }));

		expectPixelsNear(shell.left, leading.left, `${viewport.width}px wishlist left edge`);
		expectPixelsNear(shell.right, account.right, `${viewport.width}px wishlist right edge`);
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

	for (const viewport of [VIEWPORTS[1], VIEWPORTS[4]]) {
		await page.setViewportSize(viewport);
		const notification = await box(header.getByRole('button', { name: notificationName }));
		const accountTrigger = header.getByRole('button', { name: accountName });
		const account = await box(accountTrigger);
		const avatarGeometry = await accountTrigger.evaluate((element) => {
			const surface = element.querySelector('.elevation-surface')!;
			const avatar = element.querySelector('[data-slot="avatar"]')!;
			const surfaceRect = surface.getBoundingClientRect();
			const avatarRect = avatar.getBoundingClientRect();
			return {
				border: Number.parseFloat(getComputedStyle(surface).borderLeftWidth),
				left: avatarRect.left - surfaceRect.left,
				top: avatarRect.top - surfaceRect.top,
				right: surfaceRect.right - avatarRect.right,
				bottom: surfaceRect.bottom - avatarRect.bottom,
			};
		});
		for (const edge of ['left', 'top', 'right', 'bottom'] as const) {
			expectPixelsNear(
				avatarGeometry[edge],
				avatarGeometry.border,
				`avatar ${edge} meets border`,
			);
		}
		const expectedSize = viewport.width < 640 ? 40 : 32;

		expectPixelsNear(notification.width, expectedSize);
		expectPixelsNear(notification.height, expectedSize);
		expectPixelsNear(account.width, expectedSize);
		expectPixelsNear(account.height, expectedSize);
		expectPixelsNear(account.left - notification.right, 8);
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
		header.getByRole('button', { name: menuName }),
		header.getByRole('link', { name: logoName }),
		header.getByRole('button', { name: /^(Vytvořit|Create)$/ }),
		header.getByRole('button', { name: notificationName }),
		header.getByRole('button', { name: accountName }),
	];
	const visibleHeaderControls = header.locator('a:visible, button:visible');

	for (const control of expectedControls) {
		await expect(control).toBeVisible();
		const controlBox = await box(control);
		expectPixelsAtLeast(controlBox.left, 0);
		expectPixelsAtMost(controlBox.right, viewport.width);
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

	for (const mobileViewport of VIEWPORTS.filter(({ width }) => width < 768)) {
		await page.setViewportSize(mobileViewport);
		await page.evaluate(() => document.fonts.ready);
		const edges = await contentEdges(page);
		const controls = await Promise.all(expectedControls.map(box));
		expectPixelsNear(controls[0]!.left, edges.left, `${mobileViewport.width}px menu edge`);
		expectPixelsAtLeast(controls[1]!.left, controls[0]!.right, 'brand follows menu');
		await expect(header.locator('.logo-text')).toBeVisible();
		if (mobileViewport.width < 640) {
			const markSize = await header.locator('.logo-icon-wrap').evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					width: Number.parseFloat(style.width),
					height: Number.parseFloat(style.height),
				};
			});
			expectPixelsNear(markSize.width, 40);
			expectPixelsNear(markSize.height, 40);
		}
		expectPixelsAtLeast(controls[2]!.left, controls[1]!.right, 'actions follow brand');
		for (let index = 0; index < controls.length; index += 1) {
			expectPixelsAtMost(controls[index]!.right, mobileViewport.width);
			if (index > 0) {
				expectPixelsAtLeast(controls[index]!.left, controls[index - 1]!.right);
			}
		}
		expect(
			await header
				.getByRole('button', { name: menuName })
				.evaluate((element) =>
					Boolean(
						element.compareDocumentPosition(
							element.closest('header')!.querySelector('a.logo')!,
						) & Node.DOCUMENT_POSITION_FOLLOWING,
					),
				),
			'menu precedes logo in DOM order',
		).toBe(true);
		const documentWidth = await page.evaluate(() => ({
			scrollWidth: document.documentElement.scrollWidth,
			clientWidth: document.documentElement.clientWidth,
		}));
		expect(documentWidth.scrollWidth).toBeLessThanOrEqual(documentWidth.clientWidth);
	}

	await page.context().close();
});

test('mobile drawer opens and navigates; desktop keeps brand first and menu hidden', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('header-drawer'),
	);
	await page.setViewportSize(VIEWPORTS[1]);
	await page.goto('/my-lists');
	await page.waitForSelector('h1');
	const header = page.getByRole('banner');
	await waitForAppHydration(page);
	await header.getByRole('button', { name: menuName }).click();
	const drawer = page.getByRole('dialog');
	await expect(drawer.getByRole('link', { name: /^(Přehled|Overview)$/ })).toBeVisible();
	await drawer.getByRole('link', { name: /^(Přehled|Overview)$/ }).click();
	await expect(page).toHaveURL(/\/home$/);
	await page.setViewportSize(VIEWPORTS[4]);
	await expect(header.getByRole('button', { name: menuName })).toBeHidden();
	const brand = await box(header.getByRole('link', { name: logoName }));
	const edges = await contentEdges(page);
	expectPixelsNear(brand.left, edges.left);
	await page.context().close();
});

test('long wishlist title keeps authenticated and anonymous header controls available', async ({
	browser,
	request,
	baseURL,
}) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('header-long-title'),
	);
	const wishlistPath = await createWishlistAndNavigate(
		page,
		'Long wishlist title with enough words to wrap across several lines on a narrow phone',
	);
	await page.setViewportSize(VIEWPORTS[0]);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	const header = page.getByRole('banner');
	await expect(header.getByRole('button', { name: menuName })).toBeVisible();
	await expect(header.getByRole('button', { name: notificationName })).toBeVisible();
	await expect(header.getByRole('button', { name: accountName })).toBeVisible();
	await page.context().close();

	const anonymousPage = await browser.newPage({ viewport: VIEWPORTS[0] });
	await anonymousPage.goto(wishlistPath);
	await expect(
		anonymousPage.getByRole('banner').getByRole('link', { name: logoName }),
	).toBeVisible();
	await expect(
		anonymousPage.getByRole('banner').getByRole('button', { name: menuName }),
	).toHaveCount(0);
	const anonymousHeader = anonymousPage.getByRole('banner');
	const anonymousBrand = await box(anonymousHeader.getByRole('link', { name: logoName }));
	const appearance = anonymousHeader.getByRole('button', { name: /^(Vzhled|Appearance)$/ });
	const login = anonymousHeader.getByRole('link', { name: /^(Přihlásit se|Sign in)$/ });
	await expect(appearance).toBeVisible();
	await expect(login).toBeVisible();
	const appearanceBox = await box(appearance);
	const loginBox = await box(login);
	expectPixelsAtLeast(appearanceBox.left, anonymousBrand.right);
	expectPixelsAtLeast(loginBox.left, appearanceBox.right);
	expectPixelsAtMost(loginBox.right, VIEWPORTS[0].width);
	await anonymousPage.close();
});
