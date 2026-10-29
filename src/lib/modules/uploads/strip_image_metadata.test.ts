import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ImageMetadataError, stripImageMetadata } from './strip_image_metadata.js';
import {
	EXIF_ORIENTATION_ROTATE_CLOCKWISE,
	PNG_XMP_TEXT,
	XMP_PACKET_BYTES,
	concatBytes,
	identifyingTextIn,
	orientationOnlyTiff,
	phoneTiff,
	structuralJpeg,
	withExifOrientation,
	withPhoneMetadata,
} from './image_metadata.test_fixtures.js';

const ascii = (text: string): number[] => [...new TextEncoder().encode(text)];
const EXIF_ORIENTATION_NORMAL = 1;
const EXIF_ORIENTATION_ROTATE_COUNTERCLOCKWISE = 8;
/** The marker, length and 14-byte payload of the JFIF segment in {@link structuralJpeg}. */
const JFIF_SEGMENT_BYTES = 18;

describe('stripImageMetadata: JPEG', () => {
	it('removes GPS, camera, XMP, IPTC, MPF, comments and appended previews from a phone photo', () => {
		const photo = withPhoneMetadata(structuralJpeg(), EXIF_ORIENTATION_ROTATE_CLOCKWISE);
		expect(identifyingTextIn(photo)).not.toEqual([]);

		const stripped = stripImageMetadata(photo, 'image/jpeg');

		expect(identifyingTextIn(stripped)).toEqual([]);
		expect(stripped).toEqual(
			withExifOrientation(structuralJpeg(), EXIF_ORIENTATION_ROTATE_CLOCKWISE),
		);
	});

	it('keeps no EXIF at all when the photo is already upright', () => {
		const photo = withPhoneMetadata(structuralJpeg(), EXIF_ORIENTATION_NORMAL);

		expect(stripImageMetadata(photo, 'image/jpeg')).toEqual(structuralJpeg());
	});

	it('leaves a metadata-free JPEG byte-for-byte intact, including colour segments and scans', () => {
		expect(stripImageMetadata(structuralJpeg(), 'image/jpeg')).toEqual(structuralJpeg());
	});

	it('keeps an orientation-only EXIF block in either byte order', () => {
		const bigEndian = withExifOrientation(
			structuralJpeg(),
			EXIF_ORIENTATION_ROTATE_COUNTERCLOCKWISE,
		);

		expect(stripImageMetadata(bigEndian, 'image/jpeg')).toEqual(bigEndian);
	});

	it('skips stray bytes between segments, as decoders do', () => {
		const jpeg = structuralJpeg();
		const afterJfifSegment = 2 + JFIF_SEGMENT_BYTES;
		const padded = concatBytes(
			jpeg.subarray(0, afterJfifSegment),
			[0x00, 0x12],
			jpeg.subarray(afterJfifSegment),
		);

		expect(stripImageMetadata(padded, 'image/jpeg')).toEqual(jpeg);
	});

	it('closes a JPEG cut off after its image data, dropping the damaged tail', () => {
		const jpeg = structuralJpeg();
		const withoutEndMarker = jpeg.subarray(0, jpeg.byteLength - 2);
		const damagedTail = [0xff, 0xc4, 0x40, 0x00, 0x01];

		expect(
			stripImageMetadata(concatBytes(withoutEndMarker, damagedTail), 'image/jpeg'),
		).toEqual(jpeg);
		expect(stripImageMetadata(withoutEndMarker, 'image/jpeg')).toEqual(jpeg);
	});

	it('drops the JFIF thumbnail, which shows the uncropped photo', () => {
		const jpeg = structuralJpeg();
		const jfifHeader = [...ascii('JFIF\0'), 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01];
		const thumbnail = [0x01, 0x01, 0xff, 0x00, 0x00]; // 1×1 pixel, red
		const segmentLength = 2 + jfifHeader.length + thumbnail.length;
		const withThumbnail = concatBytes(
			[0xff, 0xd8, 0xff, 0xe0, 0x00, segmentLength],
			jfifHeader,
			thumbnail,
			jpeg.subarray(2 + JFIF_SEGMENT_BYTES),
		);

		expect(stripImageMetadata(withThumbnail, 'image/jpeg')).toEqual(jpeg);
	});

	it('refuses a JPEG whose segments run past the end of the file', () => {
		const truncated = withPhoneMetadata(structuralJpeg(), EXIF_ORIENTATION_NORMAL).subarray(
			0,
			40,
		);

		expect(() => stripImageMetadata(truncated, 'image/jpeg')).toThrow(ImageMetadataError);
		expect(() => stripImageMetadata(Uint8Array.from(ascii('nope')), 'image/jpeg')).toThrow(
			ImageMetadataError,
		);
	});
});

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngChunk(type: string, data: readonly number[]): number[] {
	const typeAndData = Uint8Array.from([...ascii(type), ...data]);
	const bigEndian = (value: number) => [24, 16, 8, 0].map((shift) => (value >>> shift) & 0xff);
	return [...bigEndian(data.length), ...typeAndData, ...bigEndian(crc32(typeAndData))];
}

