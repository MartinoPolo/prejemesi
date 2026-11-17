import postgres from 'postgres';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import {
	focalZoomToWindowRect,
	normalizedCropAspect,
	CENTERED_FOCAL,
} from '../../src/lib/modules/images/crop.js';
import { GIFT_CROP_TARGET_SPECS } from '../../src/lib/modules/images/crop_targets.js';
import { IMAGE_FIT_MODES } from '../../src/lib/modules/images/fit_modes.js';
import type { ImageMetadata } from '../../src/lib/modules/images/types.js';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { localDatabaseUrl } from './fixtures/local-database.js';
import {
	createWishlistAndNavigate,
	openGiftImageFraming,
	uploadGiftEditorImage,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';

// Issue #706: Karta (`square`) and Seznam (`thumb`) framings are edited independently. Stored
// gifts whose list thumbnail follows the card crop (no own `thumb`) must keep rendering exactly
// as before: an edit-free save rewrites nothing, and a Karta edit never moves the list.
const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

interface RenderedFraming {
	objectPosition: string;
	transform: string;
}

const WISHLIST_VIEWS = {
	card: { radioName: 'Karta', surfaceTestId: 'gift-card-image-frame' },
	list: { radioName: 'Seznam', surfaceTestId: 'gift-list-square-composition' },
} as const;

type WishlistView = keyof typeof WISHLIST_VIEWS;

/** A stored card crop off-centre and zoomed in, with the list thumbnail following it. */
function followingThumbMeta(imageRatio: number): ImageMetadata {
	const squareAspect = normalizedCropAspect(GIFT_CROP_TARGET_SPECS.square.aspect, imageRatio);
	const focal = { x: 25, y: 70 };
	const zoom = 1.6;
	return {
		fitMode: IMAGE_FIT_MODES.coverCrop,
		cropRect: null,
		focal: { ...CENTERED_FOCAL },
		zoom: 1,
		bgColor: null,
		targets: {
			square: { cropRect: focalZoomToWindowRect(focal, zoom, squareAspect), focal, zoom },
		},
	};
}

async function withDatabase<Result>(
	work: (database: postgres.Sql) => Promise<Result>,
): Promise<Result> {
	const database = postgres(
		localDatabaseUrl('The gift framing spec writes legacy image metadata'),
		{ max: 1, connect_timeout: 5 },
	);
	try {
		return await work(database);
	} finally {
		await database.end({ timeout: 5 });
	}
}

/** Rewrites the gift's cover metadata the way a pre-#706 save stored it. */
async function storeCoverMeta(wishlistPath: string, giftName: string, meta: ImageMetadata) {
	const shortId = wishlistPath.split('/').at(-1) ?? '';
	await withDatabase(async (database) => {
		const updated = await database`
			update gift set image_meta = ${JSON.stringify(meta)}::text::jsonb
			where name = ${giftName}
				and wishlist_id = (select id from wishlist where short_id = ${shortId})
		`;
		expect(updated.count).toBe(1);
	});
}

async function storedCoverMeta(wishlistPath: string, giftName: string): Promise<ImageMetadata> {
	const shortId = wishlistPath.split('/').at(-1) ?? '';
	return withDatabase(async (database) => {
		const rows = await database<{ image_meta: ImageMetadata }[]>`
			select gift_image.image_meta from gift_image
			join gift on gift.id = gift_image.gift_id
			where gift.name = ${giftName} and gift_image.position = 0
				and gift.wishlist_id = (select id from wishlist where short_id = ${shortId})
		`;
		expect(rows).toHaveLength(1);
		return rows[0]!.image_meta;
	});
}

/** How the gift photo is framed on one wishlist view, read from the rendered image. */
async function renderedFraming(
	page: Page,
	giftName: string,
	view: WishlistView,
): Promise<RenderedFraming> {
	const viewRadio = page.getByRole('radio', {
		name: WISHLIST_VIEWS[view].radioName,
		exact: true,
	});
	if (!(await viewRadio.isChecked())) {
		await viewRadio.click();
	}
	await expect(viewRadio).toBeChecked();
	const photo = page
		.locator('[data-gift-item]')
		.filter({ hasText: giftName })
		.getByTestId(WISHLIST_VIEWS[view].surfaceTestId)
		.getByTestId('image-frame')
		.locator('img');
	await expect(photo).toBeVisible({ timeout: 10_000 });
	return photo.evaluate((image) => {
		const style = getComputedStyle(image);
		return { objectPosition: style.objectPosition, transform: style.transform };
	});
}

async function renderedFramings(page: Page, giftName: string) {
	await page.reload({ waitUntil: 'load' });
	return {
		list: await renderedFraming(page, giftName, 'list'),
		card: await renderedFraming(page, giftName, 'card'),
	};
}

async function openGiftEditor(page: Page, giftName: string) {
	await page.getByText(giftName, { exact: true }).first().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	await expect(dialog.getByTestId('gift-image-edit-entry')).toBeVisible({ timeout: 10_000 });
	return dialog;
}

async function saveGiftEditor(page: Page, dialog: Locator) {
	await dialog
		.getByTestId('gift-editor-footer')
		.getByRole('button', { name: 'Uložit', exact: true })
		.click();
	await expect(dialog).not.toBeVisible({ timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
}

async function zoomInCard(framingStep: Locator, steps: number) {
	const zoomSlider = framingStep.getByTestId('gift-framing-controls-square').getByRole('slider');
	await expect(zoomSlider).toBeEnabled();
	await zoomSlider.focus();
	await expect(zoomSlider).toBeFocused();
	for (let step = 0; step < steps; step += 1) {
		await zoomSlider.press('ArrowRight');
	}
}

/** The uploaded photo's natural width ÷ height, read from the editor's live preview. */
async function previewPhotoRatio(dialog: Locator): Promise<number> {
	const photo = dialog
		.getByTestId('gift-editor-preview')
		.getByTestId('image-frame')
		.locator('img');
	await expect
		.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
		.toBeGreaterThan(0);
	return photo.evaluate((image: HTMLImageElement) => image.naturalWidth / image.naturalHeight);
}

test.use({ viewport: { width: 1280, height: 900 } });

test('a stored list thumbnail following the card crop survives saves untouched', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('gift-image-framing');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	const giftName = 'Dárek se sledujícím výřezem';
	const renamedGiftName = `${giftName} (přejmenovaný)`;
	try {
		const wishlistPath = await createWishlistAndNavigate(page, 'Legacy gift framings');
		await page
			.getByRole('button', { name: /Přidat (dárek|první přání)/ })
			.first()
			.click();
		const createDialog = page.getByRole('dialog');
		await expect(createDialog).toBeVisible({ timeout: 5_000 });
		await createDialog.locator('#gift-name').fill(giftName);
		await uploadGiftEditorImage(page, createDialog, SAMPLE_IMAGE_PATH);
		const legacyMeta = followingThumbMeta(await previewPhotoRatio(createDialog));
		await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(createDialog).not.toBeVisible({ timeout: 10_000 });
		await waitForDialogOverlayRemoval(page);

		await storeCoverMeta(wishlistPath, giftName, legacyMeta);
		expect(await storedCoverMeta(wishlistPath, giftName)).toEqual(legacyMeta);
		const legacyFramings = await renderedFramings(page, giftName);
		expect(legacyFramings.list.objectPosition, 'the list follows the card crop').toBe(
			legacyFramings.card.objectPosition,
		);
		expect(legacyFramings.list.objectPosition).not.toBe('50% 50%');

		// An edit-free save (only the name changes) keeps the stored image metadata verbatim.
		let editDialog = await openGiftEditor(page, giftName);
		let framingStep = await openGiftImageFraming(editDialog);
		await expect(framingStep.getByTestId('gift-framing-status-square')).toHaveText('Vlastní');
		await expect(framingStep.getByTestId('gift-framing-status-thumb')).toHaveText('Vlastní');
		await editDialog.getByRole('button', { name: 'Zpět', exact: true }).click();
		await editDialog.locator('#gift-name').fill(renamedGiftName);
		await saveGiftEditor(page, editDialog);
		expect(await storedCoverMeta(wishlistPath, renamedGiftName)).toEqual(legacyMeta);
		expect(await renderedFramings(page, renamedGiftName)).toEqual(legacyFramings);

		// Editing Karta alone changes the card and leaves the list exactly where it was.
		editDialog = await openGiftEditor(page, renamedGiftName);
		framingStep = await openGiftImageFraming(editDialog);
		await zoomInCard(framingStep, 6);
		await expect(framingStep.getByTestId('gift-framing-status-thumb')).toHaveText('Vlastní');
		await saveGiftEditor(page, editDialog);
		const editedFramings = await renderedFramings(page, renamedGiftName);
		expect(editedFramings.card).not.toEqual(legacyFramings.card);
		expect(editedFramings.list).toEqual(legacyFramings.list);
	} finally {
		await page.context().close();
	}
});
