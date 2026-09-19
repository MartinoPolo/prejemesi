import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import {
	addGift,
	createWishlistForSomeoneAndNavigate,
	shareWishlist,
} from './fixtures/wishlist-helpers.js';
import {
	expectReceivedActionReachable,
	visibleDirectReceivedAction,
} from './fixtures/gift-actions-helpers.js';

export const MOBILE_HEIGHT = 844;
export const WIDTHS = [320, 360, 390] as const;

export async function createManagerWishlist(
	page: Page,
	title = 'Mobilní seznam pro Aničku',
): Promise<string> {
	await createWishlistForSomeoneAndNavigate(page, { title, recipientName: 'Anička' });
	await addGift(page, 'Dlouhý název dárku který se musí bezpečně vejít na přesně dva řádky', {
		price: '1299',
	});
	await addGift(page, 'Dárek bez ceny');
	await addGift(page, 'Třetí dárek', { price: '499' });
	// The reusable share helper targets the labeled desktop action; narrow production uses
	// the approved hero overflow sheet, so temporarily expose that same action without
	// duplicating the share-wizard implementation in this spec.
	await page.setViewportSize({ width: 800, height: MOBILE_HEIGHT });
	await shareWishlist(page);
	await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
	await dismissToasts(page);
	return new URL(page.url()).pathname;
}

export async function addQuantityGift(page: Page, name: string, quantity: number) {
	await page
		.getByRole('button', { name: /Přidat/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('textbox', { name: 'Název' }).fill(name);
	await dialog.locator('#gift-quantity').fill(String(quantity));
	await dialog.getByRole('button', { name: 'Přidat dárek' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible();
}

export function gift(page: Page, name: string) {
	return page.locator('[data-gift-item]').filter({
		has: page.getByRole('heading', { name, exact: true }),
	});
}

export async function dismissToasts(page: Page) {
	const toasts = page.locator('[data-sonner-toast]');
	// Sonner reorders its live stack as each toast exits, so cached nth() locators can start
	// targeting an already-moving toast underneath the next one. Dismiss the current buttons in
	// one DOM turn and then wait for every exit animation to remove its toast.
	await toasts.locator('button[aria-label="Dismiss"]').evaluateAll((buttons) => {
		for (const button of buttons) {
			(button as HTMLButtonElement).click();
		}
	});
	await expect(toasts).toHaveCount(0);
}

export async function resetAllScroll(page: Page) {
	await page.evaluate(() => {
		document.querySelectorAll<HTMLElement>('*').forEach((element) => {
			element.scrollTop = 0;
		});
		window.scrollTo(0, 0);
	});
}

export async function waitForGiftAnimationsToSettle(page: Page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		const animations = document
			.getAnimations()
			.filter(
				(animation) =>
					animation.effect !== null &&
					Number.isFinite(animation.effect.getComputedTiming().endTime),
			);
		await Promise.allSettled(animations.map((animation) => animation.finished));
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);
	});
}

export async function box(locator: Locator) {
	const value = await locator.boundingBox();
	expect(value, `Expected ${locator} to have a bounding box`).not.toBeNull();
	return value!;
}

export async function expectInsideViewport(locator: Locator, width: number) {
	const bounds = await box(locator);
	expect(bounds.x).toBeGreaterThanOrEqual(12);
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 12 + 0.5);
}

