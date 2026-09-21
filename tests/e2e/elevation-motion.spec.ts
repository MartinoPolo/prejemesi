import { expect, test, type Locator } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage, waitForAppHydration } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

interface RectSnapshot {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface GiftGeometrySnapshot {
	owner: RectSnapshot;
	surface: RectSnapshot;
	content: RectSnapshot[];
}

function visualSurface(owner: Locator) {
	return owner.locator(':scope > .elevation-surface');
}

async function rect(locator: Locator): Promise<RectSnapshot> {
	return locator.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
	});
}

function expectSameRect(actual: RectSnapshot, expected: RectSnapshot) {
	for (const key of ['x', 'y', 'width', 'height'] as const) {
		expect(Math.abs(actual[key] - expected[key])).toBeLessThan(0.25);
	}
}

async function sampleFrameRects(locator: Locator, frameCount = 12): Promise<RectSnapshot[]> {
	return locator.evaluate(async (element, count) => {
		const samples: RectSnapshot[] = [];
		for (let frame = 0; frame < count; frame += 1) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const bounds = element.getBoundingClientRect();
			samples.push({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
		}
		return samples;
	}, frameCount);
}

async function giftGeometry(
	owner: Locator,
	surface: Locator,
	content: readonly Locator[],
): Promise<GiftGeometrySnapshot> {
	return {
		owner: await rect(owner),
		surface: await rect(surface),
		content: await Promise.all(content.map(rect)),
	};
}

function expectContentTranslatedWithSurface(
	actual: GiftGeometrySnapshot,
	resting: GiftGeometrySnapshot,
) {
	const surfaceDelta = {
		x: actual.surface.x - resting.surface.x,
		y: actual.surface.y - resting.surface.y,
	};
	for (const [index, actualContent] of actual.content.entries()) {
		const restingContent = resting.content[index]!;
		expect(actualContent.x - restingContent.x).toBeCloseTo(surfaceDelta.x, 1);
		expect(actualContent.y - restingContent.y).toBeCloseTo(surfaceDelta.y, 1);
		expect(actualContent.width).toBeCloseTo(restingContent.width, 1);
		expect(actualContent.height).toBeCloseTo(restingContent.height, 1);
	}
}

function expectContentGeometryWithinSurface(
	actual: GiftGeometrySnapshot,
	resting: GiftGeometrySnapshot,
) {
	for (const [index, actualContent] of actual.content.entries()) {
		const restingContent = resting.content[index]!;
		for (const [actualValue, restingValue] of [
			[
				(actualContent.x - actual.surface.x) / actual.surface.width,
				(restingContent.x - resting.surface.x) / resting.surface.width,
			],
			[
				(actualContent.y - actual.surface.y) / actual.surface.height,
				(restingContent.y - resting.surface.y) / resting.surface.height,
			],
			[
				actualContent.width / actual.surface.width,
				restingContent.width / resting.surface.width,
			],
			[
				actualContent.height / actual.surface.height,
				restingContent.height / resting.surface.height,
			],
		] as const) {
			expect(actualValue).toBeCloseTo(restingValue, 2);
		}
	}
}

function expectSameGiftGeometry(actual: GiftGeometrySnapshot, expected: GiftGeometrySnapshot) {
	expectSameRect(actual.owner, expected.owner);
	expectSameRect(actual.surface, expected.surface);
	for (const [index, contentRect] of actual.content.entries()) {
		expectSameRect(contentRect, expected.content[index]!);
	}
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Elevated interaction behavior', () => {
	test('gift card press, release, and reduced motion keep the owner and content aligned', async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/w/xmas2026');
		await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();
		await page
			.getByTestId('wishlist-toolbar')
			.getByRole('radio', { name: 'Karta', exact: true })
			.filter({ visible: true })
			.click();

		const owner = page
			.locator('[data-testid="gift-card-surface"].elevation-owner-raised')
			.filter({ has: page.getByTestId('gift-more-actions') })
			.filter({ has: page.getByTestId('gift-card-price').locator('span') })
			.filter({ has: page.getByTestId('gift-card-image-frame').locator('img') })
			.first();
		const surface = visualSurface(owner);
		const content = [
			owner.getByTestId('gift-card-image-frame').locator('img'),
			owner.getByRole('heading', { level: 3 }),
			owner.getByTestId('gift-card-price').locator('span'),
			owner.getByTestId('gift-more-actions'),
		];
		await expect(owner).toBeVisible();
		for (const element of content) {
			await expect(element).toBeVisible();
		}
		await page.mouse.move(1, 1);
		await expect
			.poll(() => surface.evaluate((element) => getComputedStyle(element).translate))
			.toBe('none');
		const resting = await giftGeometry(owner, surface, content);
		const point = {
			x: resting.owner.x + resting.owner.width / 2,
			y: resting.owner.y + resting.owner.height / 3,
		};

		await page.mouse.move(point.x, point.y);
		await expect
			.poll(() => surface.evaluate((element) => getComputedStyle(element).translate))
			.toBe('0px -2px');
		const hovered = await giftGeometry(owner, surface, content);
		expectSameRect(hovered.owner, resting.owner);
		expect(hovered.surface.y - resting.surface.y).toBeCloseTo(-2, 1);
		expectContentTranslatedWithSurface(hovered, resting);
		expectContentGeometryWithinSurface(hovered, resting);

		await owner.evaluate((element) => {
			element.addEventListener('click', (event) => event.stopPropagation(), { once: true });
		});
		await page.mouse.down();
		try {
			await expect
				.poll(() => surface.evaluate((element) => getComputedStyle(element).scale))
				.toBe('0.98');
			const active = await giftGeometry(owner, surface, content);
			expectSameRect(active.owner, resting.owner);
			expect(active.surface.width).toBeCloseTo(resting.surface.width * 0.98, 1);
			expectContentGeometryWithinSurface(active, resting);
		} finally {
			await page.mouse.up();
		}

		await expect
			.poll(() => surface.evaluate((element) => getComputedStyle(element).translate))
			.toBe('0px -2px');
		await expect
			.poll(() => surface.evaluate((element) => getComputedStyle(element).scale))
			.toBe('none');
		const released = await giftGeometry(owner, surface, content);
		expectSameRect(released.owner, resting.owner);
		expectContentTranslatedWithSurface(released, resting);
		expectContentGeometryWithinSurface(released, resting);

		await page.mouse.move(1, 1);
		await expect
			.poll(() => surface.evaluate((element) => getComputedStyle(element).translate))
			.toBe('none');
		expectSameGiftGeometry(await giftGeometry(owner, surface, content), resting);

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.mouse.move(point.x, point.y);
		for (const sample of await sampleFrameRects(surface)) {
			expectSameRect(sample, resting.surface);
		}
		const reducedMotion = await giftGeometry(owner, surface, content);
		expectSameGiftGeometry(reducedMotion, resting);
		expectContentGeometryWithinSurface(reducedMotion, resting);
	});

	test('raised button remains reachable and stationary through a held lower-edge press', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-held-press');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/my-lists');
		await waitForAppHydration(page);

		const button = page.getByRole('button', { name: 'Vytvořit', exact: true });
		await expect(button).toBeVisible();
		const resting = await rect(button);
		const surface = visualSurface(button);
		const restingSurface = await rect(surface);
		const ordinaryShadowOffset = await button.evaluate((element) =>
			Number.parseFloat(
				getComputedStyle(element).getPropertyValue('--elevation-ordinary-offset'),
			),
		);
		expect(ordinaryShadowOffset).toBeGreaterThan(0);
		const point = {
			x: resting.x + resting.width / 2,
			// Exercise the visible lower shadow extension, where hit-region regressions occur.
			y: resting.y + resting.height + ordinaryShadowOffset - 0.25,
		};
		await page.mouse.move(point.x, point.y);
		await expect
			.poll(() =>
				button.evaluate((element, location) => {
					const target = document.elementFromPoint(location.x, location.y);
					return target === element || (target !== null && element.contains(target));
				}, point),
			)
			.toBe(true);

		await expect.poll(async () => (await rect(surface)).y).toBeLessThan(restingSurface.y);
		const hoveredSurface = await rect(surface);
		await page.mouse.down();
		try {
			const samples = await button.evaluate(async (element, location) => {
				const evidence: Array<{ active: boolean; hit: boolean; rect: RectSnapshot }> = [];
				for (let frame = 0; frame < 20; frame += 1) {
					await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
					const target = document.elementFromPoint(location.x, location.y);
					const bounds = element.getBoundingClientRect();
					evidence.push({
						active: element.matches(':active'),
						hit: target === element || (target !== null && element.contains(target)),
						rect: {
							x: bounds.x,
							y: bounds.y,
							width: bounds.width,
							height: bounds.height,
						},
					});
				}
				return evidence;
			}, point);
			expect(samples.every(({ active, hit }) => active && hit)).toBe(true);
			for (const sample of samples) {
				expectSameRect(sample.rect, resting);
			}
			expect(
				(await rect(surface)).y,
				'press feedback moves the lifted face back toward its owner',
			).toBeGreaterThan(hoveredSurface.y);
		} finally {
			await page.mouse.up();
		}
		await expect(page.getByRole('dialog', { name: 'Nový seznam přání' })).toBeVisible();
		await page.context().close();
	});

	test('representative elevated surfaces stay at rest with reduced motion', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-reduced-motion');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await createWishlistAndNavigate(page, 'Reduced motion surface');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/my-lists');
		await waitForAppHydration(page);

		const create = page.getByRole('button', { name: 'Vytvořit', exact: true });
		const card = page
			.getByTestId('wishlist-card')
			.filter({ hasText: 'Reduced motion surface' });
		for (const owner of [create, card]) {
			const surface = visualSurface(owner);
			const resting = await rect(surface);
			await owner.hover({ force: true });
			for (const sample of await sampleFrameRects(surface)) {
				expectSameRect(sample, resting);
			}
			await page.mouse.move(0, 500);
		}

		await page.context().close();
	});
});
