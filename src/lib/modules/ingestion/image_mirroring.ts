import type { LookupFunction } from 'node:net';
import {
	ALLOWED_CONTENT_TYPES,
	IMAGE_FILE_EXTENSIONS,
	MAX_GIFT_IMAGE_BYTES,
	type AllowedContentType,
} from '$lib/modules/uploads/types.js';
import {
	IMAGE_DOWNLOAD_FAILURE,
	ImageDownloadError,
	downloadImage,
	type DownloadedImage,
	type ImageDownloadLimits,
} from '$lib/server/images/image_download.js';

const MAX_INGESTION_IMAGE_BYTES = MAX_GIFT_IMAGE_BYTES;
export const SUPPORTED_INGESTION_IMAGE_TYPES = ALLOWED_CONTENT_TYPES;
export type IngestionImageContentType = AllowedContentType;

interface DownloadDependencies extends ImageDownloadLimits {
	/** Injected fetch is an explicit test/system boundary and is not DNS-pinned. */
	fetch?: typeof fetch;
	resolve?: (hostname: string) => Promise<string[]>;
	request?: (url: URL, address: string, signal: AbortSignal) => Promise<Response>;
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
		throw new ImageDownloadError(
			IMAGE_DOWNLOAD_FAILURE.invalidUrl,
			'Unsafe image URL: HTTPS without credentials is required',
		);
	}
	const address = (await resolve(url.hostname)).find((candidate) => !isUnsafeIp(candidate));
	if (address === undefined) {
		throw new ImageDownloadError(
			IMAGE_DOWNLOAD_FAILURE.blockedHost,
			'Unsafe image destination resolved without a public address',
		);
	}
	return address;
}

function createPinnedLookup(address: string): LookupFunction {
	return (_hostname, options, callback) => {
		const family = address.includes(':') ? 6 : 4;
		const all = options.all === true;
		callback(null, all ? [{ address, family }] : address, all ? undefined : family);
	};
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
				lookup: createPinnedLookup(address),
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

/**
 * Downloads an image for the ingestion CLI: every hop's host must resolve to a public address,
 * and the request is pinned to that address so DNS cannot change between check and request.
 */
export async function downloadValidatedImage(
	source: string,
	dependencies: DownloadDependencies = {},
): Promise<DownloadedImage> {
	const requestFetch = dependencies.fetch;
	const request = dependencies.request ?? pinnedHttpsRequest;
	const resolve = dependencies.resolve ?? defaultResolve;
	return downloadImage(
		source,
		async (url, signal) => {
			const address = await validatedAddress(url, resolve);
			return requestFetch === undefined
				? request(url, address, signal)
				: requestFetch(url, { redirect: 'manual', signal });
		},
		{
			timeoutMs: dependencies.timeoutMs,
			maxBytes: dependencies.maxBytes ?? MAX_INGESTION_IMAGE_BYTES,
			maxRedirects: dependencies.maxRedirects,
		},
	);
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
	const extension = IMAGE_FILE_EXTENSIONS[input.contentType];
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
