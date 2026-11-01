import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestUser } from '../e2e/fixtures/test-data.js';
import { registerAndGetPage } from '../e2e/fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	waitForDialogOverlayRemoval,
} from '../e2e/fixtures/wishlist-helpers.js';

// A new account owns every gift here, so the shared seeded rows stay untouched.
const COVER_IMAGE_PATH = '/demo/playground/kolo.jpg';
const ADDED_IMAGE_PATH = '/demo/playground/kytara.jpg';

test.use({ viewport: { width: 1280, height: 900 } });

function giftCard(page: Page, giftName: string): Locator {
	return page.locator('[data-gift-item]').filter({ hasText: giftName });
}

function shownCoverSource(card: Locator): Promise<string | null> {
	return card.locator('[data-gallery-slide][data-current] img').first().getAttribute('src');
}

test.describe('Gift image gallery editor (issue #591)', () => {
	test('adds a linked image, makes it the cover and the card shows the new order', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-image-gallery-editor');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		const giftName = 'Dárek se dvěma obrázky';

		await createWishlistAndNavigate(page, 'Issue 591 gallery editor');
		await page
			.getByRole('button', { name: /Přidat (dárek|první přání)/ })
			.first()
			.click();
		const createDialog = page.getByRole('dialog');
		await createDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);
		await createDialog.getByRole('radio', { name: 'URL', exact: true }).click();
		await createDialog
			.getByPlaceholder('https://example.com/image.jpg')
			.fill(`${baseURL}${COVER_IMAGE_PATH}`);
		await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(createDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);

		await page.locator('[aria-label="Karta"]:visible').click();
		const card = giftCard(page, giftName);
		await expect(card.getByTestId('gift-gallery-indicator')).toHaveCount(0);

		await card.click();
		const editDialog = page.getByRole('dialog');
		const strip = editDialog.getByTestId('gift-image-strip');
		await expect(strip).toContainText('Obrázky · 1 z 8');
		await strip.getByRole('button', { name: 'Přidat obrázek' }).click();
		await page.getByRole('menuitem', { name: 'Vložit odkaz na obrázek' }).click();
		const linkInput = editDialog.getByPlaceholder('https://example.com/image.jpg');
		await expect(linkInput).toBeFocused();
		await linkInput.fill(`${baseURL}${ADDED_IMAGE_PATH}`);
		await expect(strip).toContainText('Obrázky · 2 z 8');

		await strip.getByRole('button', { name: 'Přesunout obrázek 2' }).focus();
		await page.keyboard.press('ArrowLeft');
		await expect(
			strip.getByRole('button', { name: 'Obrázek 1, obálka', exact: true }),
		).toHaveAttribute('aria-pressed', 'true');
		await expect(strip).toContainText('Obrázek je teď obálkou, pozice 1 z 2.');
		await editDialog.getByRole('button', { name: 'Uložit' }).first().click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);

		const indicator = card.getByTestId('gift-gallery-indicator');
		await expect(indicator).toHaveAttribute('data-kind', 'dots');
		await expect(indicator.locator('[data-current]')).toHaveCount(1);
		await expect(indicator.locator('span[aria-hidden="true"]')).toHaveCount(2);
		await expect.poll(() => shownCoverSource(card)).toContain(ADDED_IMAGE_PATH);

		await page.reload({ waitUntil: 'domcontentloaded' });
		await expect
			.poll(() => shownCoverSource(giftCard(page, giftName)))
			.toContain(ADDED_IMAGE_PATH);
		await expect(giftCard(page, giftName).getByTestId('gift-gallery-indicator')).toContainText(
			'Obrázek 1 z 2',
		);
	});
});
