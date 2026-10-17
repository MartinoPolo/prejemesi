import { describe, expect, it, vi } from 'vitest';
import {
	IMAGE_DOWNLOAD_FAILURE,
	ImageDownloadError,
	MAX_IMAGE_PIXELS,
	MAX_IMAGE_SIDE_PX,
	fetchPublicImage,
	type ImageDownloadFailure,
	type ImageFetch,
} from './image_download.js';

/** A PNG header declaring the given dimensions. */
function pngBytes(width: number, height: number): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(29);
	bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
	const view = new DataView(bytes.buffer);
	view.setUint32(16, width);
	view.setUint32(20, height);
	return bytes;
}

const gifBytes = Uint8Array.from([71, 73, 70, 56, 57, 97, 4, 0, 5, 0, 0, 0]);

function imageResponse(body: Uint8Array<ArrayBuffer>, contentType: string): Response {
	return new Response(body, { headers: { 'content-type': contentType } });
}

function redirectTo(location: string, status = 302): Response {
	return new Response(null, { status, headers: { location } });
}

function fetchAnswering(...responses: Response[]) {
	const fetch = vi.fn<ImageFetch>();
	for (const response of responses) {
		fetch.mockResolvedValueOnce(response);
	}
	return fetch;
}

async function failureOf(work: Promise<unknown>): Promise<ImageDownloadFailure> {
	const thrown = await work.then(
		() => null,
		(caught: unknown) => caught,
	);
	if (!(thrown instanceof ImageDownloadError)) {
		throw new Error(`Expected an image download failure, got ${String(thrown)}`);
	}
	return thrown.reason;
}

