import {
	ALLOWED_CONTENT_TYPES,
	MAX_GIFT_IMAGE_BYTES,
	type AllowedContentType,
} from '$lib/modules/uploads/types.js';

const MAX_INGESTION_IMAGE_BYTES = MAX_GIFT_IMAGE_BYTES;
export const SUPPORTED_INGESTION_IMAGE_TYPES = ALLOWED_CONTENT_TYPES;
export type IngestionImageContentType = AllowedContentType;

export interface DownloadedImage {
	bytes: Uint8Array;
	contentType: IngestionImageContentType;
	byteLength: number;
	width: number;
	height: number;
	sha256: string;
	finalUrl: string;
}

interface DownloadDependencies {
	/** Injected fetch is an explicit test/system boundary and is not DNS-pinned. */
	fetch?: typeof fetch;
	resolve?: (hostname: string) => Promise<string[]>;
	request?: (url: URL, address: string, signal: AbortSignal) => Promise<Response>;
	timeoutMs?: number;
	maxBytes?: number;
	maxRedirects?: number;
}

function parseIpv4(address: string): number[] | null {
	const parts = address.split('.');
	if (parts.length !== 4) {
		return null;
	}
	const bytes = parts.map(Number);
	return bytes.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? bytes : null;
}

function parseIpv6(address: string): number[] | null {
	let normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
	if (normalized.includes('%')) {
		return null;
	}
	if (normalized.includes('.')) {
		const lastColon = normalized.lastIndexOf(':');
		const ipv4 = parseIpv4(normalized.slice(lastColon + 1));
		if (lastColon < 0 || ipv4 === null) {
			return null;
		}
		normalized = `${normalized.slice(0, lastColon + 1)}${((ipv4[0]! << 8) | ipv4[1]!).toString(16)}:${((ipv4[2]! << 8) | ipv4[3]!).toString(16)}`;
	}
	if ((normalized.match(/::/g) ?? []).length > 1) {
		return null;
	}
	const [left = '', right] = normalized.split('::');
	const leftGroups = left === '' ? [] : left.split(':');
	const rightGroups = right === undefined || right === '' ? [] : right.split(':');
	const missing = 8 - leftGroups.length - rightGroups.length;
	if ((right === undefined && missing !== 0) || (right !== undefined && missing < 1)) {
		return null;
	}
	const groups = [...leftGroups, ...Array.from({ length: missing }, () => '0'), ...rightGroups];
	if (groups.length !== 8 || groups.some((group) => !/^[a-f0-9]{1,4}$/.test(group))) {
		return null;
	}
	return groups.flatMap((group) => {
		const value = Number.parseInt(group, 16);
		return [value >>> 8, value & 0xff];
	});
}

function isUnsafeIpv4([a, b, c]: readonly number[]): boolean {
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b! >= 64 && b! <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b! >= 16 && b! <= 31) ||
		(a === 192 && b === 0 && c === 0) ||
		(a === 192 && b === 0 && c === 2) ||
		(a === 192 && b === 88 && c === 99) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		(a === 198 && b === 51 && c === 100) ||
		(a === 203 && b === 0 && c === 113) ||
		a! >= 224
	);
}

function isUnsafeIp(address: string): boolean {
	const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
	const ipv4 = parseIpv4(normalized);
	if (ipv4 !== null) {
		return isUnsafeIpv4(ipv4);
	}
	const ipv6 = parseIpv6(normalized);
	if (ipv6 === null) {
		return true;
	}
	if (ipv6.slice(0, 10).every((byte) => byte === 0) && ipv6[10] === 0xff && ipv6[11] === 0xff) {
		return isUnsafeIpv4(ipv6.slice(12));
	}
	if (ipv6.slice(0, 12).every((byte) => byte === 0)) {
		return true;
	}
	if (ipv6[0]! < 0x20 || ipv6[0]! > 0x3f) {
		return true;
	}
	return (
		(ipv6[0] === 0x20 && ipv6[1] === 0x01 && ipv6[2] === 0x0d && ipv6[3] === 0xb8) ||
		(ipv6[0] === 0x20 && ipv6[1] === 0x02)
	);
}

async function defaultResolve(hostname: string): Promise<string[]> {
	const { lookup } = await import('node:dns/promises');
	return (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address);
}

async function validatedAddress(
	url: URL,
	resolve: (hostname: string) => Promise<string[]>,
): Promise<string> {
	if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
		throw new Error('Unsafe image URL: HTTPS without credentials is required');
	}
	const address = (await resolve(url.hostname)).find((candidate) => !isUnsafeIp(candidate));
	if (address === undefined) {
		throw new Error('Unsafe image destination resolved without a public address');
	}
	return address;
}

async function pinnedHttpsRequest(
	url: URL,
	address: string,
	signal: AbortSignal,
): Promise<Response> {
	const [{ request }, { Readable }] = await Promise.all([
		import('node:https'),
		import('node:stream'),
	]);
	return new Promise((resolve, reject) => {
		const outgoing = request(
			url,
			{
				signal,
				servername: url.hostname,
				headers: { host: url.host },
				lookup: (_hostname, _options, callback) => {
					callback(null, address, address.includes(':') ? 6 : 4);
				},
			},
			(incoming) => {
				const headers = new Headers();
				for (const [name, value] of Object.entries(incoming.headers)) {
					for (const entry of Array.isArray(value)
						? value
						: value === undefined
							? []
							: [value]) {
						headers.append(name, entry);
					}
				}
				resolve(
					new Response(Readable.toWeb(incoming) as ReadableStream<Uint8Array>, {
						status: incoming.statusCode ?? 500,
						headers,
					}),
				);
			},
		);
		outgoing.on('error', reject);
		outgoing.end();
	});
}

