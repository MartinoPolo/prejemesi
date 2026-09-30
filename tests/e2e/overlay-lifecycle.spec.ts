import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import {
	loginViaApi,
	parseCookiesForContext,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';

function recordLifecycleDiagnostics(page: Page): string[] {
	const diagnostics: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'warning' || message.type() === 'error') {
			diagnostics.push(`console ${message.type()}: ${message.text()}`);
		}
	});
	page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
	return diagnostics;
}

async function openSeedWishlist(
	page: Page,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
) {
	const cookies = await loginViaApi(request, baseURL, {
		email: 'martin@test.cz',
		password: ['password', '123'].join(''),
	});
	await page.context().addCookies(parseCookiesForContext(cookies, baseURL));
	await page.goto('/w/xmas2026', { waitUntil: 'domcontentloaded' });
	await waitForAppHydration(page);
	await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();
}

async function waitForOpeningAnimation(surface: Locator) {
	await expect
		.poll(() =>
			surface.evaluate((element) =>
				element.getAnimations().every((animation) => animation.playState === 'finished'),
			),
		)
		.toBe(true);
}

async function attachOpenSurface(page: Page, testInfo: TestInfo, name: string) {
	await testInfo.attach(name, {
		body: await page.screenshot(),
		contentType: 'image/png',
	});
}

async function exercisePointerAfterTeardown(page: Page) {
	await page.mouse.move(100, 160);
	await page.mouse.click(4, 4);
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			),
	);
}

function expectNoLifecycleErrors(diagnostics: string[]) {
	expect(diagnostics.filter((diagnostic) => /derived_inert/i.test(diagnostic))).toEqual([]);
	expect(diagnostics.filter((diagnostic) => diagnostic.startsWith('pageerror:'))).toEqual([]);
}

test('desktop header and toolbar More menus survive repeated dismissal and dialog handoff', async ({
	page,
	request,
	baseURL,
}, testInfo) => {
	const diagnostics = recordLifecycleDiagnostics(page);
	await page.setViewportSize({ width: 1100, height: 800 });
	await openSeedWishlist(page, request, baseURL!);

	const headerTrigger = page.getByTestId('desktop-header-more-trigger').filter({ visible: true });
	const toolbarTrigger = page.getByTestId('desktop-more-trigger').filter({ visible: true });
	const menu = page.locator('[data-slot="dropdown-menu-content"]');
	for (const [trigger, name] of [
		[headerTrigger, 'header'],
		[toolbarTrigger, 'toolbar'],
	] as const) {
		for (let cycle = 0; cycle < 3; cycle += 1) {
			await trigger.click();
			await expect(menu).toBeVisible();
			await expect(trigger).toHaveAttribute('aria-expanded', 'true');
			await waitForOpeningAnimation(menu);
			if (cycle === 0 && name === 'header') {
				await attachOpenSurface(page, testInfo, 'desktop-header-more-open.png');
			}
			if (cycle % 2 === 0) {
				await page.keyboard.press('Escape');
			} else {
				await page.mouse.click(4, 4);
			}
			await expect(menu).toHaveCount(0);
			await expect(trigger).toHaveAttribute('aria-expanded', 'false');
			await exercisePointerAfterTeardown(page);
		}
	}

	await headerTrigger.click();
	await expect(menu).toBeVisible();
	await menu.getByRole('menuitem', { name: m.wishlist_moderators_label() }).click();
	const moderators = page.getByRole('dialog', { name: m.moderator_title() });
	await expect(moderators).toBeVisible();
	await expect(menu).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(moderators).toHaveCount(0);
	await exercisePointerAfterTeardown(page);
	await headerTrigger.click();
	await expect(menu).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(menu).toHaveCount(0);
	await exercisePointerAfterTeardown(page);
	expectNoLifecycleErrors(diagnostics);
});

test('mobile header and toolbar More sheets survive repeated dismissal and dialog handoff', async ({
	page,
	request,
	baseURL,
}, testInfo) => {
	const diagnostics = recordLifecycleDiagnostics(page);
	await page.setViewportSize({ width: 390, height: 800 });
	await openSeedWishlist(page, request, baseURL!);

	const initialPointerEvents = await page
		.locator('body')
		.evaluate((body) => body.style.pointerEvents);
	const headerTrigger = page.getByTestId('mobile-header-more-trigger').filter({ visible: true });
	const toolbarTrigger = page.getByTestId('mobile-more-trigger').filter({ visible: true });
	const headerSheet = page.getByRole('dialog', { name: m.gift_more_actions() });
	const toolbarSheet = page.getByRole('dialog', { name: m.wishlist_more_actions() });
	for (const [trigger, sheet, name] of [
		[headerTrigger, headerSheet, 'header'],
		[toolbarTrigger, toolbarSheet, 'toolbar'],
	] as const) {
		for (let cycle = 0; cycle < 3; cycle += 1) {
			await trigger.click();
			await expect(sheet).toBeVisible();
			await expect(trigger).toHaveAttribute('aria-expanded', 'true');
			await waitForOpeningAnimation(sheet);
			if (cycle === 0 && name === 'header') {
				await attachOpenSurface(page, testInfo, 'mobile-header-more-open.png');
			}
			if (cycle % 2 === 0) {
				await page.keyboard.press('Escape');
			} else {
				await page.mouse.click(4, 4);
			}
			await expect(sheet).toHaveCount(0);
			await expect(trigger).toHaveAttribute('aria-expanded', 'false');
			await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
			await expect
				.poll(() => page.locator('body').evaluate((body) => body.style.pointerEvents))
				.toBe(initialPointerEvents);
			await exercisePointerAfterTeardown(page);
		}
	}

	await headerTrigger.click();
	await expect(headerSheet).toBeVisible();
	await headerSheet.getByRole('button', { name: m.wishlist_moderators_label() }).click();
	const moderators = page.getByRole('dialog', { name: m.moderator_title() });
	await expect(moderators).toBeVisible();
	await expect(headerSheet).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(moderators).toHaveCount(0);
	await exercisePointerAfterTeardown(page);
	await headerTrigger.click();
	await expect(headerSheet).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(headerSheet).toHaveCount(0);
	await exercisePointerAfterTeardown(page);
	expectNoLifecycleErrors(diagnostics);
});