describe('fetchPublicImage', () => {
	it('downloads an HTTPS image, following a redirect, with its type, size and dimensions', async () => {
		const fetch = fetchAnswering(
			redirectTo('/images/kolo.png'),
			imageResponse(pngBytes(640, 480), 'image/png'),
		);

		const image = await fetchPublicImage('https://shop.example/kolo', { fetch });

		expect(image).toMatchObject({
			contentType: 'image/png',
			byteLength: 29,
			width: 640,
			height: 480,
			finalUrl: 'https://shop.example/images/kolo.png',
		});
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(fetch.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
	});

	it('accepts HTTPS only, without credentials', async () => {
		for (const url of [
			'http://shop.example/kolo.png',
			'ftp://shop.example/kolo.png',
			'https://user:secret@shop.example/kolo.png',
			'not a url',
		]) {
			const fetch = fetchAnswering();
			expect(await failureOf(fetchPublicImage(url, { fetch })), url).toBe(
				IMAGE_DOWNLOAD_FAILURE.invalidUrl,
			);
			expect(fetch).not.toHaveBeenCalled();
		}
	});

	it('refuses IP addresses, local names and non-default ports before requesting them', async () => {
		for (const url of [
			'https://127.0.0.1/kolo.png',
			'https://2130706433/kolo.png',
			'https://0x7f.1/kolo.png',
			'https://127.1/kolo.png',
			'https://169.254.169.254/latest/meta-data',
			'https://[::1]/kolo.png',
			'https://[::ffff:127.0.0.1]/kolo.png',
			'https://localhost/kolo.png',
			'https://localhost./kolo.png',
			'https://localhost../kolo.png',
			'https://foo.localhost./kolo.png',
			'https://printer.local/kolo.png',
			'https://metadata.google.internal/kolo.png',
			'https://nas.lan/kolo.png',
			'https://intranet/kolo.png',
			'https://router.home.arpa/kolo.png',
			'https://shop.example:8443/kolo.png',
		]) {
			const fetch = fetchAnswering();
			expect(await failureOf(fetchPublicImage(url, { fetch })), url).toBe(
				IMAGE_DOWNLOAD_FAILURE.blockedHost,
			);
			expect(fetch).not.toHaveBeenCalled();
		}
	});

	it('re-validates every redirect target before requesting it', async () => {
		const toPrivate = fetchAnswering(redirectTo('https://10.0.0.1/kolo.png'));
		expect(
			await failureOf(fetchPublicImage('https://shop.example/kolo', { fetch: toPrivate })),
		).toBe(IMAGE_DOWNLOAD_FAILURE.blockedHost);
		expect(toPrivate).toHaveBeenCalledTimes(1);

		const toPlainHttp = fetchAnswering(redirectTo('http://cdn.example/kolo.png', 301));
		expect(
			await failureOf(fetchPublicImage('https://shop.example/kolo', { fetch: toPlainHttp })),
		).toBe(IMAGE_DOWNLOAD_FAILURE.invalidUrl);
		expect(toPlainHttp).toHaveBeenCalledTimes(1);

		for (const target of ['https://localhost/kolo.png', 'https://cdn.example:8443/kolo.png']) {
			const toBlocked = fetchAnswering(redirectTo(target, 307));
			expect(
				await failureOf(
					fetchPublicImage('https://shop.example/kolo', { fetch: toBlocked }),
				),
				target,
			).toBe(IMAGE_DOWNLOAD_FAILURE.blockedHost);
			expect(toBlocked).toHaveBeenCalledTimes(1);
		}
	});

	it('caps the number of redirects', async () => {
		const fetch = vi.fn<ImageFetch>(async () => redirectTo('https://shop.example/again'));

		expect(
			await failureOf(
				fetchPublicImage('https://shop.example/kolo', { fetch, maxRedirects: 2 }),
			),
		).toBe(IMAGE_DOWNLOAD_FAILURE.fetchFailed);
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('rejects a declared type other than JPEG, PNG, WebP or GIF', async () => {
		const fetch = fetchAnswering(imageResponse(pngBytes(1, 1), 'image/svg+xml'));

		expect(await failureOf(fetchPublicImage('https://shop.example/kolo.svg', { fetch }))).toBe(
			IMAGE_DOWNLOAD_FAILURE.unsupportedType,
		);
	});

	it('rejects bytes that are no image or another type than declared', async () => {
		const html = new TextEncoder().encode('<html>not an image</html>');
		expect(
			await failureOf(
				fetchPublicImage('https://shop.example/kolo.png', {
					fetch: fetchAnswering(imageResponse(html, 'image/png')),
				}),
			),
		).toBe(IMAGE_DOWNLOAD_FAILURE.signatureMismatch);
		expect(
			await failureOf(
				fetchPublicImage('https://shop.example/kolo.png', {
					fetch: fetchAnswering(imageResponse(gifBytes, 'image/png')),
				}),
			),
		).toBe(IMAGE_DOWNLOAD_FAILURE.signatureMismatch);
	});

	it('rejects an image over the size cap, declared or streamed', async () => {
		const bytes = pngBytes(10, 10);
		expect(
			await failureOf(
				fetchPublicImage('https://shop.example/kolo.png', {
					fetch: fetchAnswering(imageResponse(bytes, 'image/png')),
					maxBytes: bytes.length - 1,
				}),
			),
		).toBe(IMAGE_DOWNLOAD_FAILURE.tooLarge);
		const declaredHuge = new Response(bytes, {
			headers: { 'content-type': 'image/png', 'content-length': '999999999' },
		});
		expect(
			await failureOf(
				fetchPublicImage('https://shop.example/kolo.png', {
					fetch: fetchAnswering(declaredHuge),
					maxBytes: 1000,
				}),
			),
		).toBe(IMAGE_DOWNLOAD_FAILURE.tooLarge);
	});

	it('rejects an image with zero, oversized or too many pixels', async () => {
		for (const [width, height] of [
			[0, 10],
			[10, 0],
			[MAX_IMAGE_SIDE_PX + 1, 10],
			[10, MAX_IMAGE_SIDE_PX + 1],
			[MAX_IMAGE_SIDE_PX, MAX_IMAGE_PIXELS / MAX_IMAGE_SIDE_PX + 1],
		] as const) {
			expect(
				await failureOf(
					fetchPublicImage('https://shop.example/kolo.png', {
						fetch: fetchAnswering(imageResponse(pngBytes(width, height), 'image/png')),
					}),
				),
				`${width}x${height}`,
			).toBe(IMAGE_DOWNLOAD_FAILURE.invalidDimensions);
		}
		const largestAllowed = await fetchPublicImage('https://shop.example/kolo.png', {
			fetch: fetchAnswering(
				imageResponse(
					pngBytes(MAX_IMAGE_SIDE_PX, MAX_IMAGE_PIXELS / MAX_IMAGE_SIDE_PX),
					'image/png',
				),
			),
		});
		expect(largestAllowed.width * largestAllowed.height).toBe(MAX_IMAGE_PIXELS);
	});

	it('reports an error status or a failing host as a failed download', async () => {
		expect(
			await failureOf(
				fetchPublicImage('https://shop.example/kolo.png', {
					fetch: fetchAnswering(new Response('missing', { status: 404 })),
				}),
			),
		).toBe(IMAGE_DOWNLOAD_FAILURE.fetchFailed);
		const unreachable = vi.fn<ImageFetch>(async () => {
			throw new TypeError('fetch failed');
		});
		expect(
			await failureOf(
				fetchPublicImage('https://shop.example/kolo.png', { fetch: unreachable }),
			),
		).toBe(IMAGE_DOWNLOAD_FAILURE.fetchFailed);
	});

	it('aborts a request that exceeds the timeout', async () => {
		const hanging = vi.fn<ImageFetch>(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
				}),
		);

		expect(
			await failureOf(
				fetchPublicImage('https://shop.example/kolo.png', {
					fetch: hanging,
					timeoutMs: 10,
				}),
			),
		).toBe(IMAGE_DOWNLOAD_FAILURE.fetchFailed);
	});
});