function actualImage(bytes: Uint8Array): {
	contentType: IngestionImageContentType;
	width: number;
	height: number;
} {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (
		bytes.length >= 24 &&
		[137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)
	) {
		return { contentType: 'image/png', width: view.getUint32(16), height: view.getUint32(20) };
	}
	if (bytes.length >= 10 && String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/)) {
		return {
			contentType: 'image/gif',
			width: view.getUint16(6, true),
			height: view.getUint16(8, true),
		};
	}
	if (
		bytes.length >= 30 &&
		String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
		String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
	) {
		const kind = String.fromCharCode(...bytes.slice(12, 16));
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
	}
	if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
		let offset = 2;
		while (offset + 9 < bytes.length) {
			if (bytes[offset] !== 0xff) {
				offset += 1;
				continue;
			}
			const marker = bytes[offset + 1]!;
			if (
				[
					0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
				].includes(marker)
			) {
				return {
					contentType: 'image/jpeg',
					height: view.getUint16(offset + 5),
					width: view.getUint16(offset + 7),
				};
			}
			if (offset + 4 > bytes.length) {
				break;
			}
			const length = view.getUint16(offset + 2);
			if (length < 2) {
				break;
			}
			offset += 2 + length;
		}
	}
	throw new Error('Unsupported or invalid actual image signature');
}

async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
	const declared = Number(response.headers.get('content-length') ?? '0');
	if (declared > maxBytes) {
		throw new Error('Image size exceeds maximum');
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
			throw new Error('Image size exceeds maximum');
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

export async function downloadValidatedImage(
	source: string,
	dependencies: DownloadDependencies = {},
): Promise<DownloadedImage> {
	const requestFetch = dependencies.fetch;
	const request = dependencies.request ?? pinnedHttpsRequest;
	const resolve = dependencies.resolve ?? defaultResolve;
	const timeoutMs = dependencies.timeoutMs ?? 15_000;
	const maxBytes = dependencies.maxBytes ?? MAX_INGESTION_IMAGE_BYTES;
	const maxRedirects = dependencies.maxRedirects ?? 5;
	let current = new URL(source);
	for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
		const address = await validatedAddress(current, resolve);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response =
				requestFetch === undefined
					? await request(current, address, controller.signal)
					: await requestFetch(current, {
							redirect: 'manual',
							signal: controller.signal,
						});
			if ([301, 302, 303, 307, 308].includes(response.status)) {
				const location = response.headers.get('location');
				if (location === null || redirects === maxRedirects) {
					throw new Error('Unsafe image redirect chain');
				}
				current = new URL(location, current);
				continue;
			}
			if (!response.ok) {
				throw new Error(`Image download failed with HTTP ${response.status}`);
			}
			const declared = response.headers
				.get('content-type')
				?.split(';')[0]
				?.trim()
				.toLowerCase();
			if (!SUPPORTED_INGESTION_IMAGE_TYPES.includes(declared as IngestionImageContentType)) {
				throw new Error('Unsupported declared image MIME type');
			}
			const bytes = await readBounded(response, maxBytes);
			const actual = actualImage(bytes);
			if (actual.contentType !== declared) {
				throw new Error('Declared and actual image MIME types disagree');
			}
			if (actual.width <= 0 || actual.height <= 0) {
				throw new Error('Image dimensions must be positive');
			}
			const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
			return {
				bytes,
				...actual,
				byteLength: bytes.length,
				sha256: [...new Uint8Array(digest)]
					.map((byte) => byte.toString(16).padStart(2, '0'))
					.join(''),
				finalUrl: current.toString(),
			};
		} finally {
			clearTimeout(timer);
		}
	}
	throw new Error('Unsafe image redirect chain');
}

function safeSegment(value: string): string {
	return encodeURIComponent(value).replaceAll('%', '_');
}

export interface PreparedImageBinding {
	wishlistId: string;
	manifestId: string;
	itemId: string;
	sha256: string;
	contentType: IngestionImageContentType;
	byteLength: number;
}

export function imageObjectKey(input: PreparedImageBinding): string {
	const extension = {
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp',
		'image/gif': 'gif',
	}[input.contentType];
	return `gifts/ingestion/${safeSegment(input.wishlistId)}/${safeSegment(input.manifestId)}/${safeSegment(input.itemId)}/${input.sha256}.${extension}`;
}

export function validatePreparedImageReference(
	reference: PreparedImageBinding & { key: string },
): void {
	if (
		!/^[a-f0-9]{64}$/.test(reference.sha256) ||
		reference.byteLength <= 0 ||
		reference.byteLength > MAX_INGESTION_IMAGE_BYTES ||
		reference.key !== imageObjectKey(reference)
	) {
		throw new Error('Prepared image key binding is invalid');
	}
}
