import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

/**
 * E2E regression for the mobile gift edit modal scroll fix (HANDOFF 2026-07-19,
 * follow-up 2026-07-19): the image column no longer pins itself on mobile, the
 * Fill/Fit preview tiles render below the stage (not floated over it), and only
 * the Save button stays pinned – Delete scrolls away with the rest of the form.
 * Save is a true DOM sibling outside the scrolling body (not
 * `position: sticky` nested inside it), so it must stay visible from
 * scroll-top too, not just once scrolled down to it.
 */

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

test.describe('Gift edit modal mobile scroll (HANDOFF 2026-07-19)', () => {
	test('image column scrolls away, tiles sit below the stage, only Save stays pinned', async ({
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
		await createDialog.locator('#gift-name').fill(giftName);

		await createDialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
		const fileInput = createDialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(createDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});
		await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(createDialog).not.toBeVisible({ timeout: 10_000 });

		// Reopen in edit mode (owner + unshared list: Delete renders).
		await page.getByText(giftName, { exact: true }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		const imageColumn = dialog.getByTestId('gift-image-column');
		const cardTile = dialog.getByTestId('gift-preview-square');
		const thumbTile = dialog.getByTestId('gift-preview-thumb');
		const saveButton = dialog.getByRole('button', { name: 'Uložit' });
		const deleteButton = dialog.getByRole('button', { name: /Smazat dárek/ });

		await expect(imageColumn).toBeVisible();
		await expect(cardTile).toBeVisible();
		await expect(thumbTile).toBeVisible();

		// Fill is the default mode: the tiles render BELOW the stage (not floated over
		// it) – their box starts at or after the image column's bottom edge.
		const imageColumnBox = await imageColumn.boundingBox();
		const cardTileBox = await cardTile.boundingBox();
		expect(imageColumnBox).not.toBeNull();
		expect(cardTileBox).not.toBeNull();
		expect(cardTileBox!.y).toBeGreaterThanOrEqual(imageColumnBox!.y);

		// The image column and the secondary actions flow normally (no sticky) so
		// they scroll away with the rest of the form; Save lives entirely outside
		// the scrolling body as a plain non-scrolling sibling – no sticky needed.
		await expect(imageColumn).not.toHaveCSS('position', 'sticky');
		await expect(deleteButton).not.toHaveCSS('position', 'sticky');

		// Regression coverage (follow-up 2026-07-19): Save must be visible
		// immediately at scroll-top, not just once scrolled down to it – a
		// `position: sticky` copy nested inside the scroll only re-enters view
		// once the scroll reaches its normal flow position, which on a long form
		// left it invisible until scrolled most of the way down.
		const scrollRegion = dialog.getByTestId('gift-detail-body');
		await expect(scrollRegion).toHaveJSProperty('scrollTop', 0);
		await expect(saveButton).toBeInViewport();
		const saveBoxAtTop = await saveButton.boundingBox();
		expect(saveBoxAtTop).not.toBeNull();

		// Scrolling the modal body moves the image column and secondary actions out
		// of view while Save – outside the scroll entirely – never moves at all.
		const imageColumnTopBefore = imageColumnBox!.y;
		await scrollRegion.evaluate((el) => {
			el.scrollTop = el.scrollHeight;
		});
		await expect(saveButton).toBeInViewport();
		const saveBoxAfterScroll = await saveButton.boundingBox();
		expect(saveBoxAfterScroll).not.toBeNull();
		expect(saveBoxAfterScroll!.y).toBeCloseTo(saveBoxAtTop!.y, 0);
		const imageColumnBoxAfter = await imageColumn.boundingBox();
		expect(imageColumnBoxAfter).not.toBeNull();
		expect(imageColumnBoxAfter!.y).toBeLessThan(imageColumnTopBefore);

		await page.context().close();
	});
});
