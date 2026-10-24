import { ImageMetadataError, stripImageMetadata } from './strip_image_metadata.js';
import { IMAGE_FILE_EXTENSIONS, isAllowedContentType, type AllowedContentType } from './types.js';

/**
 * Longest edge kept when an image is re-encoded before upload. The Gift viewer
 * shows the uncropped original inside a viewport height cap, so this keeps it
 * sharp on large high-density screens; every fixed-size surface needs far less
 * (see `IMAGE_VARIANTS`).
 */
export const MAX_UPLOAD_IMAGE_EDGE_PX = 2560;

const ENCODE_QUALITY = 0.85;
const SHRINK_FACTOR_PER_ATTEMPT = 0.75;
const MAX_ENCODE_ATTEMPTS = 5;
const ANIMATION_HEADER_SCAN_BYTES = 64 * 1024;

export const IMAGE_PREPARATION_FAILURES = {
	unsupportedType: 'unsupported-type',
	unreadable: 'unreadable',
	tooLarge: 'too-large',
} as const;

export type ImagePreparationFailure =
	(typeof IMAGE_PREPARATION_FAILURES)[keyof typeof IMAGE_PREPARATION_FAILURES];

export class ImagePreparationError extends Error {
	readonly reason: ImagePreparationFailure;

	constructor(reason: ImagePreparationFailure) {
		super(`Image preparation failed: ${reason}`);
		this.name = 'ImagePreparationError';
		this.reason = reason;
	}
}

interface DecodedImage {
	source: CanvasImageSource;
	width: number;
	height: number;
	release: () => void;
}

/**
 * Makes a picked image acceptable for upload. Every result is free of
 * location and other identifying metadata (see {@link stripImageMetadata}).
 * A file within `maxBytes` and {@link MAX_UPLOAD_IMAGE_EDGE_PX} keeps its
 * encoded pixels; a larger one, or one whose structure the metadata removal
 * cannot walk, is decoded with its EXIF orientation applied, downscaled and
 * re-encoded, which drops all metadata. Animated images (every GIF, animated
 * PNG and WebP) are never re-encoded, because a canvas keeps only their first
 * frame.
 */
export async function prepareImageForUpload(file: File, maxBytes: number): Promise<File> {
	const contentType = file.type;
	if (!isAllowedContentType(contentType)) {
		throw new ImagePreparationError(IMAGE_PREPARATION_FAILURES.unsupportedType);
	}

	const stripped = await withoutMetadata(file, contentType);

	if (await isAnimatedImage(file)) {
		if (stripped === null) {
			throw new ImagePreparationError(IMAGE_PREPARATION_FAILURES.unreadable);
		}
		if (stripped.size > maxBytes) {
			throw new ImagePreparationError(IMAGE_PREPARATION_FAILURES.tooLarge);
		}
		return stripped;
	}

	const image = await decodeImage(file);
	try {
		if (
			stripped !== null &&
			stripped.size <= maxBytes &&
			Math.max(image.width, image.height) <= MAX_UPLOAD_IMAGE_EDGE_PX
		) {
			return stripped;
		}
		return await downscaleAndEncode(file, image, maxBytes);
	} finally {
		image.release();
	}
}

/** The file without metadata, or `null` when its structure cannot be walked. */
async function withoutMetadata(file: File, contentType: AllowedContentType): Promise<File | null> {
	try {
		const bytes = stripImageMetadata(new Uint8Array(await file.arrayBuffer()), contentType);
		return new File([bytes], file.name, { type: contentType, lastModified: file.lastModified });
	} catch (thrown) {
		if (thrown instanceof ImageMetadataError) {
			return null;
		}
		throw thrown;
	}
}

async function decodeImage(file: File): Promise<DecodedImage> {
	if (typeof createImageBitmap === 'function') {
		try {
			const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
			return {
				source: bitmap,
				width: bitmap.width,
				height: bitmap.height,
				release: () => {
					bitmap.close();
				},
			};
		} catch {
			// Older engines reject the options bag or Blob sources; the <img> path
			// below still decodes those, and honors EXIF orientation when drawn.
		}
	}
	return decodeWithImageElement(file);
}

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
	const objectUrl = URL.createObjectURL(file);
	const image = new Image();
	image.src = objectUrl;
	try {
		await image.decode();
	} catch {
		URL.revokeObjectURL(objectUrl);
		throw new ImagePreparationError(IMAGE_PREPARATION_FAILURES.unreadable);
	}
	if (image.naturalWidth === 0 || image.naturalHeight === 0) {
		URL.revokeObjectURL(objectUrl);
		throw new ImagePreparationError(IMAGE_PREPARATION_FAILURES.unreadable);
	}
	return {
		source: image,
		width: image.naturalWidth,
		height: image.naturalHeight,
		release: () => {
			URL.revokeObjectURL(objectUrl);
		},
	};
}

