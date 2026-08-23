import { describe, expect, it, vi } from 'vitest';
import {
	SUPPORTED_INGESTION_IMAGE_TYPES,
	downloadValidatedImage,
	imageObjectKey,
	validatePreparedImageReference,
} from './image_mirroring.js';

const png = Uint8Array.from([
	137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 3, 8, 6, 0,
	0, 0,
]);

describe('ingestion image mirroring', () => {
	it('exposes one shared supported MIME policy for request and validation boundaries', () => {
		expect(SUPPORTED_INGESTION_IMAGE_TYPES).toEqual([
			'image/jpeg',
			'image/png',
			'image/webp',
			'image/gif',
		]);
	});

	it('downloads a supported image only after DNS-safe HTTPS redirect validation and validates its bytes', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, {
					status: 302,
					headers: { location: 'https://cdn.example/p.png' },
				}),
			)
			.mockResolvedValueOnce(
				new Response(png, {
					headers: { 'content-type': 'image/png', 'content-length': String(png.length) },
				}),
			);
		const resolve = vi.fn(async (hostname: string) =>
			hostname === 'shop.example' ? ['93.184.216.34'] : ['1.1.1.1'],
		);

		const result = await downloadValidatedImage('https://shop.example/image', {
			fetch,
			resolve,
			timeoutMs: 1000,
		});

		expect(resolve).toHaveBeenCalledTimes(2);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(result).toMatchObject({
			contentType: 'image/png',
			byteLength: png.length,
			width: 2,
			height: 3,
		});
		expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
	});

	it('rejects private DNS answers, unsafe redirects, oversized bodies, and MIME disagreement without public network access', async () => {
		await expect(
			downloadValidatedImage('https://private.example/a.png', {
				resolve: async () => ['10.0.0.1'],
				fetch: vi.fn(),
			}),
		).rejects.toThrow(/public|unsafe/i);

		await expect(
			downloadValidatedImage('https://safe.example/a.png', {
				resolve: async () => ['93.184.216.34'],
				fetch: vi.fn(
					async () =>
						new Response(null, {
							status: 302,
							headers: { location: 'http://127.0.0.1/a' },
						}),
				),
			}),
		).rejects.toThrow(/https|unsafe/i);

		await expect(
			downloadValidatedImage('https://safe.example/a.png', {
				resolve: async () => ['93.184.216.34'],
				fetch: vi.fn(
					async () => new Response(png, { headers: { 'content-type': 'image/jpeg' } }),
				),
			}),
		).rejects.toThrow(/mime/i);

		await expect(
			downloadValidatedImage('https://safe.example/a.png', {
				resolve: async () => ['93.184.216.34'],
				fetch: vi.fn(
					async () => new Response(png, { headers: { 'content-type': 'image/png' } }),
				),
				maxBytes: 8,
			}),
		).rejects.toThrow(/size|large/i);
	});

	it('rejects IPv4-mapped private and metadata destinations', async () => {
		for (const address of [
			'::ffff:169.254.169.254',
			'::ffff:172.16.0.1',
			'::ffff:172.31.255.255',
			'::ffff:10.0.0.1',
			'::ffff:192.168.1.1',
		]) {
			await expect(
				downloadValidatedImage('https://safe.example/a.png', {
					resolve: async () => [address],
					fetch: vi.fn(),
				}),
			).rejects.toThrow(/public|unsafe/i);
		}
	});

	it('rejects zero-width and zero-height PNG headers', async () => {
		for (const [width, height] of [
			[0, 3],
			[2, 0],
		]) {
			const invalid = png.slice();
			new DataView(invalid.buffer).setUint32(16, width!);
			new DataView(invalid.buffer).setUint32(20, height!);
			await expect(
				downloadValidatedImage('https://safe.example/a.png', {
					resolve: async () => ['93.184.216.34'],
					fetch: vi.fn(
						async () =>
							new Response(invalid, { headers: { 'content-type': 'image/png' } }),
					),
				}),
			).rejects.toThrow(/dimensions/i);
		}
	});

	it('passes the selected validated DNS address to the pinned requester', async () => {
		const request = vi.fn(
			async () => new Response(png, { headers: { 'content-type': 'image/png' } }),
		);
		await downloadValidatedImage('https://safe.example/a.png', {
			resolve: async () => ['10.0.0.1', '93.184.216.34'],
			request,
		});
		expect(request).toHaveBeenCalledWith(
			expect.objectContaining({ hostname: 'safe.example' }),
			'93.184.216.34',
			expect.any(AbortSignal),
		);
	});

	it('binds ingestion keys and prepared references to wishlist, manifest, item, hash, MIME, and size', () => {
		const input = {
			wishlistId: 'wishlist-1',
			manifestId: 'batch-1',
			itemId: 'item-1',
			sha256: 'a'.repeat(64),
			contentType: 'image/png' as const,
			byteLength: 30,
		};
		const key = imageObjectKey(input);
		expect(key).toBe(`gifts/ingestion/wishlist-1/batch-1/item-1/${'a'.repeat(64)}.png`);
		expect(() => validatePreparedImageReference({ ...input, key })).not.toThrow();
		expect(() =>
			validatePreparedImageReference({ ...input, key: key.replace('item-1', 'item-2') }),
		).toThrow(/binding/i);
	});
});
