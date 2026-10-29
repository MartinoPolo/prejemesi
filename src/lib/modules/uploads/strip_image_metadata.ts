import type { AllowedContentType } from './types.js';

/**
 * Raised when an image's container structure cannot be walked safely, so its
 * metadata cannot be removed without risking a broken file.
 */
export class ImageMetadataError extends Error {
	constructor(message: string) {
		super(`Image metadata could not be removed: ${message}`);
		this.name = 'ImageMetadataError';
	}
}

/**
 * Removes location, camera and other identifying metadata (EXIF, XMP, IPTC,
 * comments, text chunks, embedded preview images) from an image without
 * re-encoding its pixels. Data needed to render the image faithfully stays:
 * colour profiles, transparency, animation control and the EXIF orientation,
 * which is rewritten as a minimal EXIF block holding nothing else so a
 * rotated phone photo still displays upright.
 */
export function stripImageMetadata(
	bytes: Uint8Array,
	contentType: AllowedContentType,
): Uint8Array<ArrayBuffer> {
	switch (contentType) {
		case 'image/jpeg':
			return stripJpegMetadata(bytes);
		case 'image/png':
			return stripPngMetadata(bytes);
		case 'image/webp':
			return stripWebpMetadata(bytes);
		case 'image/gif':
			return stripGifMetadata(bytes);
	}
}

/**
 * Output barely outgrows its input (a rewritten orientation block, a closing
 * marker), so one buffer sized from the input takes every copy: a hostile file
 * of millions of tiny blocks must not become millions of objects.
 */
class ByteWriter {
	private buffer: Uint8Array<ArrayBuffer>;
	private written = 0;

	constructor(inputLength: number) {
		this.buffer = new Uint8Array(inputLength + 64);
	}

	get length(): number {
		return this.written;
	}

	append(part: Uint8Array | readonly number[]): void {
		const end = this.written + part.length;
		if (end > this.buffer.byteLength) {
			const grown = new Uint8Array(Math.max(end, this.buffer.byteLength * 2));
			grown.set(this.buffer.subarray(0, this.written));
			this.buffer = grown;
		}
		this.buffer.set(part, this.written);
		this.written = end;
	}

	toBytes(): Uint8Array<ArrayBuffer> {
		return this.buffer.slice(0, this.written);
	}
}

const textEncoder = new TextEncoder();

function readAscii(bytes: Uint8Array, start: number, length: number): string {
	return String.fromCharCode(...bytes.subarray(start, start + length));
}

function startsWithAscii(bytes: Uint8Array, start: number, text: string): boolean {
	return start + text.length <= bytes.byteLength && readAscii(bytes, start, text.length) === text;
}

