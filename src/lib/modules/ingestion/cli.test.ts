import { describe, expect, it, vi } from 'vitest';
import { runGiftIngestionCli } from '../../../../scripts/ingest-gifts.js';

const manifest = JSON.stringify({
	schemaVersion: 1,
	manifestId: 'batch-1',
	wishlist: { shortId: 'fixed', title: 'Christmas', recipient: 'Rosie' },
	items: [],
});

function dependencies() {
	return {
		readFile: vi.fn(async (path: string) =>
			path.endsWith('.json')
				? manifest
				: 'GIFT_INGESTION_TOKEN="secret-token"\nGIFT_INGESTION_BASE_URL="https://prejemesi.example"\n',
		),
		fetch: vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json({ mode: 'dry-run', conflicts: [], wouldCreate: [] })),
		stdout: vi.fn(),
		stderr: vi.fn(),
		resolve: vi.fn(async () => ['93.184.216.34']),
		imageFetch: undefined as typeof fetch | undefined,
	};
}

describe('ingest-gifts CLI', () => {
	it('downloads, prepares, uploads, and applies mirrored images without exposing R2 credentials', async () => {
		const imageManifest = JSON.stringify({
			schemaVersion: 1,
			manifestId: 'batch-1',
			wishlist: { shortId: 'fixed', title: 'Christmas', recipient: 'Rosie' },
			items: [
				{
					itemId: 'item-1',
					sourceUrl: 'https://shop.example/item',
					gift: {
						name: 'Camera',
						links: [{ url: 'https://shop.example/item' }],
						currency: 'CZK',
						imageUrl: 'https://cdn.example/a.png',
						quantity: 1,
						priority: 'high',
					},
					provenance: {
						gatheredAt: '2026-08-08T10:00:00.000Z',
						fields: {},
						imageSource: { url: 'https://cdn.example/a.png', method: 'json-ld' },
					},
				},
			],
		});
		const png = Uint8Array.from([
			137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 3, 8,
			6, 0, 0, 0,
		]);
		const deps = dependencies();
		deps.readFile.mockImplementation(async (path: string) =>
			path.endsWith('.json')
				? imageManifest
				: 'GIFT_INGESTION_TOKEN=secret-token\nGIFT_INGESTION_BASE_URL=https://prejemesi.example',
		);
		deps.resolve = vi.fn(async () => ['93.184.216.34']);
		deps.imageFetch = deps.fetch;
		deps.fetch.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			if (url === 'https://cdn.example/a.png') {
				return new Response(png, { headers: { 'content-type': 'image/png' } });
			}
			if (url === 'https://r2.example/signed') {
				return new Response(null, { status: 200 });
			}
			const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
			if (body.action === 'prepare-images') {
				return Response.json({
					mode: 'prepare-images',
					prepared: [
						{
							itemId: 'item-1',
							wishlistId: 'wishlist-db-id',
							manifestId: 'batch-1',
							key: 'gifts/ingestion/key.png',
							sha256: (body.images as { sha256: string }[])[0]!.sha256,
							contentType: 'image/png',
							byteLength: png.length,
							uploadUrl: 'https://r2.example/signed',
						},
					],
				});
			}
			if (body.apply === true) {
				return Response.json({
					mode: 'apply',
					conflicts: [],
					created: [{ itemId: 'item-1', giftId: 'gift-1' }],
				});
			}
			return Response.json({
				mode: 'dry-run',
				conflicts: [],
				wouldCreate: [{ itemId: 'item-1', name: 'Camera' }],
			});
		});
		expect(
			await runGiftIngestionCli(
				[
					'--manifest',
					'./batch.json',
					'--base-url',
					'https://prejemesi.example',
					'--apply',
				],
				deps,
			),
		).toBe(0);
		expect(deps.fetch).toHaveBeenCalledWith(
			'https://r2.example/signed',
			expect.objectContaining({ method: 'PUT', body: expect.any(Uint8Array) }),
		);
		expect(JSON.stringify(deps.stdout.mock.calls)).not.toContain('secret-token');
	});

	it('reports a rejected PUT as image-upload with its item id and cleans prepared images', async () => {
		const imageManifest = JSON.stringify({
			schemaVersion: 1,
			manifestId: 'batch-cleanup',
			wishlist: { shortId: 'fixed', title: 'Christmas', recipient: 'Rosie' },
			items: [
				{
					itemId: 'item-1',
					sourceUrl: 'https://shop.example/item',
					gift: {
						name: 'Camera',
						links: [{ url: 'https://shop.example/item' }],
						currency: 'CZK',
						imageUrl: 'https://cdn.example/a.png',
						quantity: 1,
						priority: 'high',
					},
					provenance: { gatheredAt: '2026-08-08T10:00:00.000Z', fields: {} },
				},
			],
		});
		const png = Uint8Array.from([
			137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 3, 8,
			6, 0, 0, 0,
		]);
		const deps = dependencies();
		deps.readFile.mockImplementation(async (path: string) =>
			path.endsWith('.json')
				? imageManifest
				: 'GIFT_INGESTION_TOKEN=secret-token\nGIFT_INGESTION_BASE_URL=https://prejemesi.example',
		);
		deps.imageFetch = deps.fetch;
		const apiBodies: Record<string, unknown>[] = [];
		deps.fetch.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
			const url = String(input);
			if (url === 'https://cdn.example/a.png') {
				return new Response(png, { headers: { 'content-type': 'image/png' } });
			}
			if (url === 'https://r2.example/signed') {
				throw new TypeError('upload connection reset');
			}
			const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
			apiBodies.push(body);
			if (body.action === 'prepare-images') {
				return Response.json({
					prepared: [
						{
							itemId: 'item-1',
							wishlistId: 'wishlist-db-id',
							manifestId: 'batch-cleanup',
							key: 'gifts/ingestion/key.png',
							sha256: 'a'.repeat(64),
							contentType: 'image/png',
							byteLength: png.length,
							uploadUrl: 'https://r2.example/signed',
						},
					],
				});
			}
			if (body.action === 'cleanup-images') {
				return Response.json({ cleaned: true });
			}
			if (body.apply === true) {
				throw new Error('apply must not run after a rejected upload');
			}
			return Response.json({
				mode: 'dry-run',
				conflicts: [],
				wouldCreate: [{ itemId: 'item-1', name: 'Camera' }],
			});
		});

		expect(
			await runGiftIngestionCli(
				[
					'--manifest',
					'./batch.json',
					'--base-url',
					'https://prejemesi.example',
					'--apply',
				],
				deps,
			),
		).toBe(1);
		expect(deps.stderr).toHaveBeenCalledWith(
			JSON.stringify({
				stage: 'image-upload',
				itemId: 'item-1',
				error: 'upload connection reset',
			}),
		);
		const cleanup = apiBodies.find((body) => body.action === 'cleanup-images');
		expect(cleanup?.preparedImages).toEqual([
			expect.objectContaining({ itemId: 'item-1', key: 'gifts/ingestion/key.png' }),
		]);
	});

	it('stops with a nonzero exit after dry-run reports ambiguities', async () => {
		const deps = dependencies();
		deps.fetch.mockResolvedValue(
			Response.json({
				mode: 'dry-run',
				conflicts: [],
				wouldCreate: [{ itemId: 'item-1', name: 'Camera' }],
				ambiguities: [{ itemId: 'item-1', field: 'imageUrl', reason: 'Two images match.' }],
			}),
		);
		expect(
			await runGiftIngestionCli(
				[
					'--manifest',
					'./batch.json',
					'--base-url',
					'https://prejemesi.example',
					'--apply',
				],
				deps,
			),
		).toBe(1);
		expect(deps.fetch).toHaveBeenCalledOnce();
		expect(deps.stdout).toHaveBeenCalledWith(expect.stringContaining('"ambiguities"'));
	});

	it('dry-run with an image calls only the protected app endpoint', async () => {
		const deps = dependencies();
		deps.readFile.mockImplementation(async (path: string) =>
			path.endsWith('.json')
				? JSON.stringify({
						schemaVersion: 1,
						manifestId: 'batch-image',
						wishlist: { shortId: 'fixed', title: 'Christmas', recipient: 'Rosie' },
						items: [
							{
								itemId: 'item-image',
								sourceUrl: 'https://shop.example/item',
								gift: {
									name: 'Camera',
									links: [{ url: 'https://shop.example/item' }],
									currency: 'CZK',
									imageUrl: 'https://cdn.example/a.png',
									quantity: 1,
									priority: 'high',
								},
								provenance: {
									gatheredAt: '2026-08-08T10:00:00.000Z',
									fields: {},
								},
							},
						],
					})
				: 'GIFT_INGESTION_TOKEN=secret-token\nGIFT_INGESTION_BASE_URL=https://prejemesi.example',
		);
		expect(await runGiftIngestionCli(['--manifest', './batch.json'], deps)).toBe(0);
		expect(deps.fetch).toHaveBeenCalledTimes(1);
		expect(deps.fetch).toHaveBeenCalledWith(
			'https://prejemesi.example/api/internal/v1/gift-ingestion',
			expect.objectContaining({ method: 'POST' }),
		);
	});
	it('defaults to dry-run, loads the token without printing it, and calls only the fixed endpoint', async () => {
		const deps = dependencies();
		const exitCode = await runGiftIngestionCli(
			['--manifest', './batch.json', '--base-url', 'https://prejemesi.example'],
			deps,
		);
		expect(exitCode).toBe(0);
		expect(deps.fetch).toHaveBeenCalledWith(
			'https://prejemesi.example/api/internal/v1/gift-ingestion',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({ authorization: 'Bearer secret-token' }),
				body: expect.stringContaining('"apply":false'),
			}),
		);
		expect(JSON.stringify(deps.stdout.mock.calls)).not.toContain('secret-token');
	});

	it('requires --apply and an explicit non-local HTTPS base URL for mutation', async () => {
		for (const args of [
			['--manifest', './batch.json', '--apply'],
			['--manifest', './batch.json', '--apply', '--base-url', 'http://localhost:5173'],
		]) {
			const deps = dependencies();
			expect(await runGiftIngestionCli(args, deps)).toBe(2);
			expect(deps.fetch).not.toHaveBeenCalled();
		}
	});

	it('accepts equivalent explicit and configured root origins with trailing slashes', async () => {
		const deps = dependencies();
		deps.readFile.mockImplementation(async (path: string) =>
			path.endsWith('.json')
				? manifest
				: 'GIFT_INGESTION_TOKEN=secret-token\nGIFT_INGESTION_BASE_URL=https://prejemesi.example/',
		);
		expect(
			await runGiftIngestionCli(
				['--manifest', './batch.json', '--base-url', 'https://prejemesi.example'],
				deps,
			),
		).toBe(0);
		expect(deps.fetch).toHaveBeenCalledOnce();
	});

	it('rejects a base URL outside the configured allowlist before any fetch', async () => {
		const deps = dependencies();
		expect(
			await runGiftIngestionCli(
				['--manifest', './batch.json', '--base-url', 'https://attacker.example'],
				deps,
			),
		).toBe(1);
		expect(deps.fetch).not.toHaveBeenCalled();
	});

	it('uses the configured production origin when dry-run omits --base-url', async () => {
		const deps = dependencies();
		expect(await runGiftIngestionCli(['--manifest', './batch.json'], deps)).toBe(0);
		expect(deps.fetch).toHaveBeenCalledWith(
			'https://prejemesi.example/api/internal/v1/gift-ingestion',
			expect.anything(),
		);
	});

	it('emits structured output and exits nonzero on target mismatch or item conflict', async () => {
		for (const payload of [
			{ error: 'Manifest wishlist identity mismatch' },
			{ mode: 'dry-run', conflicts: [{ itemId: 'one', reason: 'item-content-changed' }] },
		]) {
			const deps = dependencies();
			deps.fetch.mockResolvedValue(
				'error' in payload
					? Response.json(payload, { status: 409 })
					: Response.json(payload),
			);
			expect(
				await runGiftIngestionCli(
					['--manifest', './batch.json', '--base-url', 'https://prejemesi.example'],
					deps,
				),
			).toBe(1);
			expect(deps.stdout).toHaveBeenCalledWith(
				expect.stringContaining(JSON.stringify(payload)),
			);
		}
	});
});
