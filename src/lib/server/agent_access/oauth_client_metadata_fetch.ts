import { isPublicHttpsUrl } from '$lib/server/network/public_https_url.js';

/** What the CIMD plugin calls to fetch a client's metadata document or its `jwks_uri`. */
export type ClientMetadataFetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

function parsedUrl(input: RequestInfo | URL): URL | null {
	if (input instanceof URL) {
		return input;
	}
	return URL.parse(typeof input === 'string' ? input : input.url);
}

/**
 * Client metadata comes from a public host by name over HTTPS ({@link isPublicHttpsUrl}), never
 * from this application. Also the CIMD pre-fetch gate, so a refused URL costs no fetch budget.
 */
export function isClientMetadataUrlAllowed(
	input: RequestInfo | URL,
	applicationOrigin: string,
): boolean {
	const url = parsedUrl(input);
	return url !== null && isPublicHttpsUrl(url) && url.origin !== applicationOrigin;
}

/**
 * The CIMD transport on Workers, where DNS cannot be resolved or pinned: only an allowed URL is
 * fetched, and a redirect is refused rather than followed. The plugin adds its own timeout, size
 * cap and content-type check around every call.
 */
export function createClientMetadataFetch(
	applicationOrigin: string,
	platformFetch: typeof fetch = fetch,
): ClientMetadataFetch {
	return async (input, init) => {
		const url = parsedUrl(input);
		if (url === null || !isClientMetadataUrlAllowed(url, applicationOrigin)) {
			throw new TypeError('Client metadata must come from a public HTTPS host');
		}
		const response = await platformFetch(url, { ...init, redirect: 'manual' });
		if (response.status >= 300 && response.status < 400) {
			await response.body?.cancel();
			throw new TypeError('Client metadata fetch must not redirect');
		}
		return response;
	};
}
