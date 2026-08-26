import { test, expect, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';
import { GIFT_CROP_TARGET_SPECS } from '../../src/lib/modules/images/crop_targets.js';

/**
 * E2E coverage for issue #189 REQ-10 gaps the coverage PR #188 deferred:
 *
 *  1. The "received" sticker badge renders in the gift card's bottom-right
 *     quadrant (`gift_card_variants.ts` `receivedSticker` slot, issue #184).
 *  2. The "Upraveno po sdílení" (edited-after-share) transparency line renders
 *     on BOTH the owner's edit form (`GiftDetailForm.svelte`
 *     `editedAfterShareLine`) and the read-only visitor detail view
 *     (`GiftDetailView.svelte`, message key `gift_edited_after_share_line`)
 *     once a gift is edited after its wishlist was shared (issue #185).
 *  3. The read-only visitor detail view (`GiftDetailView.svelte` ~L64-71,
 *     issue #183 REQ-10) renders the full, uncropped photo at its natural
 *     aspect ratio instead of a crop-target aspect.
 */

const SAMPLE_IMAGE_PORTRAIT_PATH = fileURLToPath(
	new URL('./fixtures/sample-image-portrait.png', import.meta.url),
);

/** Wait for the same-origin upload proxy to confirm a stored object (PUT → 201). */
function waitForUpload(page: Page) {
	return page.waitForResponse(
		(response) =>
			response.request().method() === 'PUT' &&
			response.url().includes('/api/upload/') &&
			response.status() === 201,
		{ timeout: 15_000 },
	);
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Gift detail post-#188 coverage', () => {
	test('received sticker renders in the card bottom-right quadrant', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-received-sticker');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Received Sticker Coverage');
		const giftName = 'Testovaci darek prijaty';
		const activeGiftNameOne = 'Testovaci aktivni darek prvni';
		const activeGiftNameTwo = 'Testovaci aktivni darek druhy';
		await addGift(page, giftName);
		await addGift(page, activeGiftNameOne);
		await addGift(page, activeGiftNameTwo);

		const giftItem = page.locator('[data-gift-item]').filter({ hasText: giftName });
		const receivedHeading = page.getByRole('heading', { name: 'Obdržené', exact: true });
		await giftItem.getByRole('button', { name: 'Označit jako přijatý' }).click();

		// Issue #255 keeps the completed gift visible by enabling the received filter,
		// then updates both the direct action and the existing sticker from refreshed data.
		await expect(giftItem.getByText('Přijato', { exact: true })).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(
			giftItem.getByRole('button', { name: 'Označit jako nepřijatý' }),
		).toBeVisible();
		await expect(giftItem.getByTestId('release-reservation-button')).toHaveCount(0);

		await giftItem.getByRole('button', { name: 'Označit jako nepřijatý' }).click();
		await expect(giftItem.getByRole('button', { name: 'Označit jako přijatý' })).toBeVisible({
			timeout: 10_000,
		});
		await expect(giftItem.getByText('Přijato', { exact: true })).toHaveCount(0);
		await expect(receivedHeading).toHaveCount(0);
		await giftItem.getByRole('button', { name: 'Označit jako přijatý' }).click();

		const revealedGiftItem = page.locator('[data-gift-item]').filter({ hasText: giftName });
		const activeGiftItemOne = page
			.locator('[data-gift-item]')
			.filter({ hasText: activeGiftNameOne });
		const activeGiftItemTwo = page
			.locator('[data-gift-item]')
			.filter({ hasText: activeGiftNameTwo });
		await expect(receivedHeading).toHaveCount(1);
		await expect(revealedGiftItem.getByText('Přijato', { exact: true })).toBeVisible({
			timeout: 10_000,
		});

		const expectBefore = async (first: Locator, second: Locator) => {
			const secondElement = await second.elementHandle();
			expect(
				secondElement,
				'second element is attached for DOM-order comparison',
			).not.toBeNull();
			const secondFollowsFirst = await first.evaluate(
				(firstElement, secondNode) =>
					Boolean(
						firstElement.compareDocumentPosition(secondNode) &
						Node.DOCUMENT_POSITION_FOLLOWING,
					),
				secondElement!,
			);
			expect(
				secondFollowsFirst,
				'first element occurs before second element in the DOM',
			).toBe(true);
		};

		await expectBefore(activeGiftItemOne, receivedHeading);
		await expectBefore(activeGiftItemTwo, receivedHeading);
		await expectBefore(receivedHeading, revealedGiftItem);

		const cardBox = await revealedGiftItem.boundingBox();
		const stickerBox = await revealedGiftItem
			.getByText('Přijato', { exact: true })
			.boundingBox();
		expect(cardBox, 'gift card has a bounding box').not.toBeNull();
		expect(stickerBox, 'received sticker has a bounding box').not.toBeNull();

		const cardCenterX = cardBox!.x + cardBox!.width / 2;
		const cardCenterY = cardBox!.y + cardBox!.height / 2;
		const stickerCenterX = stickerBox!.x + stickerBox!.width / 2;
		const stickerCenterY = stickerBox!.y + stickerBox!.height / 2;

		// Bottom-right quadrant (issue #184): the sticker's center sits right of
		// AND below the card's own center.
		expect(stickerCenterX, 'sticker center is right of the card center').toBeGreaterThan(
			cardCenterX,
		);
		expect(stickerCenterY, 'sticker center is below the card center').toBeGreaterThan(
			cardCenterY,
		);
		// The sticker stays within the card's own bounds.
		expect(stickerBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
		expect(stickerBox!.y).toBeGreaterThanOrEqual(cardBox!.y);
		expect(stickerBox!.x + stickerBox!.width).toBeLessThanOrEqual(
			cardBox!.x + cardBox!.width + 1,
		);
		expect(stickerBox!.y + stickerBox!.height).toBeLessThanOrEqual(
			cardBox!.y + cardBox!.height + 1,
		);

		await page.getByRole('radio', { name: 'Seznam', exact: true }).click();
		await expect(page.getByRole('radio', { name: 'Seznam', exact: true })).toBeChecked();
		await expectBefore(activeGiftItemOne, receivedHeading);
		await expectBefore(activeGiftItemTwo, receivedHeading);
		await expectBefore(receivedHeading, revealedGiftItem);
		await expect(
			revealedGiftItem.getByRole('button', { name: 'Označit jako nepřijatý' }),
		).toBeVisible();
		await expect(revealedGiftItem.getByTestId('release-reservation-button')).toHaveCount(0);
	});

	test('edited-after-share line appears on both the editor and the visitor detail view', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('gift-edited-after-share');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(ownerPage, 'Edited After Share Coverage');
		const giftName = 'Testovaci darek upraveny';
		await addGift(ownerPage, giftName, { price: '300' });
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;

		// Edit a tracked field (price) after sharing – this is what actually sets
		// `editedAfterShareAt` server-side (gift_post_share.ts
		// computePreShareOwnerEdit + computePostShareEditTransparency): any
		// changed tracked field badges the gift, even inside the post-share
		// grace window.
		const giftItem = ownerPage.locator('[data-gift-item]').filter({ hasText: giftName });
		await giftItem.click();
		const editDialog = ownerPage.getByRole('dialog');
		await expect(editDialog).toBeVisible({ timeout: 5_000 });
		await editDialog.locator('#gift-price').fill('450');
		await editDialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });

		// Reopen the editor: GiftDetailForm's `editedAfterShareLine` derived
		// renders the same i18n'd line the visitor view uses (message key
		// `gift_edited_after_share_line`, stable "Upraveno po sdílení" prefix).
		// The save closes the dialog before its own `refreshData()` resolves, so
		// retry the open/read until the refreshed gift carries the flag instead
		// of racing a single reopen (never `waitUntil: 'networkidle'` – this
		// surface has long-lived query subscriptions that keep the network busy).
		await expect(async () => {
			await giftItem.click();
			await expect(editDialog).toBeVisible({ timeout: 2_000 });
			const editedLineVisible = await editDialog
				.getByText(/Upraveno po sdílení/)
				.isVisible()
				.catch(() => false);
			if (!editedLineVisible) {
				await ownerPage.keyboard.press('Escape');
				await expect(editDialog).not.toBeVisible({ timeout: 2_000 });
				throw new Error('editedAfterShareLine not visible yet');
			}
		}).toPass({ timeout: 15_000 });
		await ownerPage.keyboard.press('Escape');
		await expect(editDialog).not.toBeVisible({ timeout: 5_000 });
		await ownerPage.context().close();

		// The read-only visitor detail view (GiftDetailView.svelte) renders the
		// identical muted line – a fresh navigation reads the current DB state
		// directly, so no reopen race applies here.
		const visitorContext = await browser.newContext();
		const visitorPage = await visitorContext.newPage();
		await visitorPage.goto(wishlistPath);
		await visitorPage.getByText(giftName, { exact: true }).first().click();
		const visitorDialog = visitorPage.getByRole('dialog');
		await expect(visitorDialog).toBeVisible({ timeout: 5_000 });
		await expect(visitorDialog.getByText(/Upraveno po sdílení/)).toBeVisible({
			timeout: 10_000,
		});

		await visitorContext.close();
	});

	test('visitor detail view renders the full uncropped photo at its natural aspect', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('gift-detail-natural-aspect');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(ownerPage, 'Detail Natural Aspect Coverage');
		const giftName = 'Testovaci darek portret';

		await ownerPage
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const addDialog = ownerPage.getByRole('dialog');
		await expect(addDialog).toBeVisible({ timeout: 5_000 });
		await addDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);

		await addDialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
		const fileInput = addDialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(ownerPage);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PORTRAIT_PATH);
		await uploaded;
		await expect(addDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});

		await addDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(addDialog).not.toBeVisible({ timeout: 10_000 });
		await expect(ownerPage.getByRole('heading', { name: giftName, level: 3 })).toBeVisible({
			timeout: 10_000,
		});

		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		const visitorContext = await browser.newContext();
		const visitorPage = await visitorContext.newPage();
		await visitorPage.goto(wishlistPath);
		await visitorPage.getByText(giftName, { exact: true }).first().click();
		const visitorDialog = visitorPage.getByRole('dialog');
		await expect(visitorDialog).toBeVisible({ timeout: 5_000 });

		const detailImage = visitorDialog
			.getByTestId('gift-detail-view-image-column')
			.locator('img');
		await expect(detailImage).toBeVisible({ timeout: 10_000 });
		const box = await detailImage.boundingBox();
		expect(box, 'detail image has a bounding box').not.toBeNull();
		const ratio = box!.width / box!.height;

		// The source is a portrait fixture (20x40px, natural ratio 0.5) – the
		// detail view must render it at that natural ratio, NOT the `square` 4:3
		// card crop target and NOT a 1:1 crop.
		expect(ratio, 'detail image renders portrait, not landscape/square').toBeLessThan(0.95);
		expect(
			Math.abs(ratio - GIFT_CROP_TARGET_SPECS.square.aspect),
			'ratio is clearly not the 4:3 square crop target',
		).toBeGreaterThan(0.3);
		expect(Math.abs(ratio - 1), 'ratio is clearly not 1:1').toBeGreaterThan(0.3);

		await visitorContext.close();
	});
});