const PNG_HEADER = pngChunk('IHDR', [0, 0, 0, 16, 0, 0, 0, 16, 8, 6, 0, 0, 0]);
const PNG_COLOUR_PROFILE = pngChunk('iCCP', [...ascii('sRGB\0'), 0, 0x78, 0x9c]);
const PNG_IMAGE_DATA = pngChunk('IDAT', [0x78, 0x9c, 0x63, 0x60]);
const PNG_END = pngChunk('IEND', []);

describe('stripImageMetadata: PNG', () => {
	it('drops eXIf GPS data, text chunks with XMP and timestamps, keeping only the orientation', () => {
		const png = concatBytes(
			PNG_SIGNATURE,
			PNG_HEADER,
			pngChunk('eXIf', [...phoneTiff(EXIF_ORIENTATION_ROTATE_CLOCKWISE)]),
			pngChunk('tEXt', ascii('Comment\0Hidden comment')),
			pngChunk('iTXt', PNG_XMP_TEXT),
			pngChunk('tIME', [0x07, 0xea, 10, 23, 14, 5, 9]),
			PNG_COLOUR_PROFILE,
			PNG_IMAGE_DATA,
			PNG_END,
			ascii('Apple'),
		);

		const stripped = stripImageMetadata(png, 'image/png');

		expect(identifyingTextIn(stripped)).toEqual([]);
		expect(stripped).toEqual(
			concatBytes(
				PNG_SIGNATURE,
				PNG_HEADER,
				pngChunk('eXIf', orientationOnlyTiff(EXIF_ORIENTATION_ROTATE_CLOCKWISE)),
				PNG_COLOUR_PROFILE,
				PNG_IMAGE_DATA,
				PNG_END,
			),
		);
	});

	it('closes a PNG cut off after its image data, dropping the damaged tail', () => {
		const truncatedText = pngChunk('tEXt', ascii('Comment\0Hidden comment')).slice(0, 12);
		const png = concatBytes(PNG_SIGNATURE, PNG_HEADER, PNG_IMAGE_DATA, truncatedText);

		expect(stripImageMetadata(png, 'image/png')).toEqual(
			concatBytes(PNG_SIGNATURE, PNG_HEADER, PNG_IMAGE_DATA, PNG_END),
		);
	});

	it('refuses a PNG cut off before its image data', () => {
		const png = concatBytes(PNG_SIGNATURE, PNG_HEADER, PNG_IMAGE_DATA.slice(0, 10));

		expect(() => stripImageMetadata(png, 'image/png')).toThrow(ImageMetadataError);
	});

	it('keeps every animation chunk of an animated PNG', () => {
		const frameControl = pngChunk('fcTL', Array<number>(26).fill(0));
		const animated = concatBytes(
			PNG_SIGNATURE,
			PNG_HEADER,
			pngChunk('acTL', [0, 0, 0, 2, 0, 0, 0, 0]),
			pngChunk('tEXt', ascii('Comment\0Hidden comment')),
			frameControl,
			PNG_IMAGE_DATA,
			frameControl,
			pngChunk('fdAT', [0, 0, 0, 2, 0x78, 0x9c]),
			PNG_END,
		);

		expect(stripImageMetadata(animated, 'image/png')).toEqual(
			concatBytes(
				PNG_SIGNATURE,
				PNG_HEADER,
				pngChunk('acTL', [0, 0, 0, 2, 0, 0, 0, 0]),
				frameControl,
				PNG_IMAGE_DATA,
				frameControl,
				pngChunk('fdAT', [0, 0, 0, 2, 0x78, 0x9c]),
				PNG_END,
			),
		);
	});
});

