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
	it('drops comments and XMP, keeping the loop setting and every frame', () => {
		const header = [...ascii('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255];
		const loop = gifApplicationExtension('NETSCAPE2.0', [0x01, 0x00, 0x00]);
		const frame = [
			[0x21, 0xf9, 0x04, 0x00, 0x0a, 0x00, 0x00, 0x00], // graphic control extension
			[0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00], // image descriptor
			[0x02, 0x02, 0x44, 0x01, 0x00], // LZW image data
		].flat();
		const animated = concatBytes(
			header,
			loop,
			[0x21, 0xfe, ...gifSubBlocks(ascii('Hidden comment'))],
			gifApplicationExtension('XMP DataXMP', XMP_PACKET_BYTES),
			frame,
			frame,
			[0x3b],
			ascii('Apple'),
		);

		const stripped = stripImageMetadata(animated, 'image/gif');

		expect(identifyingTextIn(stripped)).toEqual([]);
		expect(stripped).toEqual(concatBytes(header, loop, frame, frame, [0x3b]));
	});
});
