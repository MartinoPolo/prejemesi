import { test, expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import {
	createAuthenticatedContext,
	loginViaApi,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';

const SEED_PASSWORD = ['password', '123'].join('');
const MOBILE_WIDTHS = [320, 360, 390, 430] as const;
const MOBILE_HEIGHT = 900;
const DESKTOP_WIDTH = 1180;
const DESKTOP_HEIGHT = 900;
const MARTIN = { email: 'martin@test.cz', password: SEED_PASSWORD };
const PETR = { email: 'petr@test.cz', password: SEED_PASSWORD };
const MODERATOR_ROUTE = '/w/knihy026';
const RECIPIENT_ROUTE = '/w/bdaymart';

test.use({ trace: 'off', screenshot: 'off' });

async function seededPage(
	browser: Browser,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
	user: typeof MARTIN,
): Promise<Page> {
	const cookies = await loginViaApi(request, baseURL, user);
	const context = await createAuthenticatedContext(browser, cookies, baseURL);
	return context.newPage();
}

async function waitForStableLayout(page: Page): Promise<void> {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		});
	});
}

async function selectView(page: Page, view: 'card' | 'list'): Promise<void> {
	const control = page.getByTestId(`gift-view-${view}`);
	await control.click();
	await expect(control).toHaveAttribute('aria-checked', 'true');
	await expect(
		page.getByTestId(view === 'card' ? 'wishlist-gift-card-grid' : 'wishlist-gift-list'),
	).toBeVisible();
	await waitForStableLayout(page);
}

async function attachMetrics(testInfo: TestInfo, name: string, value: unknown): Promise<void> {
	await testInfo.attach(name, {
		body: Buffer.from(JSON.stringify(value, null, 2)),
		contentType: 'application/json',
	});
}

test('mobile List preserves portrait side-crop, bounded overlays, and a single action lane', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const page = await seededPage(browser, request, baseURL!, MARTIN);
	try {
		await page.setViewportSize({ width: MOBILE_WIDTHS[0], height: MOBILE_HEIGHT });
		await page.goto(MODERATOR_ROUTE);
		await waitForAppHydration(page, { timeout: 45_000 });
		await selectView(page, 'list');

		const measurements: unknown[] = [];
		for (const width of MOBILE_WIDTHS) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			await waitForStableLayout(page);
			const items = page.getByTestId('gift-list-item');
			await expect(items.first()).toBeVisible();
			const geometry = await items.evaluateAll((elements) =>
				elements.map((element) => {
					const item = element.getBoundingClientRect();
					const itemStyle = getComputedStyle(element);
					const verticalBorder =
						Number.parseFloat(itemStyle.borderTopWidth) +
						Number.parseFloat(itemStyle.borderBottomWidth);
					const image = element.querySelector<HTMLElement>(
						'[data-testid="gift-list-image"]',
					)!;
					const imageRect = image.getBoundingClientRect();
					const imageStyle = getComputedStyle(image);
					const imageContentCenter =
						imageRect.left +
						(imageRect.width +
							Number.parseFloat(imageStyle.borderLeftWidth) -
							Number.parseFloat(imageStyle.borderRightWidth)) /
							2;
					const square = image.querySelector<HTMLElement>(
						'[data-testid="gift-list-square-composition"]',
					)!;
					const squareRect = square.getBoundingClientRect();
					const title = element.querySelector<HTMLElement>('h3')!;
					const description =
						element.querySelector<HTMLElement>('.gift-list-description');
					const actionRow = element.querySelector<HTMLElement>(
						'[data-testid="gift-action-row"]',
					);
					const visibleActions = actionRow
						? [...actionRow.querySelectorAll<HTMLElement>('button')]
								.filter((button) => {
									const style = getComputedStyle(button);
									return (
										!button.inert &&
										button.getAttribute('aria-hidden') !== 'true' &&
										style.visibility !== 'hidden'
									);
								})
								.map((button) => button.getBoundingClientRect().toJSON())
						: [];
					const overlays = [
						...image.querySelectorAll<HTMLElement>(
							'[data-testid="gift-category-badge"], [data-testid="gift-priority-badge"], [data-testid="gift-state-overlay"] > span',
						),
					].filter((overlay) => overlay.getBoundingClientRect().width > 0);
					const overlayRects = overlays.map((overlay) => overlay.getBoundingClientRect());
					const lineCount = (target: HTMLElement | null) => {
						if (target === null) {
							return 0;
						}
						const style = getComputedStyle(target);
						return Math.round(
							target.getBoundingClientRect().height /
								Number.parseFloat(style.lineHeight),
						);
					};
					return {
						item: item.toJSON(),
						verticalBorder,
						image: imageRect.toJSON(),
						imageContentCenter,
						imageContentWidth:
							imageRect.width -
							Number.parseFloat(imageStyle.borderLeftWidth) -
							Number.parseFloat(imageStyle.borderRightWidth),
						square: squareRect.toJSON(),
						titleLines: lineCount(title),
						descriptionLines: lineCount(description),
						visibleActions,
						overflow: actionRow?.dataset.overflowActions ?? '',
						overlays: overlayRects.map((rect) => rect.toJSON()),
						overlayCollision: overlayRects.some((left, index) =>
							overlayRects
								.slice(index + 1)
								.some(
									(right) =>
										left.left < right.right &&
										left.right > right.left &&
										left.top < right.bottom &&
										left.bottom > right.top,
								),
						),
					};
				}),
			);

			for (const item of geometry) {
				expect(item.image.height).toBeCloseTo(item.item.height - item.verticalBorder, 0);
				expect(item.imageContentWidth).toBeLessThan(item.image.height);
				expect(item.square.width).toBeCloseTo(item.square.height, 1);
				expect(item.square.x + item.square.width / 2).toBeCloseTo(
					item.imageContentCenter,
					1,
				);
				expect(item.square.width).toBeGreaterThan(item.imageContentWidth);
				expect(item.titleLines).toBeLessThanOrEqual(2);
				expect(item.descriptionLines).toBeLessThanOrEqual(2);
				expect(item.overlayCollision).toBe(false);
				if (item.visibleActions.length > 1) {
					const top = item.visibleActions[0]!.y;
					expect(
						item.visibleActions.every((action) => Math.abs(action.y - top) < 1),
					).toBe(true);
				}
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
			measurements.push({ width, geometry });
		}

		await page.setViewportSize({ width: MOBILE_WIDTHS[0], height: MOBILE_HEIGHT });
		await waitForStableLayout(page);
		const overflowedReceivedRow = page.locator(
			'[data-testid="gift-action-row"][data-overflow-actions~="received"]',
		);
		await expect(overflowedReceivedRow.first()).toBeVisible();
		const overflowedGift = overflowedReceivedRow
			.first()
			.locator('xpath=ancestor::*[@data-gift-item][1]');
		const overflowedGiftName = await overflowedGift
			.getByRole('heading', { level: 3 })
			.textContent();
		expect(overflowedGiftName).not.toBeNull();
		const more = overflowedGift.getByTestId('gift-more-actions');
		await expect(more).toBeVisible();
		await more.click();
		const sheet = page.getByRole('dialog', { name: overflowedGiftName! });
		await expect(sheet).toBeVisible();
		await expect(
			sheet.getByRole('button', { name: /Označit jako (ne)?přijatý/ }),
		).toBeVisible();
		await page.keyboard.press('Escape');
		await attachMetrics(testInfo, 'mobile-list-geometry.json', measurements);
	} finally {
		await page.context().close();
	}
});

