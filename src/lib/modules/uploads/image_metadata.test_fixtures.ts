/** EXIF orientation 6: the stored pixels must turn 90° clockwise for display, as on a portrait phone shot. */
export const EXIF_ORIENTATION_ROTATE_CLOCKWISE = 6;

/** Identifying values the phone metadata fixtures embed; none may survive metadata removal. */
const IDENTIFYING_METADATA_TEXT = [
	'Apple',
	'iPhone 15 Pro',
	'2026:10:23 14:05:09',
	'serial-DNXQ12345',
	'Hidden comment',
	'Photoshop 3.0',
	'MPF\0MM',
	'ns.adobe.com/xap',
	'exif:GPSLatitude',
] as const;

const ascii = (text: string): number[] => [...new TextEncoder().encode(text)];

const TIFF_ASCII = 2;
const TIFF_SHORT = 3;
const TIFF_LONG = 4;
const TIFF_RATIONAL = 5;
const GPS_DIRECTORY_POINTER_TAG = 0x8825;

interface TiffEntry {
	tag: number;
	type: typeof TIFF_ASCII | typeof TIFF_SHORT | typeof TIFF_LONG | typeof TIFF_RATIONAL;
	/** Text for ASCII; numbers otherwise, rationals as numerator/denominator pairs. */
	value: string | number[];
}

/** Prague Castle, as a phone writes it: degrees, minutes and seconds rationals. */
const GPS_DIRECTORY: TiffEntry[] = [
	{ tag: 0x0001, type: TIFF_ASCII, value: 'N' },
	{ tag: 0x0002, type: TIFF_RATIONAL, value: [50, 1, 5, 1, 4_920, 100] },
	{ tag: 0x0003, type: TIFF_ASCII, value: 'E' },
	{ tag: 0x0004, type: TIFF_RATIONAL, value: [14, 1, 24, 1, 1_080, 100] },
];

function phoneMainDirectory(orientation: number, gpsDirectoryOffset: number): TiffEntry[] {
	return [
		{ tag: 0x010f, type: TIFF_ASCII, value: 'Apple' },
		{ tag: 0x0110, type: TIFF_ASCII, value: 'iPhone 15 Pro' },
		{ tag: 0x0112, type: TIFF_SHORT, value: [orientation] },
		{ tag: 0x0132, type: TIFF_ASCII, value: '2026:10:23 14:05:09' },
		{ tag: 0xa431, type: TIFF_ASCII, value: 'serial-DNXQ12345' },
		{ tag: GPS_DIRECTORY_POINTER_TAG, type: TIFF_LONG, value: [gpsDirectoryOffset] },
	];
}

function littleEndian(value: number, width: number): number[] {
	return Array.from({ length: width }, (_, index) => (value >>> (index * 8)) & 0xff);
}

function tiffValueBytes(entry: TiffEntry): number[] {
	if (typeof entry.value === 'string') {
		return [...ascii(entry.value), 0];
	}
	const width = entry.type === TIFF_SHORT ? 2 : 4;
	return entry.value.flatMap((number) => littleEndian(number, width));
}

function tiffCount(entry: TiffEntry): number {
	if (typeof entry.value === 'string') {
		return entry.value.length + 1;
	}
	return entry.type === TIFF_RATIONAL ? entry.value.length / 2 : entry.value.length;
}

const directoryBytes = (entryCount: number) => 2 + entryCount * 12 + 4;

/**
 * A little-endian TIFF block as iPhones write it: the main directory names the
 * camera, its serial, the time and the orientation, and points at a GPS
 * directory; values longer than four bytes follow both directories.
 */
export function phoneTiff(orientation: number): Uint8Array<ArrayBuffer> {
	const mainDirectoryOffset = 8;
	const gpsDirectoryOffset =
		mainDirectoryOffset + directoryBytes(phoneMainDirectory(orientation, 0).length);
	const directories = [phoneMainDirectory(orientation, gpsDirectoryOffset), GPS_DIRECTORY];
	let dataOffset = gpsDirectoryOffset + directoryBytes(GPS_DIRECTORY.length);

	const directoryData: number[] = [];
	const valueData: number[] = [];
	for (const entries of directories) {
		directoryData.push(...littleEndian(entries.length, 2));
		for (const entry of entries) {
			const valueBytes = tiffValueBytes(entry);
			directoryData.push(
				...littleEndian(entry.tag, 2),
				...littleEndian(entry.type, 2),
				...littleEndian(tiffCount(entry), 4),
			);
			if (valueBytes.length <= 4) {
				directoryData.push(...valueBytes, ...Array<number>(4 - valueBytes.length).fill(0));
			} else {
				directoryData.push(...littleEndian(dataOffset, 4));
				valueData.push(...valueBytes);
				dataOffset += valueBytes.length;
			}
		}
		directoryData.push(...littleEndian(0, 4));
	}
	return Uint8Array.from([
		0x49,
		0x49,
		0x2a,
		0x00,
		...littleEndian(mainDirectoryOffset, 4),
		...directoryData,
		...valueData,
	]);
}

