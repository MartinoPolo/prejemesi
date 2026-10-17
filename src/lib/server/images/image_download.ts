import {
	ALLOWED_CONTENT_TYPES,
	MAX_GIFT_IMAGE_BYTES,
	type AllowedContentType,
} from '$lib/modules/uploads/types.js';

/** Why downloading an image failed; each reason is a distinct API error. */
export const IMAGE_DOWNLOAD_FAILURE = {
	/** Not an HTTPS URL, or one carrying credentials. */
	invalidUrl: 'invalidUrl',
	/** A destination that may be private: an IP literal, a local name or another port. */
	blockedHost: 'blockedHost',
	tooLarge: 'tooLarge',
	/** The server declared a type other than JPEG, PNG, WebP or GIF. */
	unsupportedType: 'unsupportedType',
	/** The bytes are not an image of the declared type. */
	signatureMismatch: 'signatureMismatch',
	invalidDimensions: 'invalidDimensions',
	/** The server failed, timed out, redirected too often or answered an error status. */
	fetchFailed: 'fetchFailed',
} as const;

export type ImageDownloadFailure =
	(typeof IMAGE_DOWNLOAD_FAILURE)[keyof typeof IMAGE_DOWNLOAD_FAILURE];

export class ImageDownloadError extends Error {
	constructor(
		readonly reason: ImageDownloadFailure,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

export interface DownloadedImage {
	bytes: Uint8Array;
	contentType: AllowedContentType;
	byteLength: number;
	width: number;
	height: number;
	sha256: string;
	finalUrl: string;
}

/** Validates one hop's URL and requests it without following redirects. */
export type ImageHopRequest = (url: URL, signal: AbortSignal) => Promise<Response>;

export interface ImageDownloadLimits {
	timeoutMs?: number;
	maxBytes?: number;
	maxRedirects?: number;
}

/** Per request; a redirect is a new request. */
export const DEFAULT_IMAGE_DOWNLOAD_TIMEOUT_MS = 15_000;
export const DEFAULT_IMAGE_MAX_REDIRECTS = 5;
/** Larger images exceed what a gift card or a later resize needs, and decoding them is costly. */
export const MAX_IMAGE_SIDE_PX = 10_000;
export const MAX_IMAGE_PIXELS = 50_000_000;

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

interface ImageHeader {
	contentType: AllowedContentType;
	width: number;
	height: number;
}

type ImageHeaderParser = (bytes: Uint8Array, view: DataView) => ImageHeader | null;

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const JPEG_START_OF_FRAME_MARKERS = [
	0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
];

function asciiText(bytes: Uint8Array, start: number, end: number): string {
	return String.fromCharCode(...bytes.slice(start, end));
}

function pngHeader(bytes: Uint8Array, view: DataView): ImageHeader | null {
	if (bytes.length < 24 || !PNG_SIGNATURE.every((value, i) => bytes[i] === value)) {
		return null;
	}
	return { contentType: 'image/png', width: view.getUint32(16), height: view.getUint32(20) };
}

function gifHeader(bytes: Uint8Array, view: DataView): ImageHeader | null {
	if (bytes.length < 10 || !/^GIF8[79]a$/.test(asciiText(bytes, 0, 6))) {
		return null;
	}
	return {
		contentType: 'image/gif',
		width: view.getUint16(6, true),
		height: view.getUint16(8, true),
	};
}

function webpHeader(bytes: Uint8Array, view: DataView): ImageHeader | null {
	if (
		bytes.length < 30 ||
		asciiText(bytes, 0, 4) !== 'RIFF' ||
		asciiText(bytes, 8, 12) !== 'WEBP'
	) {
		return null;
	}
	const kind = asciiText(bytes, 12, 16);
	if (kind === 'VP8X') {
		return {
			contentType: 'image/webp',
			width: 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16),
			height: 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16),
		};
	}
	if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
		return {
			contentType: 'image/webp',
			width: view.getUint16(26, true) & 0x3fff,
			height: view.getUint16(28, true) & 0x3fff,
		};
	}
	if (kind === 'VP8L' && bytes[20] === 0x2f) {
		const bits = view.getUint32(21, true);
		return {
			contentType: 'image/webp',
			width: (bits & 0x3fff) + 1,
			height: ((bits >>> 14) & 0x3fff) + 1,
		};
	}
	return null;
}

