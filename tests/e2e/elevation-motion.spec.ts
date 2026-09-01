import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

interface SurfaceState {
	translateY: number;
	scale: number;
	shadow: string;
}

async function surfaceState(surface: Locator): Promise<SurfaceState> {
	return surface.evaluate((element) => {
		const style = getComputedStyle(element);
		const [, y = '0'] = style.translate.split(' ');
		return {
			translateY: Number.parseFloat(y) || 0,
			scale: style.scale === 'none' ? 1 : Number.parseFloat(style.scale),
			shadow: style.boxShadow,
		};
	});
}

async function expectCoherentElevationTransition(surface: Locator) {
	const transition = await surface.evaluate((element) => {
		const style = getComputedStyle(element);
		const root = getComputedStyle(document.documentElement);
		return {
			properties: style.transitionProperty.split(',').map((value) => value.trim()),
			durations: style.transitionDuration.split(',').map((value) => value.trim()),
			easings: [style.transitionTimingFunction.trim()],
			delays: style.transitionDelay.split(',').map((value) => value.trim()),
			expectedEasing: root.getPropertyValue('--ease-standard').trim(),
		};
	});

	expect(transition.properties).toEqual(['translate', 'scale', 'box-shadow']);
	expect(new Set(transition.durations)).toEqual(new Set(['0.2s']));
	expect(new Set(transition.easings)).toEqual(new Set([transition.expectedEasing]));
	expect(new Set(transition.delays)).toEqual(new Set(['0s']));
}

function expectBetween(start: SurfaceState, middle: SurfaceState, end: SurfaceState) {
	for (const property of ['translateY', 'scale', 'shadow'] as const) {
		expect(middle[property], `${property} has left its starting state`).not.toBe(
			start[property],
		);
		expect(middle[property], `${property} has not snapped to its settled state`).not.toBe(
			end[property],
		);
	}
}

async function pressAndSample(page: Page, surface: Locator) {
	await page.mouse.move(0, 500);
	await surface.hover();
	await page.waitForTimeout(250);
	const start = await surfaceState(surface);

	await page.mouse.down();
	await page.waitForTimeout(70);
	const middle = await surfaceState(surface);
	await page.waitForTimeout(200);
	const end = await surfaceState(surface);
	await page.mouse.up();

	expectBetween(start, middle, end);
	expect(end.translateY).not.toBe(start.translateY);
	expect(end.scale).not.toBe(start.scale);
	expect(end.shadow).not.toBe(start.shadow);
}

