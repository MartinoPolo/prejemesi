import { describe, expect, it } from 'vitest';
import {
	IMAGE_PREPARATION_FAILURES,
	ImagePreparationError,
	MAX_UPLOAD_IMAGE_EDGE_PX,
	prepareImageForUpload,
} from './prepare_image.js';
import {
	EXIF_ORIENTATION_ROTATE_CLOCKWISE,
	concatBytes,
	identifyingTextIn,
	withExifOrientation,
	withPhoneMetadata,
} from './image_metadata.test_fixtures.js';

const MEGABYTE = 1024 * 1024;
const GENEROUS_LIMIT = 50 * MEGABYTE;
const RANDOM_VALUES_CHUNK = 16384;
const ascii = new TextEncoder();

interface DrawOptions {
	width: number;
	height: number;
	type: 'image/jpeg' | 'image/png';
	noise?: boolean;
	transparentLeftHalf?: boolean;
	redTopLeftMarker?: number;
}

async function drawImageFile(name: string, options: DrawOptions): Promise<File> {
	const canvas = document.createElement('canvas');
	canvas.width = options.width;
	canvas.height = options.height;
	const context = canvas.getContext('2d')!;
	if (options.noise === true) {
		const pixels = context.createImageData(options.width, options.height);
		const random = new Uint32Array(pixels.data.buffer);
		for (let offset = 0; offset < random.length; offset += RANDOM_VALUES_CHUNK) {
			crypto.getRandomValues(random.subarray(offset, offset + RANDOM_VALUES_CHUNK));
		}
		for (let index = 3; index < pixels.data.length; index += 4) {
			pixels.data[index] = 255;
		}
		context.putImageData(pixels, 0, 0);
	} else {
		context.fillStyle = 'rgb(40, 120, 200)';
		context.fillRect(0, 0, options.width, options.height);
	}
	if (options.transparentLeftHalf === true) {
		context.clearRect(0, 0, options.width / 2, options.height);
	}
	if (options.redTopLeftMarker !== undefined) {
		context.fillStyle = 'rgb(255, 0, 0)';
		context.fillRect(0, 0, options.redTopLeftMarker, options.redTopLeftMarker);
	}
	const blob = await new Promise<Blob>((resolve) => {
		canvas.toBlob((result) => resolve(result!), options.type, 1);
	});
	return new File([blob], name, { type: options.type });
}

async function readPixel(file: File, x: number, y: number) {
	const bitmap = await createImageBitmap(file);
	const canvas = document.createElement('canvas');
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	const context = canvas.getContext('2d')!;
	context.drawImage(bitmap, 0, 0);
	const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
	return { width: bitmap.width, height: bitmap.height, red, green, blue, alpha };
}

async function bytesOf(file: File): Promise<Uint8Array> {
	return new Uint8Array(await file.arrayBuffer());
}

async function drawMarkedPhoto(): Promise<Uint8Array> {
	const stored = await drawImageFile('stored.jpg', {
		width: 400,
		height: 300,
		type: 'image/jpeg',
		redTopLeftMarker: 60,
	});
	return bytesOf(stored);
}

/** EXIF orientation 6 turns the stored 400×300 frame upright to 300×400, red marker at the top right. */
async function expectUprightMarkedPhoto(file: File) {
	const topRight = await readPixel(file, 300 - 20, 20);
	expect([topRight.width, topRight.height]).toEqual([300, 400]);
	expect(topRight.red).toBeGreaterThan(200);
	expect(topRight.green).toBeLessThan(60);
}

async function expectFailure(promise: Promise<unknown>, reason: string) {
	const thrown = await promise.then(
		() => null,
		(error: unknown) => error,
	);
	expect(thrown).toBeInstanceOf(ImagePreparationError);
	expect((thrown as ImagePreparationError).reason).toBe(reason);
}