function riffChunk(fourCc: string, data: readonly number[]): number[] {
	const littleEndian = [0, 8, 16, 24].map((shift) => (data.length >>> shift) & 0xff);
	return [...ascii(fourCc), ...littleEndian, ...data, ...(data.length % 2 === 1 ? [0] : [])];
}

function webp(...chunks: number[][]): Uint8Array<ArrayBuffer> {
	const body = [...ascii('WEBP'), ...chunks.flat()];
	const littleEndian = [0, 8, 16, 24].map((shift) => (body.length >>> shift) & 0xff);
	return Uint8Array.from([...ascii('RIFF'), ...littleEndian, ...body]);
}

const WEBP_ANIMATION = 0x02;
const WEBP_XMP = 0x04;
const WEBP_EXIF = 0x08;
const WEBP_ALPHA = 0x10;
const WEBP_COLOUR_PROFILE = 0x20;

function extendedHeader(flags: number): number[] {
	return riffChunk('VP8X', [flags, 0, 0, 0, 15, 0, 0, 15, 0, 0]);
}

describe('stripImageMetadata: WebP', () => {
	const colourProfile = riffChunk('ICCP', ascii('sRGB'));
	const losslessImage = riffChunk('VP8L', [0x2f, 0x0f, 0xc0, 0x03, 0x00]);

	it('drops EXIF GPS data and XMP, keeping the orientation and updating the header flags', () => {
		const flags = WEBP_COLOUR_PROFILE | WEBP_ALPHA | WEBP_EXIF | WEBP_XMP;
		const image = webp(
			extendedHeader(flags),
			colourProfile,
			losslessImage,
			riffChunk('EXIF', [...phoneTiff(EXIF_ORIENTATION_ROTATE_CLOCKWISE)]),
			riffChunk('XMP ', XMP_PACKET_BYTES),
		);

		const stripped = stripImageMetadata(image, 'image/webp');

		expect(identifyingTextIn(stripped)).toEqual([]);
		expect(stripped).toEqual(
			webp(
				extendedHeader(WEBP_COLOUR_PROFILE | WEBP_ALPHA | WEBP_EXIF),
				colourProfile,
				losslessImage,
				riffChunk('EXIF', orientationOnlyTiff(EXIF_ORIENTATION_ROTATE_CLOCKWISE)),
			),
		);
	});

	it('clears the EXIF flag when the image is already upright', () => {
		const image = webp(
			extendedHeader(WEBP_EXIF),
			losslessImage,
			riffChunk('EXIF', [...ascii('Exif\0\0'), ...phoneTiff(EXIF_ORIENTATION_NORMAL)]),
		);

		expect(stripImageMetadata(image, 'image/webp')).toEqual(
			webp(extendedHeader(0), losslessImage),
		);
	});

	it('keeps every frame of an animated WebP', () => {
		const animationHeader = riffChunk('ANIM', [0, 0, 0, 0, 0, 0]);
		const frame = riffChunk('ANMF', [...Array<number>(16).fill(0), ...losslessImage]);
		const animated = webp(
			extendedHeader(WEBP_ANIMATION | WEBP_XMP),
			animationHeader,
			frame,
			frame,
			riffChunk('XMP ', XMP_PACKET_BYTES),
		);

		expect(stripImageMetadata(animated, 'image/webp')).toEqual(
			webp(extendedHeader(WEBP_ANIMATION), animationHeader, frame, frame),
		);
	});

	it('drops bytes after the RIFF container', () => {
		const simple = webp(losslessImage);

		expect(stripImageMetadata(concatBytes(simple, ascii('Apple')), 'image/webp')).toEqual(
			simple,
		);
	});
});

