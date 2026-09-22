import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage, waitForAppHydration } from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	createWishlistForSomeoneAndNavigate,
	shareWishlist,
} from './fixtures/wishlist-helpers.js';
import { visibleDirectReceivedAction } from './fixtures/gift-actions-helpers.js';
import { createPixelAssertions } from '../helpers/pixel-assertions.mjs';

const { expectPixelsNear } = createPixelAssertions(expect);

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
		expectPixelsNear(actual[key], expected[key]);
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

async function expectAnimationsSettled(locator: Locator) {
	await expect
		.poll(() =>
			locator.evaluate(
				(element) =>
					element.getAnimations().filter((animation) => animation.playState === 'running')
						.length,
			),
		)
		.toBe(0);
}

async function expectHeldNestedPressDoesNotMove(
	page: Page,
	gift: Locator,
	control: Locator,
	view: 'card' | 'list',
) {
	await control.scrollIntoViewIfNeeded();
	await expect(control).toBeVisible();
	const giftSurface =
		view === 'card'
			? gift.getByTestId('gift-card-surface').locator(':scope > .elevation-surface')
			: gift.getByTestId('gift-list-item');
	const controlBounds = await control.boundingBox();
	expect(controlBounds).not.toBeNull();
	if (controlBounds === null) {
		throw new Error('Nested control has no bounding box');
	}
	await page.mouse.move(
		controlBounds.x + controlBounds.width / 2,
		controlBounds.y + controlBounds.height / 2,
	);
	await expectAnimationsSettled(giftSurface);
	const beforePress = await rect(giftSurface);

	await page.mouse.down();
	try {
		for (const sample of await sampleFrameRects(giftSurface, 4)) {
			expectSameRect(sample, beforePress);
		}
	} finally {
		await page.mouse.move(1, 1);
		await page.mouse.up();
	}
}

