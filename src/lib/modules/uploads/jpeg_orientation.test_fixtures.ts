/** EXIF orientation 6: the stored pixels must turn 90° clockwise for display, as on a portrait phone shot. */
export const EXIF_ORIENTATION_ROTATE_CLOCKWISE = 6;

/**
 * Returns a copy of a JPEG with a minimal EXIF segment carrying `orientation`,
 * inserted right after the start-of-image marker, the way cameras store it.
 */
export function withExifOrientation(
	jpegBytes: Uint8Array,
	orientation: number,
): Uint8Array<ArrayBuffer> {
	if (jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
		throw new Error('Not a JPEG');
	}
	const exifPayload = [
		[0x45, 0x78, 0x69, 0x66, 0x00, 0x00], // "Exif\0\0"
		[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // big-endian TIFF header, IFD at 8
		[0x00, 0x01], // one IFD entry
		[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01], // Orientation, SHORT, count 1
		[0x00, orientation, 0x00, 0x00], // value, padded
		[0x00, 0x00, 0x00, 0x00], // no next IFD
	].flat();
	const segmentLength = exifPayload.length + 2;
	const segment = [0xff, 0xe1, segmentLength >> 8, segmentLength & 0xff, ...exifPayload];

	const result = new Uint8Array(jpegBytes.length + segment.length);
	result.set(jpegBytes.subarray(0, 2), 0);
	result.set(segment, 2);
	result.set(jpegBytes.subarray(2), 2 + segment.length);
	return result;
}