test('desktop Grid aligns collection content tracks across rows and groups', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const page = await seededPage(browser, request, baseURL!, MARTIN);
	try {
		await page.setViewportSize({ width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT });
		await page.goto(MODERATOR_ROUTE);
		await waitForAppHydration(page, { timeout: 45_000 });
		await selectView(page, 'card');

		const tracks = await page.locator('[data-gift-item]').evaluateAll((cards) =>
			cards.map((card) => {
				const cardRect = card.getBoundingClientRect();
				const offset = (selector: string) => {
					const element = card.querySelector<HTMLElement>(selector);
					return element === null
						? null
						: element.getBoundingClientRect().top - cardRect.top;
				};
				return {
					title: offset('[data-gift-card-track="title"]'),
					description: offset('[data-gift-card-track="description"]'),
					links: offset('[data-gift-card-track="links"]'),
					price: offset('[data-gift-card-track="price"]'),
					actions: offset('[data-gift-card-track="actions"]'),
				};
			}),
		);
		expect(tracks.length).toBeGreaterThan(4);
		for (const key of ['title', 'description', 'links', 'price', 'actions'] as const) {
			const values = tracks.map((track) => track[key]);
			expect(values.every((value) => value !== null)).toBe(true);
			const numericValues = values.filter((value): value is number => value !== null);
			expect(numericValues).toHaveLength(tracks.length);
			expect(Math.max(...numericValues) - Math.min(...numericValues)).toBeLessThanOrEqual(1);
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(DESKTOP_WIDTH);
		await attachMetrics(testInfo, 'desktop-grid-tracks.json', tracks);
	} finally {
		await page.context().close();
	}
});

test('recipient and visitor layouts preserve ordinary privacy in Grid and List', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const evidence: unknown[] = [];
	for (const persona of [
		{ user: MARTIN, route: RECIPIENT_ROUTE, role: 'recipient' },
		{ user: MARTIN, route: '/w/xmas2026', role: 'promoted-recipient' },
		{ user: PETR, route: MODERATOR_ROUTE, role: 'visitor' },
	] as const) {
		const page = await seededPage(browser, request, baseURL!, persona.user);
		try {
			await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
			await page.goto(persona.route);
			await waitForAppHydration(page, { timeout: 45_000 });
			for (const view of ['card', 'list'] as const) {
				await selectView(page, view);
				const items = page.locator('[data-gift-item]');
				await expect(items.first()).toBeVisible();
				if (persona.role !== 'visitor') {
					await expect(items.getByTestId('reserve-button')).toHaveCount(0);
					await expect(
						items.locator('[data-like-heart]').locator('xpath=ancestor::button'),
					).toHaveCount(0);
					if (persona.role === 'recipient') {
						await expect(
							items.getByText(/Rezervováno|Rezervoval|Rezervovali/),
						).toHaveCount(0);
					}
				}
				await expect(items.getByText(/Jana Dvořáková|Eva Králová/)).toHaveCount(0);
				evidence.push({
					role: persona.role,
					view,
					itemCount: await items.count(),
					scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
				});
			}
		} finally {
			await page.context().close();
		}
	}
	await attachMetrics(testInfo, 'privacy-and-views.json', evidence);
});