function activeGift(page: Page, view: 'card' | 'list', name: string) {
	return page
		.locator(
			`[data-wishlist-gift-collection][data-view-mode="${view}"]:not([inert]):not([aria-hidden="true"]) [data-gift-item]`,
		)
		.filter({ has: page.getByRole('heading', { name, exact: true }) });
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
		expectPixelsNear(actualContent.x - restingContent.x, surfaceDelta.x);
		expectPixelsNear(actualContent.y - restingContent.y, surfaceDelta.y);
		expectPixelsNear(actualContent.width, restingContent.width);
		expectPixelsNear(actualContent.height, restingContent.height);
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
	test('nested gift-card controls own hover and press while outside menu clicks only dismiss', async ({
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
			.filter({ has: page.getByTestId('reserve-button') })
			.filter({ has: page.locator('a[target="_blank"]') })
			.first();
		const cardSurface = visualSurface(owner);
		const more = owner.getByTestId('gift-more-actions');
		const moreSurface = visualSurface(more);
		const heading = owner.getByRole('heading', { level: 3 });
		const image = owner.getByTestId('gift-card-image-frame');
		const like = owner.locator('button:has([data-like-heart])');
		const reserve = owner.getByTestId('reserve-button');
		const sourceLink = owner.locator('a[target="_blank"]').first();
		await expect(owner).toBeVisible();
		for (const control of [more, like, reserve, sourceLink]) {
			await expect(control).toBeVisible();
		}

		await page.mouse.move(1, 1);
		const restingMoreBackground = await moreSurface.evaluate(
			(element) => getComputedStyle(element).backgroundColor,
		);
		await heading.hover();
		await expect
			.poll(() =>
				moreSurface.evaluate((element) => getComputedStyle(element).backgroundColor),
			)
			.toBe(restingMoreBackground);
		await expect
			.poll(() => cardSurface.evaluate((element) => getComputedStyle(element).translate))
			.toBe('0px -2px');
		await expectAnimationsSettled(cardSurface);

		for (const control of [sourceLink, like, reserve]) {
			await control.hover();
			await expect
				.poll(() => cardSurface.evaluate((element) => getComputedStyle(element).translate))
				.toBe('0px -2px');
			await expectAnimationsSettled(cardSurface);
			const hoveredCard = await rect(cardSurface);
			await page.mouse.down();
			try {
				await expect
					.poll(() => cardSurface.evaluate((element) => getComputedStyle(element).scale))
					.toBe('none');
				expectSameRect(await rect(cardSurface), hoveredCard);
			} finally {
				await page.mouse.move(1, 1);
				await page.mouse.up();
			}
		}

		await more.hover();
		await expect
			.poll(() =>
				moreSurface.evaluate((element) => getComputedStyle(element).backgroundColor),
			)
			.not.toBe(restingMoreBackground);
		await expectAnimationsSettled(cardSurface);
		const hoveredCard = await rect(cardSurface);
		await page.mouse.down();
		try {
			await expect
				.poll(() => moreSurface.evaluate((element) => getComputedStyle(element).scale))
				.toBe('0.98');
			await expect
				.poll(() => cardSurface.evaluate((element) => getComputedStyle(element).scale))
				.toBe('none');
			expectSameRect(await rect(cardSurface), hoveredCard);
		} finally {
			await page.mouse.up();
		}

		const menu = page.locator('[data-slot="dropdown-menu-content"]:visible');
		await expect(menu).toBeVisible();
		await expect
			.poll(() => cardSurface.evaluate((element) => getComputedStyle(element).pointerEvents))
			.toBe('none');
		await expect
			.poll(() =>
				more.evaluate((element) => getComputedStyle(element, '::after').pointerEvents),
			)
			.toBe('none');
		await expect
			.poll(() => like.evaluate((element) => getComputedStyle(element).pointerEvents))
			.toBe('none');
		const imageBounds = await image.boundingBox();
		expect(imageBounds).not.toBeNull();
		await page.mouse.click(
			imageBounds!.x + imageBounds!.width / 2,
			imageBounds!.y + imageBounds!.height / 2,
		);
		await expect(menu).toBeHidden();
		await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
	});

	test('nested controls stay isolated across List and mobile layouts', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-nested-controls');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		const giftName = 'Dárek s izolovanými akcemi';
		await createWishlistForSomeoneAndNavigate(page, {
			title: 'Izolované akce dárku',
			recipientName: 'Anička',
		});
		await addGift(page, giftName, { primaryLink: 'https://example.com/product' });
		await shareWishlist(page);

		const switchView = async (view: 'card' | 'list') => {
			const viewControl = page.getByTestId(`gift-view-${view}`).filter({ visible: true });
			await viewControl.click();
			await expect(viewControl).toHaveAttribute('aria-checked', 'true');
			const gift = activeGift(page, view, giftName);
			await expect(gift).toBeVisible();
			return gift;
		};

		let gift = await switchView('list');
		let sourceLink = gift.locator('a[target="_blank"]').first();
		let like = gift.locator('button:has([data-like-heart])');
		let reserve = gift.getByTestId('reserve-button');
		let received = await visibleDirectReceivedAction(gift);
		let more = gift.getByTestId('gift-more-actions');
		expect(received).not.toBeNull();
		if (received === null) {
			throw new Error('Manager fixture must expose the Received action in desktop List');
		}
		for (const control of [sourceLink, like, reserve, received, more]) {
			await expectHeldNestedPressDoesNotMove(page, gift, control, 'list');
		}

		await more.click();
		const menu = page.locator('[data-slot="dropdown-menu-content"]:visible');
		await expect(menu).toBeVisible();
		const headingBounds = await gift.getByRole('heading', { name: giftName }).boundingBox();
		expect(headingBounds).not.toBeNull();
		if (headingBounds === null) {
			throw new Error('Gift heading has no bounding box');
		}
		await page.mouse.click(
			headingBounds.x + headingBounds.width / 2,
			headingBounds.y + headingBounds.height / 2,
		);
		await expect(menu).toBeHidden();
		await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);

		const popupPromise = page.waitForEvent('popup');
		await sourceLink.click();
		const popup = await popupPromise;
		await expect.poll(() => popup.url()).toBe('https://example.com/product');
		await popup.close();
		await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);

		for (const view of ['card', 'list'] as const) {
			await page.setViewportSize({ width: 390, height: 844 });
			gift = await switchView(view);
			sourceLink = gift.locator('a[target="_blank"]').first();
			like = gift.locator('button:has([data-like-heart])');
			reserve = gift.getByTestId('reserve-button');
			received = await visibleDirectReceivedAction(gift);
			more = gift.getByTestId('gift-more-actions');
			const controls = [sourceLink, like, reserve, more];
			if (received !== null) {
				controls.push(received);
			}
			for (const control of controls) {
				await expectHeldNestedPressDoesNotMove(page, gift, control, view);
			}

			await more.click();
			const sheet = page.getByRole('dialog', { name: giftName });
			await expect(sheet).toBeVisible();
			const sheetOverlay = page.locator('[data-slot="sheet-overlay"]:visible');
			await expect(sheetOverlay).toBeVisible();
			await sheetOverlay.click({ position: { x: 8, y: 8 } });
			await expect(sheet).toBeHidden();
			await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
		}

		await page.setViewportSize({ width: 1280, height: 900 });
		gift = await switchView('list');
		received = await visibleDirectReceivedAction(gift);
		expect(received).not.toBeNull();
		if (received === null) {
			throw new Error('Manager fixture must expose the Received action in desktop List');
		}
		const receivedMutation = page.waitForResponse(
			(response) =>
				response.request().method() === 'POST' && response.url().startsWith(baseURL!),
		);
		await received.click();
		await receivedMutation;
		await expect(gift.locator('[data-state-primary][data-state-kind="received"]')).toHaveText(
			'Přijato',
		);
		await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);

		await page.evaluate(() => {
			const compactValue = JSON.stringify('compact');
			localStorage.setItem('prejemesi-gift-view-mode', compactValue);
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: 'prejemesi-gift-view-mode',
					newValue: compactValue,
				}),
			);
		});
		const compactCollection = page.locator(
			'[data-wishlist-gift-collection][data-view-mode="compact"]:not([inert])',
		);
		await expect(compactCollection).toBeVisible();
		const compactRow = compactCollection.locator('tr').filter({ hasText: giftName });
		await expect(compactRow).toBeVisible();
		const compactLike = compactRow.locator('button:has([data-like-heart])');
		const initialLikeState = await compactLike.getAttribute('aria-pressed');
		const likeMutation = page.waitForResponse(
			(response) =>
				response.request().method() === 'POST' && response.url().startsWith(baseURL!),
		);
		await compactLike.click();
		await likeMutation;
		await expect(compactLike).toHaveAttribute(
			'aria-pressed',
			initialLikeState === 'true' ? 'false' : 'true',
		);
		await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);

		const compactPopupPromise = page.waitForEvent('popup');
		await compactRow.locator('a[target="_blank"]').click();
		const compactPopup = await compactPopupPromise;
		await expect.poll(() => compactPopup.url()).toBe('https://example.com/product');
		await compactPopup.close();
		await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
		await page.context().close();
	});

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
			.filter({
				has: page.getByRole('heading', {
					name: 'Kávovar DeLonghi',
					exact: true,
					level: 3,
				}),
			});
		const surface = visualSurface(owner);
		const content = [
			owner.getByTestId('gift-card-image-frame'),
			owner.getByRole('heading', { level: 3 }),
			owner.getByTestId('gift-card-price').locator('span'),
			owner.getByTestId('gift-more-actions'),
		];
		await expect(owner).toBeVisible();
		await owner.scrollIntoViewIfNeeded();
		for (const element of content) {
			await expect(element).toBeVisible();
		}
		await content[1]!.scrollIntoViewIfNeeded();
		await page.mouse.move(0, 500);
		await page.mouse.move(1, 1);
		await expect
			.poll(() => surface.evaluate((element) => getComputedStyle(element).translate))
			.toBe('none');
		await owner.scrollIntoViewIfNeeded();
		const resting = await giftGeometry(owner, surface, content);
		const pressTarget = resting.content[1]!;
		const point = {
			x: pressTarget.x + pressTarget.width / 2,
			y: pressTarget.y + pressTarget.height / 2,
		};

		await page.mouse.move(point.x, point.y);
		await expect
			.poll(() => surface.evaluate((element) => getComputedStyle(element).translate))
			.toBe('0px -2px');
		const hovered = await giftGeometry(owner, surface, content);
		expectSameRect(hovered.owner, resting.owner);
		expectPixelsNear(hovered.surface.y - resting.surface.y, -2);
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
			expectPixelsNear(active.surface.width, resting.surface.width * 0.98);
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