/** The minimal big-endian TIFF block a stripped image keeps: the orientation and nothing else. */
export function orientationOnlyTiff(orientation: number): number[] {
	return [
		[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // "MM", 42, first directory at 8
		[0x00, 0x01], // one entry
		[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01], // Orientation, SHORT, count 1
		[0x00, orientation, 0x00, 0x00], // value, padded
		[0x00, 0x00, 0x00, 0x00], // no next directory
	].flat();
}

const XMP_PACKET =
	'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description exif:GPSLatitude="50,5.82N"/></rdf:RDF></x:xmpmeta>';

/** An XMP packet as a PNG `iTXt` chunk carries it. */
export const PNG_XMP_TEXT = ascii(`XML:com.adobe.xmp\0\0\0\0\0${XMP_PACKET}`);

/** An XMP packet as a WebP `XMP ` chunk or a GIF application extension carries it. */
export const XMP_PACKET_BYTES = ascii(`ns.adobe.com/xap ${XMP_PACKET}`);

export function concatBytes(...parts: (readonly number[] | Uint8Array)[]): Uint8Array<ArrayBuffer> {
	const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		output.set(part, offset);
		offset += part.length;
	}
	return output;
}

function jpegSegment(marker: number, payload: readonly number[] | Uint8Array): number[] {
	const length = payload.length + 2;
	return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

/**
 * A structurally complete 16×16 progressive-style JPEG without metadata: JFIF,
 * an ICC profile and Adobe's colour-transform segment (all three must survive
 * metadata removal), and two scans whose entropy-coded data holds an escaped
 * 0xFF byte, a restart marker and fill bytes. Not decodable; for byte-level tests.
 */
export function structuralJpeg(): Uint8Array<ArrayBuffer> {
	const huffmanTable = jpegSegment(0xc4, [0x00, ...Array<number>(16).fill(0)]);
	const startOfScan = jpegSegment(0xda, [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
	return concatBytes(
		[0xff, 0xd8],
		jpegSegment(0xe0, [
			...ascii('JFIF\0'),
			0x01,
			0x01,
			0x00,
			0x00,
			0x01,
			0x00,
			0x01,
			0x00,
			0x00,
		]),
		jpegSegment(0xe2, [...ascii('ICC_PROFILE\0'), 0x01, 0x01, ...ascii('sRGB profile')]),
		jpegSegment(0xee, [...ascii('Adobe'), 0x00, 0x64, 0x00, 0x00, 0x00, 0x00, 0x01]),
		jpegSegment(0xdb, [0x00, ...Array<number>(64).fill(1)]),
		jpegSegment(0xc2, [0x08, 0x00, 0x10, 0x00, 0x10, 0x01, 0x01, 0x11, 0x00]),
		huffmanTable,
		startOfScan,
		[0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56],
		huffmanTable,
		startOfScan,
		[0x78, 0xff, 0x00, 0x9a, 0xff, 0xff],
		[0xff, 0xd9],
	);
}

function assertJpeg(jpegBytes: Uint8Array): void {
	if (jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
		throw new Error('Not a JPEG');
	}
}

/**
 * Returns a copy of a JPEG with a minimal EXIF segment carrying `orientation`,
 * inserted right after the start-of-image marker, the way cameras store it.
 */
export function withExifOrientation(
	jpegBytes: Uint8Array,
	orientation: number,
): Uint8Array<ArrayBuffer> {
	assertJpeg(jpegBytes);
	return concatBytes(
		jpegBytes.subarray(0, 2),
		jpegSegment(0xe1, [...ascii('Exif\0\0'), ...orientationOnlyTiff(orientation)]),
		jpegBytes.subarray(2),
	);
}

/**
 * Returns a copy of a JPEG dressed like a phone photo: EXIF with the camera,
 * its serial, the time, GPS and `orientation`; an XMP packet with the
 * location; an MPF index, IPTC and a comment; and a preview JPEG appended
 * after the image with its own GPS EXIF. Removing every piece of metadata must
 * give exactly `withExifOrientation(jpegBytes, orientation)`.
 */
export function withPhoneMetadata(
	jpegBytes: Uint8Array,
	orientation: number,
): Uint8Array<ArrayBuffer> {
	assertJpeg(jpegBytes);
	const exif = jpegSegment(0xe1, [...ascii('Exif\0\0'), ...phoneTiff(orientation)]);
	const appendedPreview = [0xff, 0xd8, ...exif, 0xff, 0xd9];
	return concatBytes(
		jpegBytes.subarray(0, 2),
		exif,
		jpegSegment(0xe1, ascii(`http://ns.adobe.com/xap/1.0/\0${XMP_PACKET}`)),
		jpegSegment(0xe2, ascii('MPF\0MM\0*')),
		jpegSegment(0xed, ascii('Photoshop 3.0\u00008BIM')),
		jpegSegment(0xfe, ascii('Hidden comment')),
		jpegBytes.subarray(2),
		appendedPreview,
	);
}

function containsText(bytes: Uint8Array, text: string): boolean {
	const needle = ascii(text);
	for (let start = 0; start + needle.length <= bytes.length; start += 1) {
		if (needle.every((value, index) => bytes[start + index] === value)) {
			return true;
		}
	}
	return false;
}

/** Which of {@link IDENTIFYING_METADATA_TEXT} the bytes still contain. */
export function identifyingTextIn(bytes: Uint8Array): string[] {
	return IDENTIFYING_METADATA_TEXT.filter((text) => containsText(bytes, text));
}
