import { test, expect, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, shareWishlist } from './fixtures/wishlist-helpers.js';
import {
	EXIF_ORIENTATION_ROTATE_CLOCKWISE,
	identifyingTextIn,
	withPhoneMetadata,
} from '../../src/lib/modules/uploads/image_metadata.test_fixtures.js';
import { MAX_FILE_SIZE } from '../../src/lib/modules/uploads/types.js';
import { MAX_UPLOAD_IMAGE_EDGE_PX } from '../../src/lib/modules/uploads/prepare_image.js';
import * as m from '../../src/lib/paraglide/messages.js';

// Issue #525: a phone camera photo (4096×3072, over every per-target byte limit,
// EXIF-rotated) must upload as both a wishlist and a gift image.
const CAMERA_PHOTO_WIDTH = 4096;
const CAMERA_PHOTO_HEIGHT = 3072;
const MARKER_SIZE = 512;

interface CameraPhoto {
	name: string;
	mimeType: string;
	buffer: Buffer;
}

interface UploadedImage {
	width: number;
	height: number;
	bytes: number;
	topRightPixel: number[];
	/** Phone metadata values still present in the stored bytes. */
	identifyingText: string[];
}

interface MarkedPhotoOptions {
	width: number;
	height: number;
	markerSize: number;
	/** Noise defeats JPEG compression, so the photo exceeds every upload limit. */
	noise: boolean;
}

/**
 * Draws a JPEG whose red block marks the stored top-left corner, which EXIF
 * orientation 6 must display at the top right, and dresses it like a phone
 * photo: GPS, camera and serial EXIF, XMP, IPTC and an appended preview.
 */
async function buildPhonePhoto(page: Page, options: MarkedPhotoOptions): Promise<CameraPhoto> {
	const base64 = await page.evaluate(async ({ width, height, markerSize, noise }) => {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext('2d')!;
		if (noise) {
			const pixels = context.createImageData(width, height);
			const random = new Uint32Array(pixels.data.buffer);
			for (let offset = 0; offset < random.length; offset += 16384) {
				crypto.getRandomValues(random.subarray(offset, offset + 16384));
			}
			for (let index = 3; index < pixels.data.length; index += 4) {
				pixels.data[index] = 255;
			}
			context.putImageData(pixels, 0, 0);
		} else {
			context.fillStyle = 'rgb(40, 120, 200)';
			context.fillRect(0, 0, width, height);
		}
		context.fillStyle = 'rgb(255, 0, 0)';
		context.fillRect(0, 0, markerSize, markerSize);
		const blob = await new Promise<Blob>((resolve) => {
			canvas.toBlob((result) => resolve(result!), 'image/jpeg', 1);
		});
		const dataUrl = await new Promise<string>((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.readAsDataURL(blob);
		});
		return dataUrl.slice(dataUrl.indexOf(',') + 1);
	}, options);
	const buffer = Buffer.from(
		withPhoneMetadata(Buffer.from(base64, 'base64'), EXIF_ORIENTATION_ROTATE_CLOCKWISE),
	);
	expect(identifyingTextIn(buffer)).not.toEqual([]);
	return { name: 'IMG_camera_photo.jpg', mimeType: 'image/jpeg', buffer };
}

async function buildCameraPhoto(page: Page): Promise<CameraPhoto> {
	const photo = await buildPhonePhoto(page, {
		width: CAMERA_PHOTO_WIDTH,
		height: CAMERA_PHOTO_HEIGHT,
		markerSize: MARKER_SIZE,
		noise: true,
	});
	expect(photo.buffer.byteLength).toBeGreaterThan(Math.max(...Object.values(MAX_FILE_SIZE)));
	return photo;
}

function waitForUploadedObjectUrl(page: Page): Promise<string> {
	return page
		.waitForResponse(
			(response) =>
				response.request().method() === 'PUT' &&
				response.url().includes('/api/upload/') &&
				response.status() === 201,
			{ timeout: 30_000 },
		)
		.then((response) => new URL(response.url()).pathname);
}

async function inspectUploadedImage(page: Page, objectPath: string): Promise<UploadedImage> {
	const stored = await page.request.get(objectPath);
	expect(stored.ok()).toBe(true);
	const identifyingText = identifyingTextIn(await stored.body());
	const decoded = await page.evaluate(async (path) => {
		const blob = await (await fetch(path)).blob();
		const bitmap = await createImageBitmap(blob);
		const canvas = document.createElement('canvas');
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		const context = canvas.getContext('2d')!;
		context.drawImage(bitmap, 0, 0);
		const sample = context.getImageData(bitmap.width - 20, 20, 1, 1).data;
		return {
			width: bitmap.width,
			height: bitmap.height,
			bytes: blob.size,
			topRightPixel: [sample[0], sample[1], sample[2]],
		};
	}, objectPath);
	return { ...decoded, identifyingText };
}

function expectUprightWithoutMetadata(image: UploadedImage) {
	expect(image.identifyingText).toEqual([]);
	const [red, green, blue] = image.topRightPixel;
	expect(red).toBeGreaterThan(200);
	expect(green).toBeLessThan(60);
	expect(blue).toBeLessThan(60);
}

function expectDownscaledUpright(image: UploadedImage, maxBytes: number) {
	expectUprightWithoutMetadata(image);
	expect(image.bytes).toBeLessThanOrEqual(maxBytes);
	expect(image.height).toBe(MAX_UPLOAD_IMAGE_EDGE_PX);
	expect(image.width).toBe(
		Math.round((MAX_UPLOAD_IMAGE_EDGE_PX * CAMERA_PHOTO_HEIGHT) / CAMERA_PHOTO_WIDTH),
	);
}