describe('prepareImageForUpload', () => {
	it('keeps the bytes of a metadata-free image that already fits the byte limit and maximum edge', async () => {
		const file = await drawImageFile('small.jpg', {
			width: 800,
			height: 600,
			type: 'image/jpeg',
		});

		const prepared = await prepareImageForUpload(file, GENEROUS_LIMIT);

		expect(prepared.name).toBe('small.jpg');
		expect(prepared.type).toBe('image/jpeg');
		expect(await bytesOf(prepared)).toEqual(await bytesOf(file));
	});

	it('strips GPS and camera metadata from a phone photo within the limits without re-encoding it', async () => {
		const storedBytes = await drawMarkedPhoto();
		const photo = new File(
			[withPhoneMetadata(storedBytes, EXIF_ORIENTATION_ROTATE_CLOCKWISE)],
			'IMG_0001.jpg',
			{ type: 'image/jpeg' },
		);

		const prepared = await prepareImageForUpload(photo, GENEROUS_LIMIT);

		const preparedBytes = await bytesOf(prepared);
		expect(identifyingTextIn(preparedBytes)).toEqual([]);
		expect(preparedBytes).toEqual(
			withExifOrientation(storedBytes, EXIF_ORIENTATION_ROTATE_CLOCKWISE),
		);
		await expectUprightMarkedPhoto(prepared);
	});

	it('re-encodes a phone photo whose structure the metadata removal refuses, so no metadata survives', async () => {
		const photoBytes = withPhoneMetadata(
			await drawMarkedPhoto(),
			EXIF_ORIENTATION_ROTATE_CLOCKWISE,
		);
		// Decoders skip a stray byte between segments; the metadata walk refuses it.
		const afterExifSegment = 4 + ((photoBytes[4]! << 8) | photoBytes[5]!);
		const irregular = new File(
			[
				concatBytes(
					photoBytes.subarray(0, afterExifSegment),
					[0x00],
					photoBytes.subarray(afterExifSegment),
				),
			],
			'IMG_0002.jpg',
			{ type: 'image/jpeg' },
		);

		const prepared = await prepareImageForUpload(irregular, GENEROUS_LIMIT);

		expect(prepared.type).toBe('image/jpeg');
		expect(identifyingTextIn(await bytesOf(prepared))).toEqual([]);
		await expectUprightMarkedPhoto(prepared);
	});

	it('re-encodes a JPEG over the byte limit into a JPEG within it', async () => {
		const file = await drawImageFile('photo.JPG', {
			width: 2000,
			height: 1500,
			type: 'image/jpeg',
			noise: true,
		});
		const maxBytes = Math.floor(file.size / 2);

		const prepared = await prepareImageForUpload(file, maxBytes);

		expect(prepared.type).toBe('image/jpeg');
		expect(prepared.name).toBe('photo.jpg');
		expect(prepared.size).toBeLessThanOrEqual(maxBytes);
		const { width, height } = await readPixel(prepared, 0, 0);
		expect(width / height).toBeCloseTo(2000 / 1500, 2);
	});

	it('downscales an image whose longest edge exceeds the maximum even within the byte limit', async () => {
		const file = await drawImageFile('wide.jpg', {
			width: 4000,
			height: 1000,
			type: 'image/jpeg',
		});

		const prepared = await prepareImageForUpload(file, GENEROUS_LIMIT);

		const { width, height } = await readPixel(prepared, 0, 0);
		expect(width).toBe(MAX_UPLOAD_IMAGE_EDGE_PX);
		expect(height).toBe(MAX_UPLOAD_IMAGE_EDGE_PX / 4);
	});

	it('applies EXIF orientation so a rotated camera photo comes out upright', async () => {
		const stored = await drawImageFile('camera.jpg', {
			width: 4096,
			height: 3072,
			type: 'image/jpeg',
			redTopLeftMarker: 512,
		});
		const rotated = new File(
			[
				withExifOrientation(
					new Uint8Array(await stored.arrayBuffer()),
					EXIF_ORIENTATION_ROTATE_CLOCKWISE,
				),
			],
			'camera.jpg',
			{ type: 'image/jpeg' },
		);

		const prepared = await prepareImageForUpload(rotated, GENEROUS_LIMIT);

		const topRight = await readPixel(prepared, MAX_UPLOAD_IMAGE_EDGE_PX * 0.75 - 20, 20);
		expect(topRight.width).toBe(1920);
		expect(topRight.height).toBe(MAX_UPLOAD_IMAGE_EDGE_PX);
		expect(topRight.red).toBeGreaterThan(200);
		expect(topRight.green).toBeLessThan(60);
	});

	it('preserves transparency when a PNG has to be downscaled', async () => {
		const file = await drawImageFile('logo.png', {
			width: 4000,
			height: 2000,
			type: 'image/png',
			transparentLeftHalf: true,
		});

		const prepared = await prepareImageForUpload(file, GENEROUS_LIMIT);

		expect(['image/webp', 'image/png']).toContain(prepared.type);
		const transparent = await readPixel(prepared, 10, 10);
		expect(transparent.width).toBe(MAX_UPLOAD_IMAGE_EDGE_PX);
		expect(transparent.alpha).toBe(0);
		const opaque = await readPixel(prepared, MAX_UPLOAD_IMAGE_EDGE_PX - 10, 10);
		expect(opaque.alpha).toBe(255);
	});

	it('never re-encodes a GIF: within the limit it keeps every frame but loses its comment, over it the user is told', async () => {
		const header = [...ascii.encode('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255];
		const frame = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00];
		const comment = [0x21, 0xfe, 14, ...ascii.encode('Hidden comment'), 0x00];
		const gif = new File([concatBytes(header, comment, frame, frame, [0x3b])], 'party.gif', {
			type: 'image/gif',
		});

		const prepared = await prepareImageForUpload(gif, GENEROUS_LIMIT);

		expect(prepared.type).toBe('image/gif');
		expect(await bytesOf(prepared)).toEqual(concatBytes(header, frame, frame, [0x3b]));
		await expectFailure(prepareImageForUpload(gif, 32), IMAGE_PREPARATION_FAILURES.tooLarge);
	});

	it('never re-encodes an animated PNG', async () => {
		const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		const chunk = (type: string, length: number) => [
			0,
			0,
			0,
			length,
			...ascii.encode(type),
			...Array.from({ length: length + 4 }, () => 0),
		];
		const apngBytes = concatBytes(
			pngSignature,
			chunk('IHDR', 13),
			chunk('acTL', 8),
			chunk('fcTL', 26),
			chunk('IDAT', 4),
			chunk('IEND', 0),
		);
		const apng = new File([apngBytes], 'animated.png', { type: 'image/png' });

		const prepared = await prepareImageForUpload(apng, GENEROUS_LIMIT);

		expect(await bytesOf(prepared)).toEqual(apngBytes);
		await expectFailure(prepareImageForUpload(apng, 8), IMAGE_PREPARATION_FAILURES.tooLarge);
	});

	it('rejects a file type the app does not store', async () => {
		const heic = new File([new Uint8Array(1024)], 'IMG_0001.HEIC', { type: 'image/heic' });

		await expectFailure(
			prepareImageForUpload(heic, GENEROUS_LIMIT),
			IMAGE_PREPARATION_FAILURES.unsupportedType,
		);
	});

	it('reports a file that cannot be decoded', async () => {
		const damaged = new File(['not a picture'], 'damaged.jpg', { type: 'image/jpeg' });

		await expectFailure(
			prepareImageForUpload(damaged, GENEROUS_LIMIT),
			IMAGE_PREPARATION_FAILURES.unreadable,
		);
	});
});
