import { describe, expect, it, vi } from 'vitest';
import {
	createClientMetadataFetch,
	isClientMetadataUrlAllowed,
} from './oauth_client_metadata_fetch.js';

const APPLICATION_ORIGIN = 'https://prejemesi.cz';
const METADATA_URL = 'https://claude.ai/oauth/mcp-client-metadata.json';

function platformFetchAnswering(response: () => Response) {
	return vi.fn<typeof fetch>(async () => response());
}

describe('isClientMetadataUrlAllowed', () => {
	it('allows a public HTTPS metadata URL as a string, URL or request', () => {
		for (const input of [METADATA_URL, new URL(METADATA_URL), new Request(METADATA_URL)]) {
			expect(isClientMetadataUrlAllowed(input, APPLICATION_ORIGIN)).toBe(true);
		}
	});

	it.each([
		['the application itself', 'https://prejemesi.cz/client.json'],
		['plain HTTP', 'http://claude.ai/client.json'],
		['a private address', 'https://192.168.1.10/client.json'],
		['a loopback name', 'https://localhost/client.json'],
		['a link-local address', 'https://[fe80::1]/client.json'],
		['an unparsable URL', 'not a url'],
	])('refuses %s', (_label, input) => {
		expect(isClientMetadataUrlAllowed(input, APPLICATION_ORIGIN)).toBe(false);
	});
});

describe('createClientMetadataFetch', () => {
	it('fetches an allowed URL without following redirects, keeping the caller’s request options', async () => {
		const platformFetch = platformFetchAnswering(() =>
			Response.json({ client_name: 'Claude' }),
		);
		const metadataFetch = createClientMetadataFetch(APPLICATION_ORIGIN, platformFetch);
		const timeout = new AbortController();

		const response = await metadataFetch(METADATA_URL, {
			headers: { accept: 'application/json' },
			signal: timeout.signal,
		});

		expect(await response.json()).toEqual({ client_name: 'Claude' });
		expect(platformFetch).toHaveBeenCalledOnce();
		const [fetchedUrl, init] = platformFetch.mock.calls[0] ?? [];
		expect(String(fetchedUrl)).toBe(METADATA_URL);
		expect(init).toMatchObject({
			redirect: 'manual',
			headers: { accept: 'application/json' },
			signal: timeout.signal,
		});
	});

	it('never follows a redirect even when the caller asks to', async () => {
		const platformFetch = platformFetchAnswering(() => Response.json({}));
		const metadataFetch = createClientMetadataFetch(APPLICATION_ORIGIN, platformFetch);

		await metadataFetch(METADATA_URL, { redirect: 'follow' });

		expect(platformFetch.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
	});

	it.each([301, 302, 303, 307, 308])(
		'refuses a %i redirect and cancels its body',
		async (status) => {
			const cancel = vi.fn();
			const body = new ReadableStream({ cancel });
			const platformFetch = platformFetchAnswering(
				() =>
					new Response(body, {
						status,
						headers: { location: 'https://169.254.169.254/latest/meta-data' },
					}),
			);
			const metadataFetch = createClientMetadataFetch(APPLICATION_ORIGIN, platformFetch);

			await expect(metadataFetch(METADATA_URL)).rejects.toThrow(TypeError);
			expect(cancel).toHaveBeenCalled();
			expect(platformFetch).toHaveBeenCalledOnce();
		},
	);

	it.each([
		'https://prejemesi.cz/client.json',
		'https://10.0.0.1/client.json',
		'https://localhost/client.json',
		'http://claude.ai/client.json',
	])('refuses %s without fetching it', async (url) => {
		const platformFetch = platformFetchAnswering(() => Response.json({}));
		const metadataFetch = createClientMetadataFetch(APPLICATION_ORIGIN, platformFetch);

		await expect(metadataFetch(url)).rejects.toThrow(TypeError);
		expect(platformFetch).not.toHaveBeenCalled();
	});

	it('passes an error status through for the plugin to reject', async () => {
		const platformFetch = platformFetchAnswering(() => new Response('gone', { status: 404 }));
		const metadataFetch = createClientMetadataFetch(APPLICATION_ORIGIN, platformFetch);

		expect((await metadataFetch(new Request(METADATA_URL))).status).toBe(404);
	});
});
