import { test, expect } from '@playwright/test';
import * as m from '../../src/lib/paraglide/messages.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	addGift,
	archiveWishlist,
	createWishlistForSomeoneAndNavigate,
	shareWishlist,
} from './fixtures/wishlist-helpers.js';
import { MOBILE_HEIGHT, gift } from './mobile-wishlist.helpers.js';

test.describe('mobile wishlist visitor acceptance', () => {
	test('visitor can cancel their own reservation after the owner archives the wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-archived-own-reservation-owner'),
		);
		await createWishlistForSomeoneAndNavigate(owner, {
			title: 'Archivovaná rezervace návštěvníka',
			recipientName: 'Anička',
		});
		await addGift(owner, 'Dárek rezervovaný před archivací');
		await shareWishlist(owner);
		const wishlistPath = new URL(owner.url()).pathname;

		const visitor = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('mobile-archived-own-reservation-visitor'),
		);
		await visitor.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
		await visitor.goto(wishlistPath, { waitUntil: 'load' });
		const reservedGift = gift(visitor, 'Dárek rezervovaný před archivací');
		await reservedGift.getByTestId('reserve-button').click();
		const reservationDialog = visitor.getByRole('dialog');
		await reservationDialog.getByRole('button', { name: /Rezervovat/, exact: true }).click();
		await expect(reservationDialog).toBeHidden();
		await expect(reservedGift.getByText('Rezervováno vámi', { exact: true })).toBeVisible();

		await owner.setViewportSize({ width: 800, height: MOBILE_HEIGHT });
		await archiveWishlist(owner);
		await expect(owner.getByText(/Archivováno: seznam je uzavřen/i)).toBeVisible();

		await visitor.reload({ waitUntil: 'load' });
		await expect(visitor.getByText(/Archivováno: seznam je uzavřen/i)).toBeVisible();
		const archivedGift = gift(visitor, 'Dárek rezervovaný před archivací');
		const cancel = archivedGift.getByTestId('reserve-button');
		await expect(cancel).toHaveAccessibleName(/Zrušit rezervaci/i);
		await expect(archivedGift.getByTestId('gift-received-toggle')).toHaveCount(0);
		await expect(
			archivedGift.getByRole('button', {
				name: /Označit jako koupené|Zakoupeno|Mark as bought|Purchased/i,
			}),
		).not.toBeVisible();
		await expect(
			visitor.getByRole('button', { name: /Přidat dárek|Změnit pořadí/i }),
		).toHaveCount(0);
		await expect(visitor.getByRole('button', { name: m.gift_selection_toolbar() })).toHaveCount(
			0,
		);

		await cancel.click();
		await expect(cancel).toHaveCount(0);
		await expect(archivedGift.getByText('Rezervováno vámi', { exact: true })).toHaveCount(0);

		await owner.context().close();
		await visitor.context().close();
	});
});
