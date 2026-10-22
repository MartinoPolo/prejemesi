import { describe, expect, it } from 'vitest';
import {
	IMAGE_PREPARATION_FAILURES,
	ImagePreparationError,
	MAX_UPLOAD_IMAGE_EDGE_PX,
	prepareImageForUpload,
} from './prepare_image.js';
import {
	EXIF_ORIENTATION_ROTATE_CLOCKWISE,
	withExifOrientation,
} from './jpeg_orientation.test_fixtures.js';

const MEGABYTE = 1024 * 1024;
const GENEROUS_LIMIT = 50 * MEGABYTE;
const RANDOM_VALUES_CHUNK = 16384;

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

async function expectFailure(promise: Promise<unknown>, reason: string) {
	const thrown = await promise.then(
		() => null,
		(error: unknown) => error,
	);
	expect(thrown).toBeInstanceOf(ImagePreparationError);
	expect((thrown as ImagePreparationError).reason).toBe(reason);
}

describe('prepareImageForUpload', () => {
	it('keeps an image that already fits the byte limit and maximum edge untouched', async () => {
		const file = await drawImageFile('small.jpg', {
			width: 800,
			height: 600,
			type: 'image/jpeg',
		});

		expect(await prepareImageForUpload(file, GENEROUS_LIMIT)).toBe(file);
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

	it('never re-encodes a GIF: within the limit it is kept, over it the user is told', async () => {
		const gif = new File([new Uint8Array(1024)], 'party.gif', { type: 'image/gif' });

		expect(await prepareImageForUpload(gif, GENEROUS_LIMIT)).toBe(gif);
		await expectFailure(prepareImageForUpload(gif, 512), IMAGE_PREPARATION_FAILURES.tooLarge);
	});

	it('never re-encodes an animated PNG', async () => {
		const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		const ascii = new TextEncoder();
		const ihdrChunk = [0, 0, 0, 13, ...ascii.encode('IHDR')];
		const ihdrBodyAndCrc = Array.from({ length: 13 + 4 }, () => 0);
		const actlChunk = [0, 0, 0, 8, ...ascii.encode('acTL')];
		const apng = new File(
			[new Uint8Array([...pngSignature, ...ihdrChunk, ...ihdrBodyAndCrc, ...actlChunk])],
			'animated.png',
			{ type: 'image/png' },
		);

		expect(await prepareImageForUpload(apng, GENEROUS_LIMIT)).toBe(apng);
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