export async function expectContainedReceivedActions(
	page: Page,
	{ allowOverflow = false }: { allowOverflow?: boolean } = {},
) {
	await waitForGiftAnimationsToSettle(page);
	const activeCollection = page.locator(
		'[data-wishlist-gift-collection]:not([inert]):not([aria-hidden="true"])',
	);
	await expect(activeCollection).toHaveCount(1);
	const giftItems = activeCollection.locator('[data-gift-item][data-gift-id]');
	await expect(giftItems).not.toHaveCount(0);
	const giftIds = await giftItems.evaluateAll((items) =>
		items.flatMap((item) => {
			const giftId = item.getAttribute('data-gift-id');
			return giftId === null ? [] : [giftId];
		}),
	);
	for (const giftId of giftIds) {
		const item = activeCollection.locator(
			`[data-gift-item][data-gift-id=${JSON.stringify(giftId)}]`,
		);
		await expect(item).toHaveCount(1);
		const itemBox = await box(item);
		const actionRow = item.getByTestId('gift-action-row');
		await expect(actionRow).toBeVisible();
		expect(await actionRow.evaluate((row) => getComputedStyle(row).flexWrap)).toBe('nowrap');
		const visibleCommandGeometry = await actionRow.evaluate((row) => {
			const item = row.closest<HTMLElement>('[data-gift-item]');
			if (item === null) {
				throw new Error('Gift action row has no gift item ancestor');
			}
			const commands = Array.from(row.querySelectorAll<HTMLElement>('button, a'))
				.filter((command) => {
					if (
						command.closest('[inert]') !== null ||
						command.closest('[aria-hidden="true"]') !== null
					) {
						return false;
					}
					let ancestor: HTMLElement | null = command;
					while (ancestor !== null && ancestor !== row) {
						const style = getComputedStyle(ancestor);
						if (style.position === 'fixed' || style.visibility === 'hidden') {
							return false;
						}
						ancestor = ancestor.parentElement;
					}
					const rectangle = command.getBoundingClientRect();
					return rectangle.width > 0 && rectangle.height > 0;
				})
				.map((command) => command.getBoundingClientRect().toJSON())
				.sort((left, right) => left.x - right.x);
			return {
				commands,
				restingOffset:
					Number.parseFloat(
						getComputedStyle(item).getPropertyValue('--elevation-ordinary-offset'),
					) || 0,
			};
		});
		expect(visibleCommandGeometry.commands.length).toBeGreaterThan(0);
		const commandCenterY =
			visibleCommandGeometry.commands[0]!.y + visibleCommandGeometry.commands[0]!.height / 2;
		for (const [index, command] of visibleCommandGeometry.commands.entries()) {
			expect(command.y + command.height / 2).toBeCloseTo(commandCenterY, 0);
			expect(command.x).toBeGreaterThanOrEqual(itemBox.x - 0.5);
			expect(command.y).toBeGreaterThanOrEqual(itemBox.y - 0.5);
			expect(
				command.x + command.width + visibleCommandGeometry.restingOffset,
			).toBeLessThanOrEqual(itemBox.x + itemBox.width + 0.5);
			expect(
				command.y + command.height + visibleCommandGeometry.restingOffset,
			).toBeLessThanOrEqual(itemBox.y + itemBox.height + 0.5);
			if (index > 0) {
				const previous = visibleCommandGeometry.commands[index - 1]!;
				expect(command.x).toBeGreaterThanOrEqual(previous.x + previous.width);
			}
		}

		const receivedAction = await visibleDirectReceivedAction(item);
		if (receivedAction === null) {
			expect(allowOverflow, 'Received action must remain directly visible').toBe(true);
			await expectReceivedActionReachable(page, item);
			continue;
		}

		const [actionBox, labelBox] = await Promise.all([
			box(receivedAction),
			receivedAction.evaluate((action) => {
				const surface = action.querySelector(':scope > .elevation-surface');
				if (!(surface instanceof HTMLElement)) {
					throw new Error('Received action has no direct elevation surface');
				}
				const range = document.createRange();
				range.selectNodeContents(surface);
				const contentRect = range.getBoundingClientRect();
				const surfaceRect = surface.getBoundingClientRect();
				return {
					contentX: contentRect.x,
					contentWidth: contentRect.width,
					surfaceX: surfaceRect.x,
					surfaceWidth: surfaceRect.width,
				};
			}),
		]);
		expect(actionBox.width).toBeGreaterThanOrEqual(32);
		expect(actionBox.height).toBeGreaterThanOrEqual(32);
		expect(actionBox.x).toBeGreaterThanOrEqual(itemBox.x - 0.5);
		expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(itemBox.x + itemBox.width + 0.5);
		expect(actionBox.y).toBeGreaterThanOrEqual(itemBox.y - 0.5);
		expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(
			itemBox.y + itemBox.height + 0.5,
		);
		expect(
			Math.abs(
				labelBox.contentX -
					labelBox.surfaceX -
					(labelBox.surfaceX +
						labelBox.surfaceWidth -
						labelBox.contentX -
						labelBox.contentWidth),
			),
		).toBeLessThanOrEqual(4);
		expect(await receivedAction.evaluate((action) => action.scrollWidth)).toBeLessThanOrEqual(
			await receivedAction.evaluate((action) => action.clientWidth),
		);
	}
}

export async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
	if (process.env.E2E_SCREENSHOT_ATTACHMENTS === 'false') {
		return;
	}
	const directory = 'test-results/mobile-wishlist-screenshots';
	const path = `${directory}/${name}.png`;
	await mkdir(directory, { recursive: true });
	await page.screenshot({ path, fullPage: true });
	await testInfo.attach(name, { path, contentType: 'image/png' });
}