function dataView(bytes: Uint8Array): DataView {
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function assertWithin(bytes: Uint8Array, end: number, what: string): void {
	if (end > bytes.byteLength) {
		throw new ImageMetadataError(`${what} runs past the end of the file`);
	}
}

// --- EXIF orientation -------------------------------------------------------

const EXIF_ORIENTATION_TAG = 0x0112;
const TIFF_SHORT_TYPE = 3;
const EXIF_IDENTIFIER = 'Exif\0\0';

/**
 * The orientation (2–8) a TIFF/EXIF block asks viewers to apply, or `null`
 * when it is absent, the identity, or unreadable – viewers ignore an
 * unreadable block too, so dropping it changes nothing visible.
 */
function readExifOrientation(tiff: Uint8Array): number | null {
	if (tiff.byteLength < 8) {
		return null;
	}
	const byteOrder = readAscii(tiff, 0, 2);
	if (byteOrder !== 'II' && byteOrder !== 'MM') {
		return null;
	}
	const littleEndian = byteOrder === 'II';
	const view = dataView(tiff);
	if (view.getUint16(2, littleEndian) !== 42) {
		return null;
	}
	const directoryOffset = view.getUint32(4, littleEndian);
	if (directoryOffset + 2 > tiff.byteLength) {
		return null;
	}
	const entryCount = view.getUint16(directoryOffset, littleEndian);
	for (let index = 0; index < entryCount; index += 1) {
		const entryOffset = directoryOffset + 2 + index * 12;
		if (entryOffset + 12 > tiff.byteLength) {
			return null;
		}
		if (view.getUint16(entryOffset, littleEndian) !== EXIF_ORIENTATION_TAG) {
			continue;
		}
		if (view.getUint16(entryOffset + 2, littleEndian) !== TIFF_SHORT_TYPE) {
			return null;
		}
		const orientation = view.getUint16(entryOffset + 8, littleEndian);
		return orientation >= 2 && orientation <= 8 ? orientation : null;
	}
	return null;
}

/** A big-endian TIFF block whose only entry is the orientation tag. */
function orientationOnlyTiff(orientation: number): number[] {
	return [
		[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // "MM", 42, first directory at 8
		[0x00, 0x01], // one entry
		[0x01, 0x12, 0x00, TIFF_SHORT_TYPE, 0x00, 0x00, 0x00, 0x01], // Orientation, SHORT ×1
		[0x00, orientation, 0x00, 0x00], // value, padded to four bytes
		[0x00, 0x00, 0x00, 0x00], // no further directory
	].flat();
}

// --- JPEG ---------------------------------------------------------------

const JPEG_MARKER_PREFIX = 0xff;
const JPEG_START_OF_IMAGE = 0xd8;
const JPEG_END_OF_IMAGE = 0xd9;
const JPEG_START_OF_SCAN = 0xda;
const JPEG_APP0 = 0xe0;
const JPEG_APP1 = 0xe1;
const JPEG_APP2 = 0xe2;
const JPEG_APP14 = 0xee;
const JPEG_APP15 = 0xef;
const JPEG_COMMENT = 0xfe;

const JPEG_TEMPORARY_MARKER = 0x01;
const JPEG_ESCAPED_DATA_BYTE = 0x00;

function isJpegRestartMarker(marker: number): boolean {
	return marker >= 0xd0 && marker <= 0xd7;
}

/** TEM and the restart markers carry no length field. */
function isStandaloneJpegMarker(marker: number): boolean {
	return marker === JPEG_TEMPORARY_MARKER || isJpegRestartMarker(marker);
}

/**
 * Keeps only the application segments that change how pixels render: JFIF
 * (APP0), the ICC colour profile (APP2) and Adobe's colour-transform flag
 * (APP14). EXIF/XMP (APP1), MPF preview images (APP2), JFXX thumbnails (APP0),
 * IPTC (APP13) and comments are dropped.
 */
function keepsJpegSegment(marker: number, payload: Uint8Array): boolean {
	switch (marker) {
		case JPEG_APP0:
			return startsWithAscii(payload, 0, 'JFIF\0');
		case JPEG_APP2:
			return startsWithAscii(payload, 0, 'ICC_PROFILE\0');
		case JPEG_APP14:
			return startsWithAscii(payload, 0, 'Adobe');
		default:
			return !(marker >= JPEG_APP0 && marker <= JPEG_APP15) && marker !== JPEG_COMMENT;
	}
}

/** Identifier, version, density units and the two densities, ending at the thumbnail size. */
const JFIF_HEADER_BYTES = 12;

/**
 * The JFIF segment without its embedded thumbnail, which shows the whole
 * uncropped photo.
 */
function jfifSegmentWithoutThumbnail(
	segment: Uint8Array,
	payload: Uint8Array,
): Uint8Array | number[] {
	const isWithoutThumbnail =
		payload.byteLength === JFIF_HEADER_BYTES + 2 &&
		payload[JFIF_HEADER_BYTES] === 0 &&
		payload[JFIF_HEADER_BYTES + 1] === 0;
	if (isWithoutThumbnail || payload.byteLength < JFIF_HEADER_BYTES) {
		return segment;
	}
	const segmentLength = JFIF_HEADER_BYTES + 2 + 2;
	return [
		JPEG_MARKER_PREFIX,
		JPEG_APP0,
		segmentLength >> 8,
		segmentLength & 0xff,
		...payload.subarray(0, JFIF_HEADER_BYTES),
		0, // thumbnail width
		0, // thumbnail height
	];
}

function jpegExifSegment(orientation: number): number[] {
	const payload = [...textEncoder.encode(EXIF_IDENTIFIER), ...orientationOnlyTiff(orientation)];
	const segmentLength = payload.length + 2;
	return [JPEG_MARKER_PREFIX, JPEG_APP1, segmentLength >> 8, segmentLength & 0xff, ...payload];
}

/** The offset of the next marker after a scan's entropy-coded data. */
function endOfEntropyCodedData(bytes: Uint8Array, start: number): number {
	for (let offset = start; offset + 1 < bytes.byteLength; offset += 1) {
		if (bytes[offset] !== JPEG_MARKER_PREFIX) {
			continue;
		}
		const next = bytes[offset + 1]!;
		// 0xFF00 is an escaped data byte, restart markers sit inside the scan
		// and a repeated 0xFF is fill before the real marker.
		if (
			next !== JPEG_ESCAPED_DATA_BYTE &&
			next !== JPEG_MARKER_PREFIX &&
			!isJpegRestartMarker(next)
		) {
			return offset;
		}
	}
	return bytes.byteLength;
}

/**
 * Rewrites the segment list up to the end-of-image marker, which it always
 * closes with. Anything after that marker is dropped: phones append preview,
 * depth and gain-map JPEGs there, each with its own EXIF block.
 */
function stripJpegMetadata(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
	if (bytes[0] !== JPEG_MARKER_PREFIX || bytes[1] !== JPEG_START_OF_IMAGE) {
		throw new ImageMetadataError('missing JPEG start-of-image marker');
	}
	const view = dataView(bytes);
	const output = new ByteWriter(bytes.byteLength);
	output.append(bytes.subarray(0, 2));
	let wroteOrientation = false;
	let wroteScan = false;
	let offset = 2;

	while (offset + 1 < bytes.byteLength) {
		const marker = bytes[offset + 1]!;
		// Decoders skip any byte that does not start a marker, as do repeated
		// 0xFF fill bytes; so does this walk.
		if (
			bytes[offset] !== JPEG_MARKER_PREFIX ||
			marker === JPEG_MARKER_PREFIX ||
			marker === JPEG_ESCAPED_DATA_BYTE
		) {
			offset += 1;
			continue;
		}
		if (marker === JPEG_END_OF_IMAGE) {
			break;
		}
		if (isStandaloneJpegMarker(marker)) {
			output.append(bytes.subarray(offset, offset + 2));
			offset += 2;
			continue;
		}
		const segmentEnd =
			offset + 4 <= bytes.byteLength ? offset + 2 + view.getUint16(offset + 2) : Infinity;
		if (segmentEnd > bytes.byteLength || segmentEnd < offset + 4) {
			// A damaged tail after the image data renders like a truncated file.
			if (wroteScan) {
				break;
			}
			throw new ImageMetadataError(`the JPEG segment at byte ${offset} is damaged`);
		}
		const segment = bytes.subarray(offset, segmentEnd);
		const payload = bytes.subarray(offset + 4, segmentEnd);

		if (marker === JPEG_APP1 && startsWithAscii(payload, 0, EXIF_IDENTIFIER)) {
			const orientation = readExifOrientation(payload.subarray(EXIF_IDENTIFIER.length));
			if (orientation !== null && !wroteOrientation) {
				output.append(jpegExifSegment(orientation));
				wroteOrientation = true;
			}
		} else if (marker === JPEG_APP0 && keepsJpegSegment(marker, payload)) {
			output.append(jfifSegmentWithoutThumbnail(segment, payload));
		} else if (keepsJpegSegment(marker, payload)) {
			output.append(segment);
		}

		offset = segmentEnd;
		if (marker === JPEG_START_OF_SCAN) {
			const scanEnd = endOfEntropyCodedData(bytes, offset);
			output.append(bytes.subarray(offset, scanEnd));
			offset = scanEnd;
			wroteScan = true;
		}
	}
	output.append([JPEG_MARKER_PREFIX, JPEG_END_OF_IMAGE]);
	return output.toBytes();
}

// --- PNG ----------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Ancillary chunks that affect rendering or animation. Every other ancillary
 * chunk – `eXIf`, the `tEXt`/`zTXt`/`iTXt` text chunks that carry XMP, `tIME`
 * and private chunks – is dropped. Critical chunks are always kept.
 */
const PNG_RENDERING_CHUNKS = new Set([
	'tRNS',
	'cHRM',
	'gAMA',
	'iCCP',
	'sBIT',
	'sRGB',
	'cICP',
	'mDCV',
	'cLLI',
	'bKGD',
	'hIST',
	'pHYs',
	'sPLT',
	'acTL',
	'fcTL',
	'fdAT',
]);

let crc32Table: Uint32Array | undefined;

function crc32(bytes: Uint8Array): number {
	crc32Table ??= Uint32Array.from({ length: 256 }, (_, index) => {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) {
			value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		return value >>> 0;
	});
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc = crc32Table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: readonly number[]): Uint8Array {
	const chunk = new Uint8Array(12 + data.length);
	const view = dataView(chunk);
	view.setUint32(0, data.length);
	chunk.set(textEncoder.encode(type), 4);
	chunk.set(data, 8);
	view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
	return chunk;
}

function isCriticalPngChunk(type: string): boolean {
	return type.charCodeAt(0) >= 0x41 && type.charCodeAt(0) <= 0x5a;
}

function stripPngMetadata(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
	if (!PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
		throw new ImageMetadataError('missing PNG signature');
	}
	const view = dataView(bytes);
	const output = new ByteWriter(bytes.byteLength);
	output.append(bytes.subarray(0, PNG_SIGNATURE.length));
	let wroteOrientation = false;
	let wroteImageData = false;
	let offset = PNG_SIGNATURE.length;

	while (offset < bytes.byteLength) {
		const dataLength = offset + 8 <= bytes.byteLength ? view.getUint32(offset) : Infinity;
		const type = readAscii(bytes, offset + 4, 4);
		const chunkEnd = offset + 12 + dataLength;
		if (chunkEnd > bytes.byteLength) {
			// A damaged tail after the image data renders like a truncated file.
			if (wroteImageData) {
				break;
			}
			throw new ImageMetadataError(`the PNG chunk at byte ${offset} is damaged`);
		}

		if (type === 'eXIf') {
			const orientation = readExifOrientation(
				bytes.subarray(offset + 8, offset + 8 + dataLength),
			);
			if (orientation !== null && !wroteOrientation) {
				output.append(pngChunk('eXIf', orientationOnlyTiff(orientation)));
				wroteOrientation = true;
			}
		} else if (isCriticalPngChunk(type) || PNG_RENDERING_CHUNKS.has(type)) {
			output.append(bytes.subarray(offset, chunkEnd));
			wroteImageData ||= type === 'IDAT';
		}
		offset = chunkEnd;
		if (type === 'IEND') {
			return output.toBytes();
		}
	}
	output.append(pngChunk('IEND', []));
	return output.toBytes();
}

// --- WebP ---------------------------------------------------------------

const RIFF_HEADER_BYTES = 12;
const WEBP_IMAGE_CHUNKS = new Set(['VP8X', 'VP8 ', 'VP8L', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);
const WEBP_XMP_FLAG = 0x04;
const WEBP_EXIF_FLAG = 0x08;

function riffChunk(fourCc: string, data: readonly number[]): Uint8Array {
	const paddedLength = data.length + (data.length % 2);
	const chunk = new Uint8Array(8 + paddedLength);
	chunk.set(textEncoder.encode(fourCc), 0);
	dataView(chunk).setUint32(4, data.length, true);
	chunk.set(data, 8);
	return chunk;
}

function stripWebpMetadata(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
	if (!startsWithAscii(bytes, 0, 'RIFF') || !startsWithAscii(bytes, 8, 'WEBP')) {
		throw new ImageMetadataError('missing RIFF/WEBP header');
	}
	const view = dataView(bytes);
	const riffEnd = Math.min(bytes.byteLength, 8 + view.getUint32(4, true));
	const writer = new ByteWriter(bytes.byteLength);
	writer.append(bytes.subarray(0, RIFF_HEADER_BYTES));
	let extendedFlagsOffset: number | null = null;
	let wroteOrientation = false;
	let offset = RIFF_HEADER_BYTES;

	while (offset + 8 <= riffEnd) {
		const fourCc = readAscii(bytes, offset, 4);
		const dataLength = view.getUint32(offset + 4, true);
		const chunkEnd = offset + 8 + dataLength + (dataLength % 2);
		assertWithin(bytes, Math.min(chunkEnd, offset + 8 + dataLength), `WebP ${fourCc} chunk`);
		const chunk = bytes.subarray(offset, Math.min(chunkEnd, bytes.byteLength));

		if (fourCc === 'EXIF') {
			const exif = chunk.subarray(8, 8 + dataLength);
			const tiff = startsWithAscii(exif, 0, EXIF_IDENTIFIER)
				? exif.subarray(EXIF_IDENTIFIER.length)
				: exif;
			const orientation = readExifOrientation(tiff);
			// Only the extended format may carry EXIF.
			if (orientation !== null && !wroteOrientation && extendedFlagsOffset !== null) {
				writer.append(riffChunk('EXIF', orientationOnlyTiff(orientation)));
				wroteOrientation = true;
			}
		} else if (WEBP_IMAGE_CHUNKS.has(fourCc)) {
			if (fourCc === 'VP8X' && extendedFlagsOffset === null) {
				assertWithin(chunk, 9, 'WebP VP8X flags');
				extendedFlagsOffset = writer.length + 8;
			}
			writer.append(chunk);
		}
		offset = chunkEnd;
	}

	const output = writer.toBytes();
	if (extendedFlagsOffset !== null) {
		const flags = output[extendedFlagsOffset]! & ~(WEBP_XMP_FLAG | WEBP_EXIF_FLAG);
		output[extendedFlagsOffset] = wroteOrientation ? flags | WEBP_EXIF_FLAG : flags;
	}
	dataView(output).setUint32(4, output.byteLength - 8, true);
	return output;
}

// --- GIF ----------------------------------------------------------------

const GIF_HEADER_AND_SCREEN_DESCRIPTOR_BYTES = 13;
const GIF_IMAGE_DESCRIPTOR = 0x2c;
const GIF_EXTENSION = 0x21;
const GIF_TRAILER = 0x3b;
const GIF_PLAIN_TEXT_LABEL = 0x01;
const GIF_COMMENT_LABEL = 0xfe;
const GIF_APPLICATION_LABEL = 0xff;
const GIF_COLOR_TABLE_FLAG = 0x80;

/** Application extensions that control looping or colour; others (such as XMP) are dropped. */
const GIF_RENDERING_APPLICATIONS = ['NETSCAPE2.0', 'ANIMEXTS1.0', 'ICCRGBG1012'];

function colorTableBytes(packedFields: number): number {
	return packedFields & GIF_COLOR_TABLE_FLAG ? 3 * 2 ** ((packedFields & 0x07) + 1) : 0;
}

/**
 * The offset just past a run of data sub-blocks and its zero-length
 * terminator, or `null` when the file ends first.
 */
function endOfGifSubBlocks(bytes: Uint8Array, start: number): number | null {
	let offset = start;
	while (offset < bytes.byteLength) {
		const blockLength = bytes[offset]!;
		offset += 1 + blockLength;
		if (blockLength === 0) {
			return offset;
		}
	}
	return null;
}

/** The offset just past the block at `start`, or `null` for an unknown or truncated block. */
function endOfGifBlock(bytes: Uint8Array, start: number): number | null {
	switch (bytes[start]) {
		case GIF_IMAGE_DESCRIPTOR: {
			if (start + 10 > bytes.byteLength) {
				return null;
			}
			// Descriptor, local colour table, then the LZW minimum code size byte.
			return endOfGifSubBlocks(bytes, start + 10 + colorTableBytes(bytes[start + 9]!) + 1);
		}
		case GIF_EXTENSION:
			return endOfGifSubBlocks(bytes, start + 2);
		default:
			return null;
	}
}

/**
 * Drops comments, plain text (which browsers never render) and unknown
 * application extensions.
 */
function keepsGifExtension(bytes: Uint8Array, start: number, label: number): boolean {
	if (label === GIF_COMMENT_LABEL || label === GIF_PLAIN_TEXT_LABEL) {
		return false;
	}
	if (label !== GIF_APPLICATION_LABEL) {
		return true;
	}
	const identifier = readAscii(bytes, start + 3, Math.min(bytes[start + 2] ?? 0, 11));
	return GIF_RENDERING_APPLICATIONS.includes(identifier);
}

/**
 * Walks the blocks up to the trailer, which it always closes with. Like
 * decoders, it ends the image at the first block it cannot read, so stray
 * bytes or a truncated tail only cost what follows them.
 */
function stripGifMetadata(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
	if (!/^GIF8[79]a$/.test(readAscii(bytes, 0, 6))) {
		throw new ImageMetadataError('missing GIF header');
	}
	assertWithin(bytes, GIF_HEADER_AND_SCREEN_DESCRIPTOR_BYTES, 'GIF screen descriptor');
	const output = new ByteWriter(bytes.byteLength);
	const headerEnd = GIF_HEADER_AND_SCREEN_DESCRIPTOR_BYTES + colorTableBytes(bytes[10]!);
	assertWithin(bytes, headerEnd, 'GIF global colour table');
	output.append(bytes.subarray(0, headerEnd));
	let wroteFrame = false;
	let offset = headerEnd;

	while (offset < bytes.byteLength && bytes[offset] !== GIF_TRAILER) {
		const blockEnd = endOfGifBlock(bytes, offset);
		if (blockEnd === null || blockEnd > bytes.byteLength) {
			break;
		}
		if (bytes[offset] === GIF_IMAGE_DESCRIPTOR) {
			output.append(bytes.subarray(offset, blockEnd));
			wroteFrame = true;
		} else if (keepsGifExtension(bytes, offset, bytes[offset + 1]!)) {
			output.append(bytes.subarray(offset, blockEnd));
		}
		offset = blockEnd;
	}
	if (!wroteFrame) {
		throw new ImageMetadataError('no complete GIF frame');
	}
	output.append([GIF_TRAILER]);
	return output.toBytes();
}
