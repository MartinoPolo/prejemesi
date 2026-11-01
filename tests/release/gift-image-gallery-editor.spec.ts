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
const THIRD_IMAGE_PATH = '/demo/playground/batoh.jpg';
const IMAGE_LINK_PLACEHOLDER = 'https://example.com/image.jpg';
const DRAG_STEPS = 12;

test.use({ viewport: { width: 1280, height: 900 } });

function giftCard(page: Page, giftName: string): Locator {
	return page.locator('[data-gift-item]').filter({ hasText: giftName });
}

function shownCoverSource(card: Locator): Promise<string | null> {
	return card.locator('[data-gallery-slide][data-current] img').first().getAttribute('src');
}

/** Creates a gift whose cover is linked by URL, then shows the wishlist as cards. */
async function createGiftWithCover(page: Page, baseURL: string, giftName: string) {
	await page
		.getByRole('button', { name: /Přidat (dárek|první přání)/ })
		.first()
		.click();
	const createDialog = page.getByRole('dialog');
	await createDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);
	await createDialog.getByRole('radio', { name: 'URL', exact: true }).click();
	await createDialog
		.getByPlaceholder(IMAGE_LINK_PLACEHOLDER)
		.fill(`${baseURL}${COVER_IMAGE_PATH}`);
	await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();
	await expect(createDialog).not.toBeVisible({ timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
	await page.locator('[aria-label="Karta"]:visible').click();
}

/** Adds a linked image from the strip's add menu; `count` is the strip size afterwards. */
async function addLinkedImage(page: Page, editDialog: Locator, imageUrl: string, count: number) {
	const strip = editDialog.getByTestId('gift-image-strip');
	await strip.getByRole('button', { name: 'Přidat obrázek' }).click();
	await page.getByRole('menuitem', { name: 'Vložit odkaz na obrázek' }).click();
	const linkInput = editDialog.getByPlaceholder(IMAGE_LINK_PLACEHOLDER);
	await expect(linkInput).toBeFocused();
	await linkInput.fill(imageUrl);
	await expect(strip).toContainText(`Obrázky · ${String(count)} z 8`);
}

/** The strip's image sources, cover first. */
function stripSources(strip: Locator): Promise<string[]> {
	return strip
		.locator('[data-gift-image-tile] img')
		.evaluateAll((images) => images.map((image) => image.getAttribute('src') ?? ''));
}

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
	const box = await locator.boundingBox();
	expect(box, 'the drag target is laid out').not.toBeNull();
	return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/** Presses the mouse on `grip` and moves it in small steps onto `target`, leaving it pressed. */
async function pressAndDragOnto(page: Page, grip: Locator, target: Locator) {
	await grip.hover();
	const start = await centerOf(grip);
	const end = await centerOf(target);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	for (let step = 1; step <= DRAG_STEPS; step += 1) {
		const progress = step / DRAG_STEPS;
		await page.mouse.move(
			start.x + (end.x - start.x) * progress,
			start.y + (end.y - start.y) * progress,
		);
	}
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
		await createGiftWithCover(page, baseURL!, giftName);
		const card = giftCard(page, giftName);
		await expect(card.getByTestId('gift-gallery-indicator')).toHaveCount(0);

		await card.click();
		const editDialog = page.getByRole('dialog');
		const strip = editDialog.getByTestId('gift-image-strip');
		await expect(strip).toContainText('Obrázky · 1 z 8');
		await addLinkedImage(page, editDialog, `${baseURL}${ADDED_IMAGE_PATH}`, 2);

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

	test('dragging a tile by its grip reorders the strip, and Escape mid-drag cancels', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-image-gallery-drag');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		const giftName = 'Dárek se třemi obrázky';

		await createWishlistAndNavigate(page, 'Issue 591 gallery drag');
		await createGiftWithCover(page, baseURL!, giftName);
		await giftCard(page, giftName).click();
		const editDialog = page.getByRole('dialog');
		const strip = editDialog.getByTestId('gift-image-strip');
		await addLinkedImage(page, editDialog, `${baseURL}${ADDED_IMAGE_PATH}`, 2);
		await addLinkedImage(page, editDialog, `${baseURL}${THIRD_IMAGE_PATH}`, 3);
		const tiles = strip.locator('[data-gift-image-tile]');
		const startingSources = await stripSources(strip);
		expect(startingSources).toHaveLength(3);

		await pressAndDragOnto(
			page,
			strip.getByRole('button', { name: 'Přesunout obrázek 3' }),
			tiles.first(),
		);
		await page.keyboard.press('Escape');
		await page.mouse.up();
		await expect.poll(() => stripSources(strip)).toEqual(startingSources);
		await expect(editDialog, 'Escape cancels the drag, not the editor').toBeVisible();

		await pressAndDragOnto(
			page,
			strip.getByRole('button', { name: 'Přesunout obrázek 3' }),
			tiles.first(),
		);
		await page.mouse.up();
		await expect
			.poll(() => stripSources(strip))
			.toEqual([startingSources[2], startingSources[0], startingSources[1]]);
		await expect(strip).toContainText('Obrázek je teď obálkou, pozice 1 z 3.');
	});
});
