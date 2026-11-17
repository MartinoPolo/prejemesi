import { test, expect, type Locator } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	uploadGiftEditorImage,
	waitForDialogMotionToSettle,
} from './fixtures/wishlist-helpers.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

async function expectCompactEditorHeader(dialog: Locator, titleText: string) {
	await waitForDialogMotionToSettle(dialog);

	const header = dialog.getByTestId('gift-editor-header');
	const title = header.getByRole('heading', { name: titleText });
	const closeButton = dialog.locator('[data-slot="dialog-close"]');
	await expect(title).toBeVisible();
	await expect(closeButton).toBeVisible();

	const [headerBox, titleBox, closeButtonBox, headerMetrics] = await Promise.all([
		header.boundingBox(),
		title.boundingBox(),
		closeButton.boundingBox(),
		header.evaluate((element) => ({
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
		})),
	]);

	expect(headerBox, 'editor header has geometry').not.toBeNull();
	expect(titleBox, 'editor title has geometry').not.toBeNull();
	expect(closeButtonBox, 'editor close button has geometry').not.toBeNull();

	const titleCenterY = titleBox!.y + titleBox!.height / 2;
	const closeButtonCenterY = closeButtonBox!.y + closeButtonBox!.height / 2;

	// Compact: one row of the close sticker's height, title centred beside it.
	expect(Math.abs(titleCenterY - closeButtonCenterY)).toBeLessThanOrEqual(1);
	expect(closeButtonBox!.width).toBeCloseTo(40, 0);
	expect(closeButtonBox!.height).toBeCloseTo(40, 0);
	expect(headerBox!.height).toBeLessThanOrEqual(closeButtonBox!.height + 32);
	expect(headerMetrics.scrollWidth).toBeLessThanOrEqual(headerMetrics.clientWidth);
	expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(closeButtonBox!.x);
}

test.describe('Gift edit modal mobile scroll', () => {
	test('body scrolls while Save remains visible and operable', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-mobile-scroll');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.setViewportSize({ width: 390, height: 844 });

		await createWishlistAndNavigate(page, 'Mobile Scroll Fix Coverage');

		const giftName = 'Dárek pro mobilní posun';
		await page
			.getByRole('button', { name: /Přidat (dárek|první přání)/ })
			.first()
			.click();
		const createDialog = page.getByRole('dialog');
		await expect(createDialog).toBeVisible({ timeout: 5_000 });
		await expectCompactEditorHeader(createDialog, 'Přidat dárek');
		const nameInput = createDialog.locator('#gift-name');
		// Phones list the fields first and the image section after them.
		const fieldsBox = await createDialog.getByTestId('gift-detail-column').boundingBox();
		const imageSectionBox = await createDialog.getByTestId('gift-image-column').boundingBox();
		expect(fieldsBox!.y + fieldsBox!.height).toBeLessThanOrEqual(imageSectionBox!.y);
		await nameInput.fill(giftName);

		let uploadRequestCount = 0;
		page.on('request', (request) => {
			if (request.method() === 'PUT' && request.url().includes('/api/upload/')) {
				uploadRequestCount += 1;
			}
		});
		await uploadGiftEditorImage(page, createDialog, SAMPLE_IMAGE_PATH);
		await nameInput.focus();
		await page.setViewportSize({ width: 1280, height: 900 });
		await expect(nameInput).toBeFocused();
		await expect(nameInput).toHaveValue(giftName);
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(nameInput).toBeFocused();
		expect(uploadRequestCount).toBe(1);
		await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(createDialog).not.toBeVisible({ timeout: 10_000 });

		// Reopen in edit mode (owner + unshared list: Delete renders).
		await page.getByText(giftName, { exact: true }).click();
		const dialog = page.getByRole('dialog');
		await expectCompactEditorHeader(dialog, 'Upravit dárek');

		const scrollRegion = dialog.getByTestId('gift-detail-body');
		const footer = dialog.getByTestId('gift-editor-footer');
		const saveButton = footer.getByRole('button', { name: 'Uložit' });
		await expect(footer.getByRole('button', { name: 'Zrušit' })).toBeVisible();
		await expect(saveButton).toBeVisible();
		await expect(saveButton).toBeInViewport();
		await expect(saveButton).toBeEnabled();
		expect(
			await scrollRegion.evaluate((element) => element.scrollHeight > element.clientHeight),
		).toBe(true);

		await scrollRegion.evaluate((element) => {
			element.scrollTop = element.scrollHeight;
		});
		await expect
			.poll(() => scrollRegion.evaluate((element) => element.scrollTop))
			.toBeGreaterThan(0);
		await expect(saveButton).toBeVisible();
		await expect(saveButton).toBeInViewport();
		await expect(saveButton).toBeEnabled();
		await saveButton.click();
		await expect(dialog).not.toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});

	test('guards real in-app navigation with Continue and Discard', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-navigation-guard');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.setViewportSize({ width: 1280, height: 900 });
		await createWishlistAndNavigate(page, 'Navigation Guard Coverage');

		await page
			.getByRole('button', { name: /Přidat (dárek|první přání)/ })
			.first()
			.click();
		const editor = page.getByRole('dialog', { name: 'Přidat dárek' });
		await editor.locator('#gift-name').fill('Neuložený dárek');
		const wishlistUrl = page.url();

		await page.locator('a.logo').evaluate((link: HTMLAnchorElement) => link.click());
		const guard = page.getByRole('dialog', { name: 'Máte neuložené změny' });
		await expect(guard).toBeVisible();
		await guard.getByRole('button', { name: /Pokračovat/ }).click();
		await expect(editor).toBeVisible();
		expect(page.url()).toBe(wishlistUrl);

		await page.locator('a.logo').evaluate((link: HTMLAnchorElement) => link.click());
		await expect(guard).toBeVisible();
		await guard.getByRole('button', { name: /Zahodit/ }).click();
		await expect(page).toHaveURL(/\/home$/);
		await expect(editor).not.toBeVisible();

		await page.context().close();
	});
});