async function hoverAndSample(page: Page, surface: Locator) {
	await page.mouse.move(0, 500);
	const start = await surfaceState(surface);
	const box = await surface.boundingBox();
	expect(box).not.toBeNull();
	await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
	await page.waitForTimeout(70);
	const middle = await surfaceState(surface);
	await page.waitForTimeout(200);
	const end = await surfaceState(surface);

	expect(middle.translateY).not.toBe(start.translateY);
	expect(middle.translateY).not.toBe(end.translateY);
	expect(middle.shadow).not.toBe(start.shadow);
	expect(middle.shadow).not.toBe(end.shadow);
	expect(end.translateY).toBeLessThan(start.translateY);
	expect(end.shadow).not.toBe(start.shadow);
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Coherent elevated-surface motion', () => {
	test('normal toolbar and compact outline controls press as one rigid surface', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-toolbar');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/my-lists');

		const toolbarButton = page.getByRole('button', { name: 'Vytvořit', exact: true });
		const outlineButton = page.getByRole('button', { name: 'Barevná paleta' });
		for (const surface of [toolbarButton, outlineButton]) {
			await expect(surface).toBeVisible();
			await expectCoherentElevationTransition(surface);
			await pressAndSample(page, surface);
		}

		await page.context().close();
	});

	test('open account trigger keeps its anchor fixed while shadow feedback settles coherently', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-account');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/my-lists');

		const account = page.getByRole('button', { name: new RegExp(user.name) });
		await expectCoherentElevationTransition(account);
		await page.mouse.move(0, 500);
		await page.waitForTimeout(250);
		const resting = await surfaceState(account);
		const restingBox = await account.boundingBox();

		await account.hover();
		await page.waitForTimeout(250);
		const hovered = await surfaceState(account);
		expect(hovered.shadow).not.toBe(resting.shadow);
		expect(hovered.translateY).toBeLessThan(resting.translateY);

		await expect(async () => {
			if ((await account.getAttribute('aria-expanded')) !== 'true') {
				await account.click();
			}
			await expect(account).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		await page.waitForTimeout(250);
		const open = await surfaceState(account);
		const openBox = await account.boundingBox();

		expect(Math.abs(open.translateY)).toBeLessThan(0.05);
		expect(Math.abs(openBox!.y - restingBox!.y)).toBeLessThan(0.1);
		await page.context().close();
	});

	test('dialog close remains top-right and its icon finishes with the surface', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-close');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/my-lists');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
		const createButton = page.getByRole('button', { name: 'Vytvořit', exact: true });
		const dialog = page.getByRole('dialog');
		await expect(async () => {
			if (!(await dialog.isVisible())) {
				await createButton.click();
			}
			await expect(dialog).toBeVisible({ timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		const close = dialog.getByRole('button', { name: 'Zavřít' });
		const icon = close.locator('svg');

		for (const width of [390, 1280]) {
			await page.setViewportSize({ width, height: 800 });
			await page.waitForTimeout(250);
			const dialogBox = await dialog.boundingBox();
			const closeBox = await close.boundingBox();
			expect(dialogBox).not.toBeNull();
			expect(closeBox).not.toBeNull();
			expect(
				Math.abs(closeBox!.x + closeBox!.width - dialogBox!.x - dialogBox!.width),
			).toBeLessThan(30);
			expect(closeBox!.y - dialogBox!.y).toBeGreaterThanOrEqual(0);
			expect(closeBox!.y - dialogBox!.y).toBeLessThan(30);
		}

		await expectCoherentElevationTransition(close);
		await page.mouse.move(0, 500);
		const iconStart = await icon.evaluate((element) => getComputedStyle(element).rotate);
		const closeBox = await close.boundingBox();
		expect(closeBox).not.toBeNull();
		await page.mouse.move(
			closeBox!.x + closeBox!.width / 2,
			closeBox!.y + closeBox!.height / 2,
		);
		await page.waitForTimeout(70);
		const iconMiddle = await icon.evaluate((element) => getComputedStyle(element).rotate);
		await page.waitForTimeout(200);
		const iconEnd = await icon.evaluate((element) => getComputedStyle(element).rotate);
		expect(iconMiddle).not.toBe(iconStart);
		expect(iconMiddle).not.toBe(iconEnd);
		expect(iconEnd).not.toBe(iconStart);
		await page.context().close();
	});

	test('cards lift coherently and reduced motion makes every representative sticker immediate', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-card-reduced');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await createWishlistAndNavigate(page, 'Elevation card');
		await page.goto('/my-lists');
		await page.emulateMedia({ reducedMotion: 'no-preference' });

		const card = page.getByTestId('wishlist-card').filter({ hasText: 'Elevation card' });
		await expectCoherentElevationTransition(card);
		await hoverAndSample(page, card);

		await page.emulateMedia({ reducedMotion: 'reduce' });
		const toolbarButton = page.getByRole('button', { name: 'Vytvořit', exact: true });
		const account = page.getByRole('button', { name: new RegExp(user.name) });
		for (const surface of [toolbarButton, account, card]) {
			await page.mouse.move(0, 500);
			const before = await surfaceState(surface);
			await surface.hover({ force: true });
			const after = await surfaceState(surface);
			const transitionProperty = await surface.evaluate(
				(element) => getComputedStyle(element).transitionProperty,
			);
			expect(transitionProperty).toBe('none');
			expect(after.translateY).toBe(before.translateY);
			expect(after.scale).toBe(before.scale);
		}

		await page.getByRole('button', { name: 'Vytvořit', exact: true }).click();
		const close = page.getByRole('dialog').getByRole('button', { name: 'Zavřít' });
		await expect(close).toBeVisible();
		await close.hover();
		expect(
			await close.evaluate((element) => getComputedStyle(element).transitionProperty),
		).toBe('none');
		expect(await close.evaluate((element) => getComputedStyle(element).translate)).toBe('0px');
		expect(
			await close.locator('svg').evaluate((element) => getComputedStyle(element).rotate),
		).toBe('0deg');
		await page.context().close();
	});
});
