import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage, waitForAppHydration } from './fixtures/auth-helpers.js';
import { addGift, createWishlistAndNavigate, shareWishlist } from './fixtures/wishlist-helpers.js';
import {
	MOBILE_HEIGHT,
	createManagerWishlist,
	addQuantityGift,
	gift,
} from './mobile-wishlist.helpers.js';

test.describe('mobile wishlist acceptance', () => {
	test('only the nested Like button changes Like state', async ({
		browser,
		request,
		baseURL,
	}) => {
		const manager = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-like-source'),
		);
		const path = await createManagerWishlist(manager, 'Přímá aktivace oblíbení');
		const visitor = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-like-visitor'),
		);
		await visitor.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await visitor.goto(path, { waitUntil: 'load' });
		await waitForAppHydration(visitor);
		const card = visitor.locator('[data-gift-item]').first();
		const like = card.locator('button:has([data-like-heart])');
		await expect(like).toHaveAccessibleName(/Přidat.*oblíbených/i);
		await expect(like).toHaveAttribute('aria-pressed', 'false');
		await card.getByRole('heading', { level: 3 }).click();
		await expect(visitor.getByRole('dialog')).toBeVisible();
		await expect(like).toHaveAttribute('aria-pressed', 'false');
		await visitor.keyboard.press('Escape');
		await like.click();
		await expect(like).toHaveAttribute('aria-pressed', 'true');
		await manager.context().close();
		await visitor.context().close();
	});

	test('partial quantity reservation shows the actual remaining quantity', async ({
		browser,
		request,
		baseURL,
	}) => {
		const manager = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-state-source'),
		);
		await createManagerWishlist(manager, 'Mobilní stavové příklady');
		await addQuantityGift(manager, 'Tři kusy bez ceny a obrázku', 3);
		const path = new URL(manager.url()).pathname;

		const visitor = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-state-visitor'),
		);
		await visitor.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await visitor.goto(path, { waitUntil: 'load' });
		await waitForAppHydration(visitor);
		const partial = gift(visitor, 'Tři kusy bez ceny a obrázku');
		await partial.getByTestId('reserve-button').click();
		const reserveDialog = visitor.getByRole('dialog');
		await reserveDialog.getByRole('button', { name: /Rezervovat/, exact: true }).click();
		await expect(reserveDialog).toBeHidden();
		await expect(partial.getByText('Rezervováno vámi', { exact: true })).toBeVisible();
		await expect(partial.getByText('Volné 2/3', { exact: true })).toBeVisible();
		await expect(partial.getByTestId('reserve-button')).toHaveText('Zrušit rezervaci');

		await manager.context().close();
		await visitor.context().close();
	});

	test('recipient Card and List views hide reservation and Like data', async ({
		browser,
		request,
		baseURL,
	}) => {
		const recipient = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-wishlist-recipient'),
		);
		await createWishlistAndNavigate(recipient, 'Soukromí obdarovaného');
		const giftName = 'Dárek s utajenou rezervací';
		await addGift(recipient, giftName, { price: '850' });
		await recipient.setViewportSize({ width: 800, height: MOBILE_HEIGHT });
		await shareWishlist(recipient);
		const wishlistPath = new URL(recipient.url()).pathname;

		const reserverUser = createTestUser('mobile-wishlist-recipient-reserver');
		const reserver = await registerAndGetPage(browser, request, baseURL!, reserverUser);
		await reserver.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await reserver.goto(wishlistPath, { waitUntil: 'load' });
		await waitForAppHydration(reserver);
		const reservedGift = gift(reserver, giftName);
		await reservedGift.getByTestId('reserve-button').click();
		const reservationDialog = reserver.getByRole('dialog');
		await reservationDialog.getByRole('button', { name: /Rezervovat/, exact: true }).click();
		await expect(reservationDialog).toBeHidden();

		await recipient.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await recipient.reload({ waitUntil: 'load' });
		await waitForAppHydration(recipient);
		for (const view of ['card', 'list'] as const) {
			const viewControl = recipient.getByTestId(`gift-view-${view}`);
			await viewControl.click();
			await expect(viewControl).toHaveAttribute('aria-checked', 'true');
			const activeCollection = recipient.locator(
				`[data-wishlist-gift-collection][data-view-mode="${view}"]:not([inert])`,
			);
			await expect(activeCollection).toBeVisible();
			await expect(activeCollection.getByText(/Rezervov|Volné \d+\//i)).toHaveCount(0);
			await expect(activeCollection.getByTestId('reserve-button')).toHaveCount(0);
			await expect(activeCollection.locator('button:has([data-like-heart])')).toHaveCount(0);
			await expect(activeCollection).not.toContainText(reserverUser.name);
		}

		await reserver.context().close();
		await recipient.context().close();
	});
});