/** Walks the JPEG segments up to the first start-of-frame, which carries the dimensions. */
function jpegHeader(bytes: Uint8Array, view: DataView): ImageHeader | null {
	if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
		return null;
	}
	let offset = 2;
	while (offset + 9 < bytes.length) {
		if (bytes[offset] !== 0xff) {
			offset += 1;
			continue;
		}
		if (JPEG_START_OF_FRAME_MARKERS.includes(bytes[offset + 1]!)) {
			return {
				contentType: 'image/jpeg',
				height: view.getUint16(offset + 5),
				width: view.getUint16(offset + 7),
			};
		}
		const length = view.getUint16(offset + 2);
		if (length < 2) {
			return null;
		}
		offset += 2 + length;
	}
	return null;
}

const IMAGE_HEADER_PARSERS: ImageHeaderParser[] = [pngHeader, gifHeader, webpHeader, jpegHeader];

function actualImage(bytes: Uint8Array): ImageHeader {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	for (const parseHeader of IMAGE_HEADER_PARSERS) {
		const header = parseHeader(bytes, view);
		if (header !== null) {
			return header;
		}
	}
	throw new ImageDownloadError(
		IMAGE_DOWNLOAD_FAILURE.signatureMismatch,
		'Unsupported or invalid actual image signature',
	);
}

function tooLarge(): ImageDownloadError {
	return new ImageDownloadError(IMAGE_DOWNLOAD_FAILURE.tooLarge, 'Image size exceeds maximum');
}

async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
	const declared = Number(response.headers.get('content-length') ?? '0');
	if (declared > maxBytes) {
		throw tooLarge();
	}
	if (response.body === null) {
		return new Uint8Array();
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel();
			throw tooLarge();
		}
		chunks.push(value);
	}
	const output = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.length;
	}
	return output;
}

function isAllowedImageType(value: string | undefined): value is AllowedContentType {
	return ALLOWED_CONTENT_TYPES.some((allowed) => allowed === value);
}

async function validatedImage(response: Response, maxBytes: number) {
	const declared = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
	if (!isAllowedImageType(declared)) {
		throw new ImageDownloadError(
			IMAGE_DOWNLOAD_FAILURE.unsupportedType,
			'Unsupported declared image MIME type',
		);
	}
	const bytes = await readBounded(response, maxBytes);
	const actual = actualImage(bytes);
	if (actual.contentType !== declared) {
		throw new ImageDownloadError(
			IMAGE_DOWNLOAD_FAILURE.signatureMismatch,
			'Declared and actual image MIME types disagree',
		);
	}
	if (
		actual.width <= 0 ||
		actual.height <= 0 ||
		actual.width > MAX_IMAGE_SIDE_PX ||
		actual.height > MAX_IMAGE_SIDE_PX ||
		actual.width * actual.height > MAX_IMAGE_PIXELS
	) {
		throw new ImageDownloadError(
			IMAGE_DOWNLOAD_FAILURE.invalidDimensions,
			`Image dimensions must be positive, at most ${MAX_IMAGE_SIDE_PX} px per side and ${MAX_IMAGE_PIXELS} pixels`,
		);
	}
	return { bytes, ...actual };
}

function unsafeRedirectChain(): ImageDownloadError {
	return new ImageDownloadError(
		IMAGE_DOWNLOAD_FAILURE.fetchFailed,
		'Unsafe image redirect chain',
	);
}

function parseUrl(value: string, base?: URL): URL {
	try {
		return new URL(value, base);
	} catch {
		throw new ImageDownloadError(IMAGE_DOWNLOAD_FAILURE.invalidUrl, 'Invalid image URL');
	}
}

interface ImageHop {
	url: URL;
	requestHop: ImageHopRequest;
	timeoutMs: number;
	maxBytes: number;
	/** No further redirect may be followed from this hop. */
	isLastAllowedHop: boolean;
}

type ImageHopOutcome = { redirectTarget: URL } | { image: DownloadedImage };

/** The next URL when the response redirects, or `null` when it does not. */
async function redirectTarget(response: Response, hop: ImageHop): Promise<URL | null> {
	if (!REDIRECT_STATUSES.includes(response.status)) {
		return null;
	}
	await response.body?.cancel();
	const location = response.headers.get('location');
	if (location === null || hop.isLastAllowedHop) {
		throw unsafeRedirectChain();
	}
	return parseUrl(location, hop.url);
}

async function assertSuccessfulResponse(response: Response): Promise<void> {
	if (response.ok) {
		return;
	}
	await response.body?.cancel();
	throw new ImageDownloadError(
		IMAGE_DOWNLOAD_FAILURE.fetchFailed,
		`Image download failed with HTTP ${response.status}`,
	);
}

