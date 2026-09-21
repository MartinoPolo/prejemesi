import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { DEPTH_STYLES } from '../../src/lib/theme/depth_styles.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	box,
	createRecipientWishlist,
	waitForGiftAnimationsToSettle,
} from './mobile-wishlist.helpers.js';

const COLOR_MODES = ['light', 'dark'] as const;

test.describe('mobile wishlist acceptance', () => {
	test('hero boundary, sticky mask, and Display sheet keep their paint order', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-sheets'),
		);
		await createRecipientWishlist(page, 'Mobilní panely nástrojů');
		await page.setViewportSize({ width: 390, height: 500 });

		const appScroller = page.locator('.app-content');
		const hero = page.getByTestId('wishlist-mobile-hero');
		const toolbar = page.getByTestId('wishlist-toolbar');
		const toolbarStickyContainer = toolbar.locator('..');
		const toolbarMask = page.getByTestId('wishlist-toolbar-mask');
		const firstGift = page.locator('[data-gift-item]').first();
		const scrollAppTo = async (scrollTop: number) => {
			await appScroller.evaluate((element, top) => {
				element.scrollTop = top;
			}, scrollTop);
			await expect
				.poll(() => appScroller.evaluate((element) => element.scrollTop))
				.toBeCloseTo(scrollTop, 0);
			await page.evaluate(
				() =>
					new Promise<void>((resolve) =>
						requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
					),
			);
		};
		await waitForGiftAnimationsToSettle(page);

		const [
			initialScrollportBox,
			initialHeroBox,
			initialToolbarBox,
			initialGiftBox,
			ordinaryShadowOffset,
			mobileStickyTop,
		] = await Promise.all([
			box(appScroller),
			box(hero),
			box(toolbar),
			box(firstGift),
			toolbar.evaluate((element) =>
				Number.parseFloat(
					getComputedStyle(element).getPropertyValue('--elevation-ordinary-offset'),
				),
			),
			toolbarStickyContainer.evaluate((element) =>
				Number.parseFloat(getComputedStyle(element).top),
			),
		]);
		const normalFlowGap = initialToolbarBox.y - (initialHeroBox.y + initialHeroBox.height);
		expect(normalFlowGap).toBeCloseTo(12, 1);

		const boundaryClip = {
			x: initialHeroBox.x,
			y: initialHeroBox.y + initialHeroBox.height,
			width: initialHeroBox.width,
			height: ordinaryShadowOffset,
		};
		for (const colorMode of COLOR_MODES) {
			for (const depth of DEPTH_STYLES) {
				await page.locator('html').evaluate(
					(element, appearance) => {
						element.dataset.depth = appearance.depth;
						element.classList.toggle('dark', appearance.colorMode === 'dark');
					},
					{ colorMode, depth },
				);
				await page.evaluate(
					() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
				);
				const paintedBoundary = await page.screenshot({
					clip: boundaryClip,
					animations: 'disabled',
				});
				await toolbarMask.evaluate((element) => {
					element.style.visibility = 'hidden';
				});
				const maskHiddenReference = await page.screenshot({
					clip: boundaryClip,
					animations: 'disabled',
				});
				await toolbarMask.evaluate((element) => {
					element.style.removeProperty('visibility');
				});
				expect(
					paintedBoundary.equals(maskHiddenReference),
					`${colorMode}/${depth}: the toolbar mask must not repaint the hero's lower shadow`,
				).toBe(true);
			}
		}

		await page.locator('html').evaluate((element) => {
			element.dataset.depth = 'ink';
			element.classList.remove('dark');
		});
		const initialMaskBox = await box(toolbarMask);
		expect(initialMaskBox.y - (initialHeroBox.y + initialHeroBox.height)).toBeCloseTo(
			ordinaryShadowOffset,
			1,
		);

		const heroBoundaryClipScrollTop =
			initialHeroBox.y +
			initialHeroBox.height +
			ordinaryShadowOffset -
			initialScrollportBox.y;
		const partialScrollTop = Math.floor(heroBoundaryClipScrollTop / 2);
		await scrollAppTo(partialScrollTop);
		const [partialHeroBox, partialToolbarBox, partialMaskBox] = await Promise.all([
			box(hero),
			box(toolbar),
			box(toolbarMask),
		]);
		expect(
			partialHeroBox.y + partialHeroBox.height + ordinaryShadowOffset,
			'the hero boundary remains visible during an ordinary partial scroll',
		).toBeGreaterThan(initialScrollportBox.y);
		expect(partialToolbarBox.y - (partialHeroBox.y + partialHeroBox.height)).toBeCloseTo(
			normalFlowGap,
			1,
		);
		expect(partialMaskBox.y - (partialHeroBox.y + partialHeroBox.height)).toBeCloseTo(
			ordinaryShadowOffset,
			1,
		);

		const stickyThreshold = initialToolbarBox.y - initialScrollportBox.y - mobileStickyTop;
		expect(stickyThreshold).toBeGreaterThan(partialScrollTop);
		const trigger = page.getByTestId('mobile-display-trigger');
		const stickyTransitionPositions = [
			{
				name: 'just before',
				scrollTop: stickyThreshold - 1,
				expectedToolbarTop: mobileStickyTop + 1,
				expectedMaskTop: 1,
				stuck: false,
			},
			{
				name: 'at',
				scrollTop: stickyThreshold,
				expectedToolbarTop: mobileStickyTop,
				expectedMaskTop: 0,
				stuck: true,
			},
			{
				name: 'just after',
				scrollTop: stickyThreshold + 1,
				expectedToolbarTop: mobileStickyTop,
				expectedMaskTop: 0,
				stuck: true,
			},
		] as const;
		for (const position of stickyTransitionPositions) {
			await scrollAppTo(position.scrollTop);
			const [transitionHeroBox, transitionToolbarBox, transitionMaskBox] = await Promise.all([
				box(hero),
				box(toolbar),
				box(toolbarMask),
			]);
			expect(
				transitionToolbarBox.y - initialScrollportBox.y,
				`${position.name} threshold: toolbar position relative to its scrollport`,
			).toBeCloseTo(position.expectedToolbarTop, 1);
			expect(
				transitionMaskBox.y - initialScrollportBox.y,
				`${position.name} threshold: mask position relative to its scrollport`,
			).toBeCloseTo(position.expectedMaskTop, 1);
			if (!position.stuck) {
				expect(
					transitionHeroBox.y + transitionHeroBox.height,
					'the hero face leaves the scrollport before the toolbar becomes sticky',
				).toBeLessThanOrEqual(initialScrollportBox.y);
				continue;
			}

			const transitionTriggerBox = await box(trigger);
			const controlOnTop = await page.evaluate(
				({ x, y }) =>
					Boolean(
						document
							.elementFromPoint(x, y)
							?.closest('[data-testid="mobile-display-trigger"]'),
					),
				{
					x: transitionTriggerBox.x + transitionTriggerBox.width / 2,
					y: transitionTriggerBox.y + transitionTriggerBox.height / 2,
				},
			);
			expect(controlOnTop, `${position.name} threshold: toolbar controls stay topmost`).toBe(
				true,
			);
		}

		await scrollAppTo(initialGiftBox.y - initialScrollportBox.y);
		const [toolbarBox, maskBox, giftBox] = await Promise.all([
			box(toolbar),
			box(toolbarMask),
			box(firstGift),
		]);
		expect(toolbarBox.y - initialScrollportBox.y).toBeCloseTo(mobileStickyTop, 1);
		expect(maskBox.y).toBeCloseTo(initialScrollportBox.y, 1);
		expect(toolbarBox.y - maskBox.y).toBeCloseTo(mobileStickyTop, 1);

		const triggerBox = await box(trigger);
		const triggerCenter = {
			x: triggerBox.x + triggerBox.width / 2,
			y: triggerBox.y + triggerBox.height / 2,
		};
		const maskedPoint = {
			x: giftBox.x + giftBox.width / 2,
			y: (maskBox.y + toolbarBox.y) / 2,
		};
		const maskedStack = await page.evaluate(({ x, y }) => {
			const elements = document.elementsFromPoint(x, y);
			return {
				maskPresent: elements.some(
					(element) =>
						(element as HTMLElement).dataset.testid === 'wishlist-toolbar-mask',
				),
				giftBehindMask: elements.some(
					(element) => element.closest('[data-gift-item]') !== null,
				),
				topIsGift: Boolean(elements[0]?.closest('[data-gift-item]')),
			};
		}, maskedPoint);
		expect(maskedStack).toEqual({
			maskPresent: true,
			giftBehindMask: true,
			topIsGift: false,
		});
		await page.mouse.click(maskedPoint.x, maskedPoint.y);
		await expect(page.getByRole('dialog')).toHaveCount(0);

		await trigger.click();
		const dialog = page.getByRole('dialog', { name: m.gift_display_options() });
		await expect(dialog).toBeVisible();
		const overlayPaintOrder = await page.evaluate(({ x, y }) => {
			const topElement = document.elementsFromPoint(x, y)[0];
			return {
				overlayOnTop: Boolean(
					topElement?.closest('[data-slot="sheet-overlay"], [data-slot="sheet-content"]'),
				),
				toolbarControlOnTop: Boolean(
					topElement?.closest('[data-testid="mobile-display-trigger"]'),
				),
			};
		}, triggerCenter);
		expect(overlayPaintOrder).toEqual({ overlayOnTop: true, toolbarControlOnTop: false });
		const sectionSwitches = [
			dialog.getByTestId('mobile-sheet-sort-switch'),
			dialog.getByTestId('mobile-sheet-grouping-switch'),
			dialog.getByTestId('mobile-sheet-filter-switch'),
		];
		for (const sectionSwitch of sectionSwitches) {
			await sectionSwitch.click();
			await expect(sectionSwitch).toHaveAttribute('aria-pressed', 'true');
			await expect(sectionSwitch).toBeFocused();
			await expect(page.getByRole('dialog')).toHaveCount(1);
		}

		await sectionSwitches[0]!.click();
		const options = dialog.getByTestId('mobile-sheet-scroll');
		await expect(options).toHaveCSS('overflow-y', 'auto');
		expect(await options.evaluate((element) => element.scrollHeight)).toBeGreaterThan(
			await options.evaluate((element) => element.clientHeight),
		);
		await options.evaluate((element) => {
			element.scrollTop = element.scrollHeight;
		});
		await expect
			.poll(() => options.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(0);

		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();

		await page.setViewportSize({ width: 800, height: 500 });
		await scrollAppTo(0);
		await expect(page.getByTestId('desktop-display-trigger')).toBeVisible();
		const desktopHeader = page.getByTestId('wishlist-banner').locator('..');
		const [desktopHeaderBox, desktopToolbarBox, desktopMaskBox, desktopStickyTop] =
			await Promise.all([
				box(desktopHeader),
				box(toolbar),
				box(toolbarMask),
				toolbarStickyContainer.evaluate((element) =>
					Number.parseFloat(getComputedStyle(element).top),
				),
			]);
		expect(desktopStickyTop).toBe(12);
		const desktopGeometry = {
			headerGap: desktopToolbarBox.y - (desktopHeaderBox.y + desktopHeaderBox.height),
			toolbarTop: desktopToolbarBox.y,
			maskTop: desktopMaskBox.y,
		};
		expect(desktopGeometry.headerGap).toBeCloseTo(24, 1);
		expect(desktopGeometry.toolbarTop - desktopGeometry.maskTop).toBeCloseTo(
			desktopStickyTop,
			1,
		);
		for (const colorMode of COLOR_MODES) {
			for (const depth of DEPTH_STYLES) {
				await page.locator('html').evaluate(
					(element, appearance) => {
						element.dataset.depth = appearance.depth;
						element.classList.toggle('dark', appearance.colorMode === 'dark');
					},
					{ colorMode, depth },
				);
				const [appearanceHeaderBox, appearanceToolbarBox, appearanceMaskBox] =
					await Promise.all([box(desktopHeader), box(toolbar), box(toolbarMask)]);
				expect(
					appearanceToolbarBox.y - (appearanceHeaderBox.y + appearanceHeaderBox.height),
					`${colorMode}/${depth}: desktop header-to-toolbar geometry`,
				).toBeCloseTo(desktopGeometry.headerGap, 1);
				expect(
					appearanceToolbarBox.y,
					`${colorMode}/${depth}: desktop toolbar top`,
				).toBeCloseTo(desktopGeometry.toolbarTop, 1);
				expect(appearanceMaskBox.y, `${colorMode}/${depth}: desktop mask top`).toBeCloseTo(
					desktopGeometry.maskTop,
					1,
				);
			}
		}
		await page.context().close();
	});
});