function gifSubBlocks(data: readonly number[]): number[] {
	const blocks: number[] = [];
	for (let offset = 0; offset < data.length; offset += 255) {
		const block = data.slice(offset, offset + 255);
		blocks.push(block.length, ...block);
	}
	return [...blocks, 0];
}

function gifApplicationExtension(identifier: string, data: readonly number[]): number[] {
	return [0x21, 0xff, 0x0b, ...ascii(identifier), ...gifSubBlocks(data)];
}

describe('stripImageMetadata: GIF', () => {
	const header = [...ascii('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255];
	const graphicControl = [0x21, 0xf9, 0x04, 0x00, 0x0a, 0x00, 0x00, 0x00];
	const frame = [
		graphicControl,
		[0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00], // image descriptor
		[0x02, 0x02, 0x44, 0x01, 0x00], // LZW image data
	].flat();
	const trailer = [0x3b];

	it('drops comments and XMP, keeping the loop setting and every frame', () => {
		const loop = gifApplicationExtension('NETSCAPE2.0', [0x01, 0x00, 0x00]);
		const animated = concatBytes(
			header,
			loop,
			[0x21, 0xfe, ...gifSubBlocks(ascii('Hidden comment'))],
			gifApplicationExtension('XMP DataXMP', XMP_PACKET_BYTES),
			frame,
			frame,
			trailer,
			ascii('Apple'),
		);

		const stripped = stripImageMetadata(animated, 'image/gif');

		expect(identifyingTextIn(stripped)).toEqual([]);
		expect(stripped).toEqual(concatBytes(header, loop, frame, frame, trailer));
	});

	it('drops plain text extensions', () => {
		const plainTextGrid = [0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1];
		const plainText = [
			0x21,
			0x01,
			0x0c,
			...plainTextGrid,
			...gifSubBlocks(ascii('Hidden text')),
		];
		const gif = concatBytes(header, graphicControl, plainText, frame, trailer);

		expect(stripImageMetadata(gif, 'image/gif')).toEqual(
			concatBytes(header, graphicControl, frame, trailer),
		);
	});

	it('ends the image at a stray byte or a truncated block, as decoders do', () => {
		const expected = concatBytes(header, frame, frame, trailer);

		expect(
			stripImageMetadata(concatBytes(header, frame, frame, [0x00], trailer), 'image/gif'),
		).toEqual(expected);
		expect(
			stripImageMetadata(concatBytes(header, frame, frame, frame.slice(8, 14)), 'image/gif'),
		).toEqual(expected);
	});

	it('refuses a GIF without one complete frame', () => {
		expect(() =>
			stripImageMetadata(concatBytes(header, [0x00], frame, trailer), 'image/gif'),
		).toThrow(ImageMetadataError);
		expect(() =>
			stripImageMetadata(concatBytes(header, frame.slice(0, 12)), 'image/gif'),
		).toThrow(ImageMetadataError);
	});

	it('copies a GIF of a million tiny blocks without allocating per block', () => {
		const tinyBlockCount = 1_000_000;
		const emptyExtension = [0x21, 0xf9, 0x00];
		const gif = new Uint8Array(
			header.length + tinyBlockCount * emptyExtension.length + frame.length + trailer.length,
		);
		gif.set(header);
		for (let index = 0; index < tinyBlockCount; index += 1) {
			gif.set(emptyExtension, header.length + index * emptyExtension.length);
		}
		gif.set([...frame, ...trailer], gif.length - frame.length - trailer.length);

		const heapBefore = process.memoryUsage().heapUsed;
		const stripped = stripImageMetadata(gif, 'image/gif');
		const heapGrowth = process.memoryUsage().heapUsed - heapBefore;

		expect(Buffer.from(stripped).equals(gif)).toBe(true);
		// One object per kept block would cost on the order of 100 MB here.
		expect(heapGrowth).toBeLessThan(32 * 1024 * 1024);
	});
});
