import { test, expect, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from '../e2e/fixtures/test-data.js';
import { registerAndGetPage } from '../e2e/fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	openGiftImageFraming,
	uploadGiftEditorImage,
} from '../e2e/fixtures/wishlist-helpers.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(
	new URL('../e2e/fixtures/sample-image.jpg', import.meta.url),
);

async function dragStage(
	page: Page,
	stage: Locator,
	horizontalDelta: number,
	verticalDelta: number,
) {
	const box = await stage.boundingBox();
	expect(box).not.toBeNull();
	const centerX = box!.x + box!.width / 2;
	const centerY = box!.y + box!.height / 2;
	await page.mouse.move(centerX, centerY);
	await page.mouse.down();
	await page.mouse.move(centerX + horizontalDelta, centerY + verticalDelta, { steps: 5 });
	await page.mouse.up();
}

test.use({ viewport: { width: 1280, height: 900 } });

test('uploaded manual crop reaches the gift card and restores after reload', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('img-gift-crop');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	try {
		await createWishlistAndNavigate(page, 'Gift Crop Coverage');

		await page
			.getByRole('button', { name: /Přidat (dárek|první přání)/ })
			.first()
			.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		const giftName = 'Dárek s ořezem';
		await dialog.locator('#gift-name').fill(giftName);

		await uploadGiftEditorImage(page, dialog, SAMPLE_IMAGE_PATH);

		// Opening the framing step changes nothing; the first card edit makes the card Vlastní.
		const framingStep = await openGiftImageFraming(dialog);
		const cardControls = framingStep.getByTestId('gift-framing-controls-square');
		await expect(cardControls.getByRole('radio', { name: /Vyplnit/ })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		const zoomSlider = cardControls.getByRole('slider');
		await expect(zoomSlider).toBeEnabled();
		const initialZoomValue = await zoomSlider.inputValue();
		await zoomSlider.focus();
		await expect(zoomSlider).toBeFocused();
		for (let step = 0; step < 4; step += 1) {
			await zoomSlider.press('ArrowRight');
		}
		const chosenZoomValue = await zoomSlider.inputValue();
		expect(chosenZoomValue).not.toBe(initialZoomValue);
		await expect(framingStep.getByTestId('gift-framing-status-square')).toHaveText('Vlastní');
		await expect(framingStep.getByTestId('gift-framing-status-thumb')).toHaveText('Vyplnit');
		await dragStage(
			page,
			framingStep.getByTestId('gift-framing-view-square').getByTestId('crop-pan-surface'),
			40,
			24,
		);

		await dialog
			.getByTestId('gift-editor-footer')
			.getByRole('button', { name: 'Přidat dárek' })
			.click();
		await expect(dialog).not.toBeVisible({ timeout: 10_000 });
		const cardImage = page.getByRole('img', { name: giftName }).first();
		await expect(cardImage).toBeVisible({ timeout: 10_000 });
		await expect
			.poll(() => cardImage.evaluate((image) => getComputedStyle(image).objectPosition))
			.not.toBe('50% 50%');
		const savedObjectPosition = await cardImage.evaluate(
			(image) => getComputedStyle(image).objectPosition,
		);

		await page.reload({ waitUntil: 'load' });
		const restoredCardImage = page.getByRole('img', { name: giftName }).first();
		await expect(restoredCardImage).toBeVisible({ timeout: 10_000 });
		await expect
			.poll(() =>
				restoredCardImage.evaluate((image) => getComputedStyle(image).objectPosition),
			)
			.toBe(savedObjectPosition);

		await page.getByText(giftName, { exact: true }).first().click();
		const editDialog = page.getByRole('dialog');
		await expect(editDialog).toBeVisible({ timeout: 5_000 });
		await expect(editDialog.getByTestId('gift-image-framing-status')).toHaveText(
			'Karta: vlastní · Seznam: vyplnit',
		);
		const editFramingStep = await openGiftImageFraming(editDialog);
		await expect(editFramingStep.getByTestId('gift-framing-status-square')).toHaveText(
			'Vlastní',
		);
		await expect(editFramingStep.getByTestId('gift-framing-status-thumb')).toHaveText(
			'Vyplnit',
		);
		await expect(
			editFramingStep.getByTestId('gift-framing-controls-square').getByRole('slider'),
		).toHaveValue(chosenZoomValue, { timeout: 10_000 });
	} finally {
		await page.context().close();
	}
});
