import { expect, test, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from '../e2e/fixtures/test-data.js';
import { registerAndGetPage } from '../e2e/fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	openGiftImageFraming,
	uploadGiftEditorImage,
	waitForDialogOverlayRemoval,
} from '../e2e/fixtures/wishlist-helpers.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(
	new URL('../e2e/fixtures/sample-image-portrait.png', import.meta.url),
);

/** The checkerboard behind a transparent photo on the framing step's real card. */
function framingCardPattern(framingStep: Locator) {
	return framingStep
		.getByTestId('gift-framing-view-square')
		.getByTestId('gift-card-image-pattern');
}

function footerButton(dialog: Locator, name: string) {
	return dialog.getByTestId('gift-editor-footer').getByRole('button', { name, exact: true });
}

async function openAddGiftDialog(page: Page) {
	await page
		.getByRole('button', { name: /Přidat (dárek|první přání)/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	return dialog;
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Gift image background fill (issue #252)', () => {
	test('defaults to Transparent and persists explicit black through create, reload, and edit', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-image-background');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		const giftName = 'Dárek s černým pozadím';

		await createWishlistAndNavigate(page, 'Issue 252 background fill');
		const createDialog = await openAddGiftDialog(page);
		await createDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);
		await uploadGiftEditorImage(page, createDialog, SAMPLE_IMAGE_PATH);
		const createFraming = await openGiftImageFraming(createDialog);
		await createFraming
			.getByTestId('gift-framing-controls-square')
			.getByRole('radio', { name: 'Celý', exact: true })
			.click();
		await expect(createFraming.getByRole('radio', { name: 'Průhledné' })).toBeChecked();
		await expect(framingCardPattern(createFraming)).toBeVisible();
		await createFraming.getByRole('radio', { name: 'Černé' }).click();
		await expect(framingCardPattern(createFraming)).toHaveCount(0);
		await footerButton(createDialog, 'Přidat dárek').click();
		await expect(createDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);

		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.locator('[aria-label="Karta"]:visible').click();
		const giftCard = page.locator('[data-gift-item]').filter({ hasText: giftName });
		const blackCardFrame = giftCard.getByTestId('gift-card-image-frame');
		await expect(blackCardFrame).toHaveCSS('background-color', 'rgb(0, 0, 0)');
		await expect(blackCardFrame.getByTestId('image-frame')).toHaveCSS(
			'background-color',
			'rgb(0, 0, 0)',
		);
		await expect(blackCardFrame.getByTestId('gift-card-image-pattern')).toHaveCount(0);

		await giftCard.click();
		const editDialog = page.getByRole('dialog');
		const editFraming = await openGiftImageFraming(editDialog);
		await expect(editFraming.getByRole('radio', { name: 'Černé' })).toBeChecked();
		await editFraming.getByRole('radio', { name: 'Průhledné' }).click();
		await expect(framingCardPattern(editFraming)).toBeVisible();
		await footerButton(editDialog, 'Uložit').click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);
		await page.reload({ waitUntil: 'domcontentloaded' });
		const transparentCardFrame = page
			.locator('[data-gift-item]')
			.filter({ hasText: giftName })
			.getByTestId('gift-card-image-frame');
		await expect(transparentCardFrame.getByTestId('gift-card-image-pattern')).toBeVisible({
			timeout: 10_000,
		});
		await page.locator('[data-gift-item]').filter({ hasText: giftName }).click();
		const reopenedFraming = await openGiftImageFraming(page.getByRole('dialog'));
		await expect(reopenedFraming.getByRole('radio', { name: 'Průhledné' })).toBeChecked();

		await page.context().close();
	});
});