async function downloadedImage(response: Response, hop: ImageHop): Promise<DownloadedImage> {
	const image = await validatedImage(response, hop.maxBytes);
	const digest = await crypto.subtle.digest('SHA-256', image.bytes.slice().buffer);
	return {
		...image,
		byteLength: image.bytes.length,
		sha256: [...new Uint8Array(digest)]
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join(''),
		finalUrl: hop.url.toString(),
	};
}

function asImageDownloadError(thrown: unknown): ImageDownloadError {
	if (thrown instanceof ImageDownloadError) {
		return thrown;
	}
	// The ingestion CLI reports only the message, so it carries the cause's.
	const causeMessage = thrown instanceof Error ? thrown.message : String(thrown);
	return new ImageDownloadError(
		IMAGE_DOWNLOAD_FAILURE.fetchFailed,
		`Image download failed: ${causeMessage}`,
		{ cause: thrown },
	);
}

/** Requests one hop; the timeout covers the request and reading the body. */
async function downloadHop(hop: ImageHop): Promise<ImageHopOutcome> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), hop.timeoutMs);
	try {
		const response = await hop.requestHop(hop.url, controller.signal);
		const nextUrl = await redirectTarget(response, hop);
		if (nextUrl !== null) {
			return { redirectTarget: nextUrl };
		}
		await assertSuccessfulResponse(response);
		return { image: await downloadedImage(response, hop) };
	} catch (thrown) {
		throw asImageDownloadError(thrown);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Downloads an image hop by hop: `requestHop` validates every URL, the first and each redirect
 * target, before requesting it. The redirect count is capped, the body read is capped at
 * `maxBytes`, the declared type and the byte signature must agree, and the dimensions must be
 * positive and within {@link MAX_IMAGE_SIDE_PX} and {@link MAX_IMAGE_PIXELS}.
 */
export async function downloadImage(
	source: string,
	requestHop: ImageHopRequest,
	limits: ImageDownloadLimits = {},
): Promise<DownloadedImage> {
	const timeoutMs = limits.timeoutMs ?? DEFAULT_IMAGE_DOWNLOAD_TIMEOUT_MS;
	const maxBytes = limits.maxBytes ?? MAX_GIFT_IMAGE_BYTES;
	const maxRedirects = limits.maxRedirects ?? DEFAULT_IMAGE_MAX_REDIRECTS;
	let url = parseUrl(source);
	for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
		const outcome = await downloadHop({
			url,
			requestHop,
			timeoutMs,
			maxBytes,
			isLastAllowedHop: redirects === maxRedirects,
		});
		if ('image' in outcome) {
			return outcome.image;
		}
		url = outcome.redirectTarget;
	}
	throw unsafeRedirectChain();
}

/** Names that never resolve to a public server; `.localhost` covers `localhost` itself. */
const LOCAL_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

/**
 * An HTTPS URL on the default port whose host is a public DNS name. IP literals are refused
 * outright, so no private, loopback or metadata address can be named directly; a name's DNS
 * answer is not determinable here, where the platform's own fetch resolves it.
 */
function assertPublicHttpsImageUrl(url: URL): void {
	if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
		throw new ImageDownloadError(
			IMAGE_DOWNLOAD_FAILURE.invalidUrl,
			'Unsafe image URL: HTTPS without credentials is required',
		);
	}
	const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
	const isIpLiteral = hostname.startsWith('[') || /^[\d.]+$/.test(hostname);
	const isLocalName =
		!hostname.includes('.') ||
		LOCAL_HOSTNAME_SUFFIXES.some((suffix) => `.${hostname}`.endsWith(suffix));
	if (url.port !== '' || isIpLiteral || isLocalName) {
		throw new ImageDownloadError(
			IMAGE_DOWNLOAD_FAILURE.blockedHost,
			'Unsafe image destination: a public host name on the default HTTPS port is required',
		);
	}
}

const IMAGE_ACCEPT_HEADER = ALLOWED_CONTENT_TYPES.join(',');

export type ImageFetch = (url: URL, init: RequestInit) => Promise<Response>;

/**
 * Downloads an image with the platform's `fetch`, as the Workers runtime allows: every hop must
 * pass {@link assertPublicHttpsImageUrl} before it is requested, and redirects are followed
 * manually so each target is checked too.
 */
export async function fetchPublicImage(
	source: string,
	dependencies: ImageDownloadLimits & { fetch: ImageFetch },
): Promise<DownloadedImage> {
	const { fetch: requestFetch, ...limits } = dependencies;
	return downloadImage(
		source,
		async (url, signal) => {
			assertPublicHttpsImageUrl(url);
			return requestFetch(url, {
				redirect: 'manual',
				signal,
				headers: { accept: IMAGE_ACCEPT_HEADER },
			});
		},
		limits,
	);
}
