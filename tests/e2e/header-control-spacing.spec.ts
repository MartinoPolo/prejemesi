import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';

const VIEWPORT_WIDTHS = [320, 767, 768, 1039, 1040, 1280] as const;
const TOOLBAR_CONTROL_GAP = 8;

interface PaintedControl {
	paintedLeft: number;
	paintedRight: number;
}

async function paintedControls(wrapper: Locator): Promise<PaintedControl[]> {
	return wrapper.locator('button:visible, a:visible').evaluateAll((elements) => {
		const shadowExtents = (boxShadow: string) => {
			if (boxShadow === 'none') {
				return { left: 0, right: 0 };
			}
			const layers = boxShadow.match(/(?:[^,(]|\([^)]*\))+/g) ?? [];
			return layers.reduce(
				(extents, layer) => {
					if (/\binset\b/.test(layer)) {
						return extents;
					}
					const lengths = layer.match(/-?\d+(?:\.\d+)?px/g) ?? [];
					const horizontal = Number.parseFloat(lengths[0] ?? '0');
					const blur = Math.max(0, Number.parseFloat(lengths[2] ?? '0'));
					const spread = Number.parseFloat(lengths[3] ?? '0');
					const radius = Math.max(0, blur + spread);
					return {
						left: Math.max(extents.left, radius - horizontal),
						right: Math.max(extents.right, radius + horizontal),
					};
				},
				{ left: 0, right: 0 },
			);
		};

		return elements
			.map((element) => {
				const rect = element.getBoundingClientRect();
				const extents = shadowExtents(getComputedStyle(element).boxShadow);
				return {
					paintedLeft: rect.left - extents.left,
					paintedRight: rect.right + extents.right,
				};
			})
			.sort((left, right) => left.paintedLeft - right.paintedLeft);
	});
}

async function expectPaintedControlsNotToOverlap(wrapper: Locator, description: string) {
	await expect
		.poll(
			async () => {
				const controls = await paintedControls(wrapper);
				return Math.min(
					...controls
						.slice(0, -1)
						.map(
							(control, index) =>
								controls[index + 1].paintedLeft - control.paintedRight,
						),
				);
			},
			{ message: `${description} keeps hard shadows from overlapping` },
		)
		.toBeGreaterThanOrEqual(0);
}

async function expectExactGap(wrapper: Locator, description: string) {
	await expect
		.poll(
			async () =>
				wrapper.evaluate((element) =>
					Number.parseFloat(getComputedStyle(element).columnGap),
				),
			{ message: `${description} uses the wishlist toolbar's 8px control gap` },
		)
		.toBe(TOOLBAR_CONTROL_GAP);
}

async function visibleControlTops(navRight: Locator): Promise<number[]> {
	return navRight
		.locator('button:visible, a:visible')
		.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
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

	const controlTops = await visibleControlTops(navRight);
	expect(controlTops.length, `header exposes controls at ${width}px`).toBeGreaterThan(1);
	expect(
		new Set(controlTops.map((top) => Math.round(top))).size,
		`header controls remain on one row at ${width}px`,
	).toBe(1);
}

test('authenticated header control wrappers match the wishlist toolbar gap', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('header-painted-spacing');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/my-lists');
	await page.waitForSelector('h1');

	const navRight = page.getByTestId('navbar-actions');
	for (const width of VIEWPORT_WIDTHS) {
		await page.setViewportSize({ width, height: 900 });
		await expect(navRight).toBeVisible();
		await page.mouse.move(0, 500);

		await expectNoOverflowOrWrapping(page, navRight, width);
		await expectExactGap(navRight, `authenticated header at ${width}px`);
		await expectPaintedControlsNotToOverlap(navRight, `authenticated header at ${width}px`);

		const appearanceControls = navRight.getByTestId('navbar-appearance-controls');
		if (width >= 1040) {
			await expect(appearanceControls).toBeVisible();
			await expect(appearanceControls.locator('button:visible')).toHaveCount(3);
			await expectExactGap(appearanceControls, `desktop appearance controls at ${width}px`);
		} else {
			await expect(appearanceControls).toBeHidden();
		}

		const controls = navRight.locator('button:visible, a:visible');
		for (let index = 0; index < (await controls.count()); index += 1) {
			await controls.nth(index).hover({ force: true });
			await expectPaintedControlsNotToOverlap(
				navRight,
				`authenticated header at ${width}px with control ${index + 1} hovered`,
			);
		}
	}

	await page.context().close();
});

test('authenticated 320px navbar keeps every action visible with touch-sized targets', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('header-mobile-bounds');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await page.setViewportSize({ width: 320, height: 900 });
	await page.goto('/my-lists');
	await page.waitForSelector('h1');

	const header = page.locator('header.topbar');
	await expect(header.getByRole('button', { name: /^(Otevření menu|Open menu)$/ })).toBeVisible();
	await expect(
		header.getByRole('link', {
			name: /^(Přejeme si – domovská stránka|Přejeme si – home)$/,
		}),
	).toBeVisible();
	await expect(header.getByRole('button', { name: /^(Vytvořit|Create)$/ })).toBeVisible();
	await expect(
		header.getByRole('button', { name: /^(Upozornění \(|Notifications \()/ }),
	).toBeVisible();
	await expect(
		header.getByRole('button', { name: /(– menu uživatele|– user menu)$/ }),
	).toBeVisible();

	const controls = header.locator('button:visible, a:visible');
	const boxes = await controls.evaluateAll((elements) =>
		elements.map((element) => {
			const rect = element.getBoundingClientRect();
			return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
		}),
	);

	for (const box of boxes) {
		expect(
			box.left,
			'navbar control stays inside the left viewport edge',
		).toBeGreaterThanOrEqual(0);
		expect(
			box.right,
			'navbar control stays inside the right viewport edge',
		).toBeLessThanOrEqual(320);
		expect(box.width, 'navbar control has a 40px minimum target width').toBeGreaterThanOrEqual(
			40,
		);
		expect(
			box.height,
			'navbar control has a 40px minimum target height',
		).toBeGreaterThanOrEqual(40);
	}

	await expectPaintedControlsNotToOverlap(header, 'authenticated 320px header');

	await page.context().close();
});

test('logged-out landing desktop control wrappers match the wishlist toolbar gap', async ({
	browser,
}) => {
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	await page.goto('/');

	const outerCluster = page.getByTestId('landing-nav-actions');
	const appearanceControls = outerCluster.getByTestId('landing-appearance-controls');
	await expect(outerCluster).toBeVisible();
	await expect(appearanceControls).toBeVisible();
	await expect(appearanceControls.locator('button:visible')).toHaveCount(3);
	await expectExactGap(outerCluster, 'landing outer control cluster');
	await expectExactGap(appearanceControls, 'landing appearance controls');
	await expectPaintedControlsNotToOverlap(outerCluster, 'landing header');
	const controls = outerCluster.locator('button:visible, a:visible');
	for (let index = 0; index < (await controls.count()); index += 1) {
		await controls.nth(index).hover({ force: true });
		await expectPaintedControlsNotToOverlap(
			outerCluster,
			`landing header with control ${index + 1} hovered`,
		);
	}

	await page.context().close();
});
