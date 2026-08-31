import { expect, test, type Locator } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

async function translateY(button: Locator) {
	return button.evaluate((element) => {
		const [, y = '0'] = getComputedStyle(element).translate.split(' ');
		return Number.parseFloat(y);
	});
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
			expect(box!.x + box!.width, `header controls fit at ${width}px`).toBeLessThanOrEqual(
				width,
			);
		}

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
