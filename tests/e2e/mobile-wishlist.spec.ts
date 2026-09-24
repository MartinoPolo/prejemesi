import { test, expect, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	MOBILE_HEIGHT,
	createManagerWishlist,
	waitForGiftAnimationsToSettle,
} from './mobile-wishlist.helpers.js';
import { expectReceivedActionReachable, setGiftReceived } from './fixtures/gift-actions-helpers.js';
import { createPixelAssertions } from '../helpers/pixel-assertions.mjs';

const { expectPixelsAtLeast, expectPixelsAtMost, expectPixelsNear } = createPixelAssertions(expect);

async function visibleColumnCount(page: Page): Promise<number> {
	const positions = await page
		.locator('[data-gift-item]')
		.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().x)));
	return new Set(positions).size;
}

async function expectPrimaryActionReachable(action: Locator): Promise<void> {
	await action.scrollIntoViewIfNeeded();
	await expect(action).toBeVisible();
	const geometry = await action.evaluate((element) => {
		const card = element.closest<HTMLElement>('[data-gift-item]');
		if (card === null) {
			return null;
		}
		const actionRect = element.getBoundingClientRect();
		const cardRect = card.getBoundingClientRect();
		const hitTarget = document.elementFromPoint(
			actionRect.left + actionRect.width / 2,
			actionRect.top + actionRect.height / 2,
		);
		return {
			action: actionRect.toJSON(),
			card: cardRect.toJSON(),
			hitTestable: hitTarget !== null && element.contains(hitTarget),
		};
	});

	expect(geometry).not.toBeNull();
	if (geometry === null) {
		throw new Error('Primary action has no owning gift card');
	}
	expectPixelsAtLeast(geometry.action.left, geometry.card.left);
	expectPixelsAtMost(geometry.action.right, geometry.card.right);
	expectPixelsAtLeast(geometry.action.top, geometry.card.top);
	expectPixelsAtMost(geometry.action.bottom, geometry.card.bottom);
	expect(geometry.hitTestable).toBe(true);
}

test.describe('mobile wishlist acceptance', () => {
	test('card view keeps primary actions visible and adapts between narrow and wide layouts', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-columns'),
		);
		await createManagerWishlist(page);

		await page.setViewportSize({ width: 320, height: MOBILE_HEIGHT });
		await expect(page.getByTestId('wishlist-gift-card-grid')).toBeVisible();
		await expect.poll(() => visibleColumnCount(page)).toBe(1);
		const reserveActions = page.getByTestId('reserve-button');
		await expect(reserveActions).toHaveCount(3);
		await expectPrimaryActionReachable(reserveActions.first());

		await page.setViewportSize({ width: 600, height: MOBILE_HEIGHT });
		await expect.poll(() => visibleColumnCount(page)).toBe(2);
		await expect(reserveActions).toHaveCount(3);
		await expectPrimaryActionReachable(reserveActions.first());

		await page.context().close();
	});

	test('list view uses a portrait mobile image and a square-maximum full-height desktop image with primary actions', async ({
		browser,
		request,
		baseURL,
	}) => {
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

		await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await expect(page.getByTestId('gift-list-item')).toHaveCount(3);
		const firstItem = page.getByTestId('gift-list-item').first();
		const mobileImage = firstItem.getByTestId('gift-list-image');
		await expect(mobileImage).toBeVisible();
		const mobileImageBox = await mobileImage.boundingBox();
		expect(mobileImageBox).not.toBeNull();
		expect(mobileImageBox!.height).toBeGreaterThan(mobileImageBox!.width);
		const primaryAction = firstItem
			.getByTestId('gift-action-row')
			.getByTestId('reserve-button');
		await expectPrimaryActionReachable(primaryAction);

		await page.setViewportSize({ width: 1280, height: 900 });
		const desktopImageBox = await mobileImage.boundingBox();
		const desktopRowBox = await firstItem.boundingBox();
		expect(desktopImageBox).not.toBeNull();
		expect(desktopRowBox).not.toBeNull();
		expectPixelsAtMost(desktopImageBox!.width, desktopImageBox!.height);
		expectPixelsNear(desktopImageBox!.y - desktopRowBox!.y, 2);
		expectPixelsNear(
			desktopRowBox!.y + desktopRowBox!.height - desktopImageBox!.y - desktopImageBox!.height,
			2,
		);
		await expectPrimaryActionReachable(primaryAction);

		await page.context().close();
	});

	test('English received actions remain reachable at narrow width in Card and List views', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-english-actions'),
		);
		const wishlistPath = await createManagerWishlist(page, 'English mobile actions');
		await page.goto(`/en${wishlistPath}`, { waitUntil: 'load' });
		await page.setViewportSize({ width: 320, height: MOBILE_HEIGHT });
		let receivedGift = page
			.locator('[data-wishlist-gift-collection]:not([inert]) [data-gift-item]')
			.first();
		const receivedGiftId = await receivedGift.getAttribute('data-gift-id');
		expect(receivedGiftId).not.toBeNull();
		await setGiftReceived(page, receivedGift, true);
		await waitForGiftAnimationsToSettle(page);
		await expectReceivedActionReachable(page, receivedGift);

		const listView = page.getByTestId('gift-view-list');
		await listView.click();
		await expect(listView).toHaveAttribute('aria-checked', 'true');
		await expect(page.getByTestId('wishlist-gift-list')).toBeVisible();
		receivedGift = page.locator(
			`[data-wishlist-gift-collection]:not([inert]) [data-gift-item][data-gift-id="${receivedGiftId}"]`,
		);
		await expectReceivedActionReachable(page, receivedGift);

		await page.context().close();
	});
});
