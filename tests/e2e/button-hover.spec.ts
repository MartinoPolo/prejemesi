import { expect, test, type Locator } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import {
	createAuthenticatedContext,
	loginViaApi,
	registerAndGetPage,
} from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

async function translateY(button: Locator) {
	return button.evaluate((element) => {
		const [, y = '0'] = getComputedStyle(element).translate.split(' ');
		return Number.parseFloat(y);
	});
}

async function shadow(button: Locator) {
	return button.evaluate((element) => getComputedStyle(element).boxShadow);
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Sticker button hover geometry', () => {
	test('navbar shadowed controls use toolbar spacing without overflowing', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('header-control-spacing');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		await page.waitForSelector('h1');

		const controls = page.locator('.nav-right');
		await expect(controls).toBeVisible();
		await expect
			.poll(() => controls.evaluate((element) => getComputedStyle(element).gap))
			.toBe('8px');

		for (const width of [768, 1024, 1280]) {
			await page.setViewportSize({ width, height: 900 });
			const box = await controls.boundingBox();
			expect(box, `header controls have a bounding box at ${width}px`).not.toBeNull();
			expect(
				box!.x,
				`header controls start within ${width}px viewport`,
			).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width, `header controls fit at ${width}px`).toBeLessThanOrEqual(
				width,
			);
			const documentWidth = await page.evaluate(() => ({
				scrollWidth: document.documentElement.scrollWidth,
				clientWidth: document.documentElement.clientWidth,
			}));
			expect(
				documentWidth.scrollWidth,
				`document has no horizontal overflow at ${width}px`,
			).toBeLessThanOrEqual(documentWidth.clientWidth);
		}

		await page.context().close();
	});

	test('account trigger exposes elevation but stays anchored while its menu is open', async ({
		browser,
		request,
		baseURL,
	}) => {
		const cookies = await loginViaApi(request, baseURL!, {
			email: 'martin@test.cz',
			password: ['password', '123'].join(''),
		});
		const context = await createAuthenticatedContext(browser, cookies, baseURL!);
		const page = await context.newPage();
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/my-lists');

		const account = page.getByRole('button', { name: /Martin Novák/ });
		await expect(async () => {
			if ((await account.getAttribute('aria-expanded')) !== 'true') {
				await account.click();
			}
			await expect(account).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		await expect(page.locator('[data-slot="dropdown-menu-content"]')).toBeVisible();
		await page.mouse.move(0, 500);
		const openBox = await account.boundingBox();
		expect(openBox).not.toBeNull();
		const openShadow = await shadow(account);
		await account.hover({ force: true });
		await expect.poll(() => account.boundingBox().then((box) => box!.y)).toBe(openBox!.y);
		await expect.poll(() => shadow(account)).not.toBe(openShadow);

		await page.keyboard.press('Escape');
		await expect(page.locator('[data-slot="dropdown-menu-content"]')).not.toBeVisible();
		await page.mouse.move(0, 500);
		const restingShadow = await shadow(account);
		await account.hover();
		await expect.poll(() => translateY(account)).toBeLessThan(-0.5);
		await expect.poll(() => shadow(account)).not.toBe(restingShadow);
		await page.context().close();
	});

	test('settings close control lifts and changes shadow while only its icon rotates', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('close-elevation');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await createWishlistAndNavigate(page, 'Dialog close elevation');
		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		const dialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await expect(dialog).toBeVisible();

		const close = dialog.getByRole('button', { name: 'Zavřít' });
		const icon = close.locator('svg');
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.mouse.move(0, 500);
		const restingShadow = await shadow(close);
		const surfaceTransform = await close.evaluate((el) => getComputedStyle(el).transform);
		const surfaceRotate = await close.evaluate((el) => getComputedStyle(el).rotate);
		expect(surfaceRotate).toBe('none');
		await close.hover();
		await expect.poll(() => translateY(close)).toBeLessThan(-0.5);
		await expect.poll(() => shadow(close)).not.toBe(restingShadow);
		expect(await close.evaluate((el) => getComputedStyle(el).transform)).toBe(surfaceTransform);
		expect(await close.evaluate((el) => getComputedStyle(el).rotate)).toBe(surfaceRotate);
		await expect
			.poll(() => icon.evaluate((el) => getComputedStyle(el).rotate))
			.not.toBe('none');

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.mouse.move(0, 500);
		await close.hover();
		await expect.poll(() => translateY(close)).toBe(0);
		await expect.poll(() => icon.evaluate((el) => getComputedStyle(el).rotate)).toBe('0deg');
		await page.context().close();
	});

	test('navbar create button stays lifted while the pointer crosses its bottom edge', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('button-hover');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.emulateMedia({ reducedMotion: 'no-preference' });

		await page.goto('/my-lists');
		await page.waitForSelector('h1');

		const button = page.getByRole('button', { name: 'Vytvořit', exact: true });
		await expect(button).toBeVisible();
		const bottomHitAreaHeight = await button.evaluate(
			(element) => getComputedStyle(element, '::after').height,
		);
		expect(bottomHitAreaHeight, 'fresh worktree serves the eight-pixel hover buffer').toBe(
			'8px',
		);
		const box = await button.boundingBox();
		expect(box, 'navbar create button has a bounding box').not.toBeNull();

		const bottomEdgeY = box!.y + box!.height - 1;
		const leftEdgeX = box!.x + 4;
		const rightEdgeX = box!.x + box!.width - 4;
		await page.mouse.move(leftEdgeX, bottomEdgeY, { steps: 20 });
		await expect.poll(() => button.evaluate((element) => element.matches(':hover'))).toBe(true);
		await expect.poll(() => translateY(button)).toBeLessThan(-0.5);

		for (let x = leftEdgeX; x <= rightEdgeX; x += 8) {
			await page.mouse.move(x, bottomEdgeY, { steps: 3 });
			await page.waitForTimeout(50);
			expect(await translateY(button)).toBeLessThan(-0.5);
		}

		await page.context().close();
	});
});
