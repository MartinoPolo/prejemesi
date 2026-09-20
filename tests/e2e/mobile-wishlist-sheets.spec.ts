import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createManagerWishlist } from './mobile-wishlist.helpers.js';

test.describe('mobile wishlist acceptance', () => {
	test('toolbar mask blocks gifts and Display remains one scrollable focus-managed sheet', async ({
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
		await createManagerWishlist(page, 'Mobilní panely nástrojů');
		await page.setViewportSize({ width: 390, height: 500 });

		const toolbar = page.getByTestId('wishlist-toolbar');
		const toolbarMask = page.getByTestId('wishlist-toolbar-mask');
		const firstGift = page.locator('[data-gift-item]').first();
		await firstGift.evaluate((element) => element.scrollIntoView({ block: 'start' }));
		await page.evaluate(
			() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
		);
		const [toolbarBox, maskBox, giftBox] = await Promise.all([
			toolbar.boundingBox(),
			toolbarMask.boundingBox(),
			firstGift.boundingBox(),
		]);
		expect(toolbarBox).not.toBeNull();
		expect(maskBox).not.toBeNull();
		expect(giftBox).not.toBeNull();
		const maskedPoint = {
			x: giftBox!.x + giftBox!.width / 2,
			y: (maskBox!.y + toolbarBox!.y) / 2,
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

		const trigger = page.getByTestId('mobile-display-trigger');
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: m.gift_display_options() });
		await expect(dialog).toBeVisible();
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
		await page.context().close();
	});
});
