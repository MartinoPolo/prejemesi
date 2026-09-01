import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

const VIEWPORT_WIDTHS = [320, 767, 768, 1039, 1040, 1280] as const;
const MIN_PAINTED_SEPARATION = 4;

interface PaintedControl {
	left: number;
	paintedRight: number;
	top: number;
}

async function paintedControls(navRight: Locator): Promise<PaintedControl[]> {
	return navRight.locator('button:visible, a:visible').evaluateAll((elements) => {
		const positiveShadowOffset = (boxShadow: string) => {
			if (boxShadow === 'none') {
				return 0;
			}
			const layers = boxShadow.match(/(?:[^,(]|\([^)]*\))+/g) ?? [];
			return Math.max(
				0,
				...layers.map((layer) => {
					const lengths = layer.match(/-?\d+(?:\.\d+)?px/g) ?? [];
					return Math.max(0, Number.parseFloat(lengths[0] ?? '0'));
				}),
			);
		};

		return elements
			.map((element) => {
				const rect = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				return {
					left: rect.left,
					paintedRight: rect.right + positiveShadowOffset(style.boxShadow),
					top: rect.top,
				};
			})
			.sort((a, b) => a.left - b.left);
	});
}

async function expectPaintedSeparation(navRight: Locator, width: number, state: string) {
	await expect
		.poll(
			async () => {
				const controls = await paintedControls(navRight);
				return Math.min(
					...controls
						.slice(0, -1)
						.map((control, index) => controls[index + 1].left - control.paintedRight),
				);
			},
			{ message: `painted header controls stay separated at ${width}px (${state})` },
		)
		.toBeGreaterThanOrEqual(MIN_PAINTED_SEPARATION);
}

async function expectNoOverflowOrWrapping(page: Page, navRight: Locator, width: number) {
	const layout = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
	}));
	expect(
		layout.scrollWidth,
		`document has no horizontal overflow at ${width}px`,
	).toBeLessThanOrEqual(layout.clientWidth);

	const controls = await paintedControls(navRight);
	expect(controls.length, `header exposes controls at ${width}px`).toBeGreaterThan(1);
	expect(
		new Set(controls.map((control) => Math.round(control.top))).size,
		`header controls remain on one row at ${width}px`,
	).toBe(1);
}

test('header controls preserve hard-shadow clearance across responsive compositions', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('header-painted-spacing');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/my-lists');
	await page.waitForSelector('h1');

	const navRight = page.locator('.nav-right');
	for (const width of VIEWPORT_WIDTHS) {
		await page.setViewportSize({ width, height: 900 });
		await expect(navRight).toBeVisible();
		await page.mouse.move(0, 500);

		await expectNoOverflowOrWrapping(page, navRight, width);
		await expectPaintedSeparation(navRight, width, 'rest');

		const appearanceControls = navRight.locator('.header-appearance-controls');
		if (width >= 1040) {
			await expect(appearanceControls).toBeVisible();
			await expect(appearanceControls.locator('button:visible')).toHaveCount(3);
		} else {
			await expect(appearanceControls).toBeHidden();
		}

		const controls = navRight.locator('button:visible, a:visible');
		for (let index = 0; index < (await controls.count()); index += 1) {
			const control = controls.nth(index);
			await control.hover({ force: true });
			await expectPaintedSeparation(navRight, width, `control ${index + 1} hovered`);
		}
	}

	await page.context().close();
});
