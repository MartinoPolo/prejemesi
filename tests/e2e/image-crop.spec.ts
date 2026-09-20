import { test, expect, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

function waitForUpload(page: Page) {
	return page.waitForResponse(
		(response) =>
			response.request().method() === 'PUT' &&
			response.url().includes('/api/upload/') &&
			response.status() === 201,
		{ timeout: 15_000 },
	);
}

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

		await dialog.getByRole('radio', { name: 'Nahrát', exact: true }).click();
		const uploadCompleted = waitForUpload(page);
		await dialog.locator('input[type=file]').setInputFiles(SAMPLE_IMAGE_PATH);
		await uploadCompleted;
		await expect(dialog.getByTestId('image-upload-preview')).toBeVisible({ timeout: 10_000 });

		await dialog.getByTestId('gift-preview-square').click();
		await expect(dialog.getByRole('radio', { name: /Ručně/ })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		const zoomSlider = dialog.getByRole('slider');
		const initialZoomValue = await zoomSlider.inputValue();
		await zoomSlider.focus();
		for (let step = 0; step < 4; step += 1) {
			await zoomSlider.press('ArrowRight');
		}
		const chosenZoomValue = await zoomSlider.inputValue();
		expect(chosenZoomValue).not.toBe(initialZoomValue);
		await dragStage(page, dialog.getByTestId('crop-stage'), 40, 24);

		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();
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
		await expect(editDialog.getByRole('radio', { name: /Ručně/ })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(editDialog.getByRole('slider')).toHaveValue(chosenZoomValue, {
			timeout: 10_000,
		});
	} finally {
		await page.context().close();
	}
});