async function openGiftImageUpload(page: Page): Promise<Locator> {
	await page
		.getByRole('button', { name: /Přidat/ })
		.first()
		.click();
	const addDialog = page.getByRole('dialog');
	await expect(addDialog).toBeVisible({ timeout: 5_000 });
	await addDialog.getByRole('radio', { name: 'Nahrát', exact: true }).click();
	await expect(addDialog.locator('input[type=file]')).toBeAttached();
	return addDialog;
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Large camera photo upload (#525)', () => {
	test('downscales an EXIF-rotated photo for the wishlist image', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('upload-wl-large'),
		);
		try {
			const wishlistPath = await createWishlistAndNavigate(page, 'Large Photo Wishlist');
			const photo = await buildCameraPhoto(page);

			await page.goto(`${wishlistPath}/settings#image`);
			await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
			const uploadedObject = waitForUploadedObjectUrl(page);
			await page.locator('input[type=file]').first().setInputFiles(photo);
			const uploaded = await inspectUploadedImage(page, await uploadedObject);
			expectDownscaledUpright(uploaded, MAX_FILE_SIZE['wishlist-banner']);

			await page.getByTestId('wishlist-settings-save').click();
			await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
			await expect(page.locator('.polaroid-img img')).toBeVisible({ timeout: 10_000 });
		} finally {
			await page.context().close();
		}
	});

	test('downscales an EXIF-rotated photo for a gift image', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('upload-gift-large'),
		);
		try {
			await createWishlistAndNavigate(page, 'Large Photo Gift');
			const photo = await buildCameraPhoto(page);
			const giftName = 'Darek s velkou fotkou';

			const addDialog = await openGiftImageUpload(page);
			await addDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);
			const uploadedObject = waitForUploadedObjectUrl(page);
			await addDialog.locator('input[type=file]').setInputFiles(photo);
			const uploaded = await inspectUploadedImage(page, await uploadedObject);
			expectDownscaledUpright(uploaded, MAX_FILE_SIZE['gift-image']);

			await addDialog.getByRole('button', { name: 'Přidat dárek' }).click();
			await expect(addDialog).not.toBeVisible({ timeout: 10_000 });
			await expect(page.getByRole('heading', { name: giftName, level: 3 })).toBeVisible();
		} finally {
			await page.context().close();
		}
	});

	test('explains an unreadable image without uploading it', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('upload-unreadable'),
		);
		try {
			await createWishlistAndNavigate(page, 'Unreadable Photo');
			let uploadAttempted = false;
			page.on('request', (sentRequest) => {
				if (sentRequest.method() === 'PUT' && sentRequest.url().includes('/api/upload/')) {
					uploadAttempted = true;
				}
			});

			const addDialog = await openGiftImageUpload(page);
			await addDialog.locator('input[type=file]').setInputFiles({
				name: 'damaged.jpg',
				mimeType: 'image/jpeg',
				buffer: Buffer.from('this is not a picture'),
			});
			await expect(addDialog.getByText(m.image_upload_error_unreadable())).toBeVisible();
			await expect(addDialog.getByTestId('image-upload-preview')).toHaveCount(0);
			await expect(addDialog.getByAltText(m.image_upload_preview_alt())).toHaveCount(0);
			expect(uploadAttempted).toBe(false);
		} finally {
			await page.context().close();
		}
	});
});

test.describe('Phone photo metadata (#558)', () => {
	test('a phone photo within the limits uploads without GPS or camera metadata and displays upright', async ({
		browser,
		request,
		baseURL,
	}) => {
		const ownerPage = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('upload-gift-metadata'),
		);
		const giftName = 'Darek z telefonu';
		let wishlistPath: string;
		try {
			await createWishlistAndNavigate(ownerPage, 'Phone Photo Metadata');
			const photo = await buildPhonePhoto(ownerPage, {
				width: 1200,
				height: 900,
				markerSize: 150,
				noise: false,
			});
			expect(photo.buffer.byteLength).toBeLessThan(MAX_FILE_SIZE['gift-image']);

			const addDialog = await openGiftImageUpload(ownerPage);
			await addDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);
			const uploadedObject = waitForUploadedObjectUrl(ownerPage);
			await addDialog.locator('input[type=file]').setInputFiles(photo);
			const uploaded = await inspectUploadedImage(ownerPage, await uploadedObject);
			expectUprightWithoutMetadata(uploaded);
			expect([uploaded.width, uploaded.height]).toEqual([900, 1200]);

			await addDialog.getByRole('button', { name: 'Přidat dárek' }).click();
			await expect(addDialog).not.toBeVisible({ timeout: 10_000 });
			await shareWishlist(ownerPage);
			wishlistPath = new URL(ownerPage.url()).pathname;
		} finally {
			await ownerPage.context().close();
		}

		const visitorContext = await browser.newContext();
		try {
			const visitorPage = await visitorContext.newPage();
			await visitorPage.goto(wishlistPath);
			await visitorPage.getByText(giftName, { exact: true }).first().click();
			const viewer = visitorPage.getByRole('dialog');
			const viewerImage = viewer.getByTestId('gift-viewer-photo').locator('img');
			await expect
				.poll(() =>
					viewerImage.evaluate((image: HTMLImageElement) =>
						image.complete ? [image.naturalWidth, image.naturalHeight] : null,
					),
				)
				.toEqual([900, 1200]);
			await viewer.screenshot({
				path: test.info().outputPath('phone-photo-gift-viewer.png'),
			});
		} finally {
			await visitorContext.close();
		}
	});
});
