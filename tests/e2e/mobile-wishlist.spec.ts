import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	MOBILE_HEIGHT,
	WIDTHS,
	createManagerWishlist,
	resetAllScroll,
	waitForGiftAnimationsToSettle,
	box,
	expectInsideViewport,
	expectContainedReceivedActions,
	attachScreenshot,
} from './mobile-wishlist.helpers.js';

test.describe('mobile wishlist acceptance', () => {
	test('320/360/390 card geometry keeps the approved gutter, hero, grid and bounds', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-geometry'),
		);
		await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await createManagerWishlist(page);

		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			const logo = page.locator('.topbar .logo');
			const logoMark = logo.locator('.logo-icon-wrap');
			await expect(logo).toBeVisible();
			await expect(logo.locator('.logo-text')).toContainText('přejeme si');
			expect(await logoMark.evaluate((mark) => getComputedStyle(mark).width)).toBe('40px');
			for (const action of await page.locator('.topbar button:visible').all()) {
				expect((await box(action)).height).toBeGreaterThanOrEqual(40);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
			await expect(page.getByTestId('wishlist-mobile-hero')).toBeVisible();
			await expect(page.getByTestId('wishlist-gift-card-grid')).toBeVisible();
			const pageShell = page.getByTestId('wishlist-page-shell');
			const heroLocator = page.getByTestId('wishlist-mobile-hero');
			const toolbarLocator = page.getByTestId('wishlist-toolbar');
			const [shell, hero, toolbar, routeLayout] = await Promise.all([
				box(pageShell),
				box(heroLocator),
				box(toolbarLocator),
				pageShell.evaluate((shellElement) => {
					const content = shellElement.closest('main');
					const shellRect = shellElement.getBoundingClientRect();
					const contentRect = content?.getBoundingClientRect();
					return {
						rowGap: Number.parseFloat(getComputedStyle(shellElement).rowGap),
						topInset:
							contentRect === undefined ? null : shellRect.top - contentRect.top,
					};
				}),
			]);
			expect(routeLayout).toEqual({ rowGap: 12, topInset: 12 });
			for (const surface of [shell, hero, toolbar]) {
				expect(surface.x).toBeCloseTo(12, 0);
				expect(width - (surface.x + surface.width)).toBeCloseTo(12, 0);
			}
			expect(hero.x).toBeCloseTo(shell.x, 0);
			expect(hero.width).toBeCloseTo(shell.width, 0);
			expect(toolbar.x).toBeCloseTo(shell.x, 0);
			expect(toolbar.width).toBeCloseTo(shell.width, 0);

			const photo = await box(page.getByTestId('wishlist-mobile-photo'));
			expect(hero.height).toBeGreaterThanOrEqual(104);
			expect(hero.height).toBeLessThanOrEqual(120);
			expect(photo.width).toBeGreaterThanOrEqual(84);
			expect(photo.width).toBeLessThanOrEqual(96);
			expect(photo.height).toBeGreaterThanOrEqual(84);
			expect(photo.height).toBeLessThanOrEqual(96);

			await expectInsideViewport(page.getByTestId('wishlist-mobile-hero'), width);
			await expectInsideViewport(page.getByTestId('wishlist-toolbar'), width);
			await expectInsideViewport(page.getByTestId('wishlist-gift-card-grid'), width);
			for (const item of await page.locator('[data-gift-item]').all()) {
				await expectInsideViewport(item, width);
			}
			await expectContainedReceivedActions(page);
			const mobileImageState = await page
				.getByTestId('gift-card-image-frame')
				.first()
				.evaluate((frame) => {
					const imageFrame = frame.querySelector<HTMLElement>(
						'[data-testid="image-frame"]',
					);
					const fallback = imageFrame?.querySelector<HTMLElement>('[role="img"]');
					const pattern = frame.querySelector<HTMLElement>(
						'[data-testid="gift-card-image-pattern"]',
					);
					const title = frame.parentElement?.querySelector('h3');
					const frameRect = frame.getBoundingClientRect();
					const frameStyle = getComputedStyle(frame);
					const borderTop = Number.parseFloat(frameStyle.borderTopWidth) || 0;
					const borderRight = Number.parseFloat(frameStyle.borderRightWidth) || 0;
					const borderBottom = Number.parseFloat(frameStyle.borderBottomWidth) || 0;
					const borderLeft = Number.parseFloat(frameStyle.borderLeftWidth) || 0;
					const contentBox = {
						x: frameRect.x + borderLeft,
						y: frameRect.y + borderTop,
						width: frameRect.width - borderLeft - borderRight,
						height: frameRect.height - borderTop - borderBottom,
					};
					return {
						contentBox,
						frameRect: frameRect.toJSON(),
						borders: { borderTop, borderRight, borderBottom, borderLeft },
						imageFrame: imageFrame?.getBoundingClientRect().toJSON() ?? null,
						fallback: fallback?.getBoundingClientRect().toJSON() ?? null,
						patternDisplay: pattern === null ? null : getComputedStyle(pattern).display,
						titleSize:
							title == null
								? null
								: Number.parseFloat(getComputedStyle(title).fontSize),
					};
				});
			expect(mobileImageState.imageFrame?.width).toBeCloseTo(
				mobileImageState.contentBox.width,
				2,
			);
			expect(mobileImageState.imageFrame?.height).toBeCloseTo(
				mobileImageState.contentBox.height,
				2,
			);
			expect(mobileImageState.imageFrame?.x).toBeCloseTo(mobileImageState.contentBox.x, 2);
			expect(mobileImageState.imageFrame?.y).toBeCloseTo(mobileImageState.contentBox.y, 2);
			expect(mobileImageState.fallback?.width).toBeCloseTo(
				mobileImageState.contentBox.width,
				2,
			);
			expect(mobileImageState.fallback?.height).toBeCloseTo(
				mobileImageState.contentBox.height,
				2,
			);
			expect(mobileImageState.fallback?.x).toBeCloseTo(mobileImageState.contentBox.x, 2);
			expect(mobileImageState.fallback?.y).toBeCloseTo(mobileImageState.contentBox.y, 2);
			expect(mobileImageState.patternDisplay).toBe('none');
			expect(mobileImageState.titleSize).toBeGreaterThanOrEqual(13);
			expect(mobileImageState.titleSize).toBeLessThanOrEqual(15);

			const cards = await page.locator('[data-gift-item]').evaluateAll((elements) =>
				elements.map((element) => {
					const rect = element.getBoundingClientRect();
					return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
				}),
			);
			const expectedColumns = width === 320 ? 1 : 2;
			expect(new Set(cards.map((card) => Math.round(card.x))).size).toBe(expectedColumns);
			if (expectedColumns === 2) {
				const firstRow = cards.filter((card) => Math.abs(card.y - cards[0]!.y) < 1);
				expect(firstRow).toHaveLength(2);
				expect(firstRow[1]!.x - (firstRow[0]!.x + firstRow[0]!.width)).toBeCloseTo(8, 0);
				expect(firstRow[0]!.height).toBeCloseTo(firstRow[1]!.height, 0);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
			await resetAllScroll(page);
			await attachScreenshot(page, testInfo, `manager-card-${width}`);
		}

		await page.context().close();
	});
	test('manager list presentation keeps continuous square images and contained actions in narrow and wide layouts', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-list'),
		);
		await createManagerWishlist(page, 'Mobilní seznamové zobrazení');
		const listChoice = page.getByTestId('gift-view-list');
		await listChoice.click();
		await expect(listChoice).toHaveAttribute('aria-checked', 'true');
		await page.reload({ waitUntil: 'load' });
		await expect(page.getByTestId('gift-view-list')).toHaveAttribute('aria-checked', 'true');

		for (const width of [...WIDTHS, 768]) {
			await page.setViewportSize({ width, height: MOBILE_HEIGHT });
			const list = page.getByTestId('wishlist-gift-list');
			await expect(list).toBeVisible();
			await expectInsideViewport(list, width);
			const items = await page.getByTestId('gift-list-item').all();
			expect(items).toHaveLength(3);
			const [itemBoxes, listRowGap] = await Promise.all([
				Promise.all(items.map(box)),
				list.evaluate((element) => Number.parseFloat(getComputedStyle(element).rowGap)),
			]);
			if (width < 768) {
				expect(listRowGap).toBe(10);
			}
			for (let index = 1; index < itemBoxes.length; index += 1) {
				expect(
					itemBoxes[index]!.y - (itemBoxes[index - 1]!.y + itemBoxes[index - 1]!.height),
				).toBeCloseTo(listRowGap, 0);
			}
			for (const item of items) {
				await expect(async () => {
					const image = item.getByTestId('gift-list-image');
					const content = item.getByTestId('gift-list-content');
					const [imageBox, contentBox, itemBox, geometry] = await Promise.all([
						box(image),
						box(content),
						box(item),
						item.evaluate((element) => {
							const style = getComputedStyle(element);
							return {
								stacked: element.hasAttribute('data-list-image-stacked'),
								borderTop: Number.parseFloat(style.borderTopWidth),
								borderRight: Number.parseFloat(style.borderRightWidth),
								borderBottom: Number.parseFloat(style.borderBottomWidth),
								borderLeft: Number.parseFloat(style.borderLeftWidth),
								columnGap: Number.parseFloat(style.columnGap),
								rowGap: Number.parseFloat(style.rowGap),
							};
						}),
					]);
					expect(imageBox.width).toBeCloseTo(imageBox.height, 0);
					expect(imageBox.x).toBeCloseTo(itemBox.x + geometry.borderLeft, 0);
					expect(imageBox.y).toBeCloseTo(itemBox.y + geometry.borderTop, 0);
					if (geometry.stacked) {
						expect(WIDTHS).toContain(width);
						expect(imageBox.width).toBeCloseTo(
							itemBox.width - geometry.borderLeft - geometry.borderRight,
							0,
						);
						expect(contentBox.x).toBeCloseTo(imageBox.x, 0);
						expect(contentBox.y).toBeCloseTo(
							imageBox.y + imageBox.height + geometry.rowGap,
							0,
						);
					} else {
						expect(imageBox.y + imageBox.height).toBeCloseTo(
							itemBox.y + itemBox.height - geometry.borderBottom,
							0,
						);
						expect(contentBox.y).toBeCloseTo(imageBox.y, 0);
						expect(contentBox.x).toBeCloseTo(
							imageBox.x + imageBox.width + geometry.columnGap,
							0,
						);
					}
					expect(contentBox.x + contentBox.width).toBeLessThanOrEqual(
						itemBox.x + itemBox.width - geometry.borderRight,
					);
					expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(
						itemBox.y + itemBox.height - geometry.borderBottom,
					);
					const reserve = item.getByTestId('reserve-button');
					await expect(image.getByTestId('reserve-button')).toHaveCount(0);
					await expect(
						item.getByTestId('gift-action-row').getByTestId('reserve-button'),
					).toBeVisible();
					const reserveBox = await box(reserve);
					expect(reserveBox.x).toBeGreaterThanOrEqual(contentBox.x);
					expect(reserveBox.x + reserveBox.width).toBeLessThanOrEqual(
						contentBox.x + contentBox.width,
					);
					expect(reserveBox.y + reserveBox.height).toBeLessThanOrEqual(
						itemBox.y + itemBox.height - geometry.borderBottom,
					);
				}).toPass();
			}
			if (width < 768) {
				const titleSizes = await list
					.locator('h3')
					.evaluateAll((titles) =>
						titles.map((title) => Number.parseFloat(getComputedStyle(title).fontSize)),
					);
				expect(titleSizes.every((size) => size >= 13 && size <= 15)).toBe(true);
			} else {
				expect(
					await Promise.all(
						items.map((item) => item.getAttribute('data-list-image-stacked')),
					),
				).toEqual(items.map(() => null));
			}
			const surface = await items[0]!.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					background: style.backgroundColor,
					border: style.borderStyle,
					shadow: style.boxShadow,
				};
			});
			expect(surface.background).not.toBe('rgba(0, 0, 0, 0)');
			expect(surface.border).not.toBe('none');
			expect(surface.shadow).not.toBe('none');
			await expectContainedReceivedActions(page);
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
			await resetAllScroll(page);
			await attachScreenshot(page, testInfo, `manager-list-${width}`);
		}
		await page.context().close();
	});
	test('English Card and List received actions wrap within manager items at every mobile width', async ({
		browser,
		request,
		baseURL,
	}, testInfo) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-english-actions'),
		);
		const wishlistPath = await createManagerWishlist(page, 'English mobile actions');
		await page.goto(`/en${wishlistPath}`, { waitUntil: 'load' });
		await expect(page.locator('[data-gift-item]')).toHaveCount(3);
		await page.getByTestId('gift-received-toggle').first().click();
		await expect(
			page.getByRole('button', { name: 'Mark as not received', exact: true }),
		).toBeVisible();
		await waitForGiftAnimationsToSettle(page);

		for (const view of ['card', 'list'] as const) {
			const viewControl = page.getByTestId(`gift-view-${view}`);
			await viewControl.click();
			await expect(viewControl).toHaveAttribute('aria-checked', 'true');
			await expect(
				page.getByTestId(
					view === 'card' ? 'wishlist-gift-card-grid' : 'wishlist-gift-list',
				),
			).toBeVisible();
			for (const width of WIDTHS) {
				await page.setViewportSize({ width, height: MOBILE_HEIGHT });
				await expectContainedReceivedActions(page);
				expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
				await resetAllScroll(page);
				await attachScreenshot(page, testInfo, `manager-en-${view}-${width}`);
			}
		}
		await page.context().close();
	});
});