async function downscaleAndEncode(
	file: File,
	image: DecodedImage,
	maxBytes: number,
): Promise<File> {
	// JPEG stays JPEG; other sources may carry transparency, which JPEG would
	// flatten, so they go to WebP with a lossless PNG fallback.
	const outputTypes: AllowedContentType[] =
		file.type === 'image/jpeg' ? ['image/jpeg'] : ['image/webp', 'image/png'];
	let scale = Math.min(1, MAX_UPLOAD_IMAGE_EDGE_PX / Math.max(image.width, image.height));

	for (let attempt = 0; attempt < MAX_ENCODE_ATTEMPTS; attempt += 1) {
		const blob = await drawAndEncode(
			image,
			Math.max(1, Math.round(image.width * scale)),
			Math.max(1, Math.round(image.height * scale)),
			outputTypes,
		);
		if (blob.size <= maxBytes) {
			return new File([blob], renameForType(file.name, blob.type as AllowedContentType), {
				type: blob.type,
				lastModified: file.lastModified,
			});
		}
		scale *= SHRINK_FACTOR_PER_ATTEMPT;
	}

	throw new ImagePreparationError(IMAGE_PREPARATION_FAILURES.tooLarge);
}

async function drawAndEncode(
	image: DecodedImage,
	width: number,
	height: number,
	outputTypes: AllowedContentType[],
): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	try {
		const context = canvas.getContext('2d');
		if (context === null) {
			throw new ImagePreparationError(IMAGE_PREPARATION_FAILURES.unreadable);
		}
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = 'high';
		context.drawImage(image.source, 0, 0, width, height);

		for (const type of outputTypes) {
			const blob = await new Promise<Blob | null>((resolve) => {
				canvas.toBlob(resolve, type, ENCODE_QUALITY);
			});
			// toBlob silently substitutes PNG for a type it cannot encode
			// (Safari has no WebP encoder), so only an exact match counts.
			if (blob !== null && blob.type === type) {
				return blob;
			}
		}
		throw new ImagePreparationError(IMAGE_PREPARATION_FAILURES.unreadable);
	} finally {
		// Release the backing store at once; Safari caps total canvas memory.
		canvas.width = 0;
		canvas.height = 0;
	}
}

function renameForType(fileName: string, type: AllowedContentType): string {
	const baseName = fileName.replace(/\.[^./\\]*$/, '') || 'image';
	return `${baseName}.${IMAGE_FILE_EXTENSIONS[type]}`;
}

async function isAnimatedImage(file: File): Promise<boolean> {
	if (file.type === 'image/gif') {
		return true;
	}
	if (file.type !== 'image/png' && file.type !== 'image/webp') {
		return false;
	}
	const header = new Uint8Array(await file.slice(0, ANIMATION_HEADER_SCAN_BYTES).arrayBuffer());
	return file.type === 'image/png'
		? hasPngAnimationControl(header)
		: hasWebpAnimationFlag(header);
}

const PNG_SIGNATURE_BYTES = 8;

/** APNG declares an `acTL` chunk before the first `IDAT` chunk. */
function hasPngAnimationControl(bytes: Uint8Array): boolean {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = PNG_SIGNATURE_BYTES;
	while (offset + 8 <= bytes.byteLength) {
		const chunkLength = view.getUint32(offset);
		const chunkType = readAscii(bytes, offset + 4, 4);
		if (chunkType === 'acTL') {
			return true;
		}
		if (chunkType === 'IDAT') {
			return false;
		}
		offset += 12 + chunkLength;
	}
	return false;
}

const WEBP_EXTENDED_FLAGS_OFFSET = 20;
const WEBP_ANIMATION_FLAG = 0x02;

/** Animated WebP uses the extended `VP8X` header with its animation flag set. */
function hasWebpAnimationFlag(bytes: Uint8Array): boolean {
	return (
		bytes.byteLength > WEBP_EXTENDED_FLAGS_OFFSET &&
		readAscii(bytes, 0, 4) === 'RIFF' &&
		readAscii(bytes, 8, 4) === 'WEBP' &&
		readAscii(bytes, 12, 4) === 'VP8X' &&
		(bytes[WEBP_EXTENDED_FLAGS_OFFSET] & WEBP_ANIMATION_FLAG) !== 0
	);
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
	return String.fromCharCode(...bytes.subarray(start, start + length));
}
