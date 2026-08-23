import { describe, expect, it, vi } from 'vitest';
import { createGiftIngestionHandler } from './http_handler.js';
import { IngestionError } from './ingestion_error.js';
import type { GiftIngestionManifest } from './manifest.js';

const manifest: GiftIngestionManifest = {
	schemaVersion: 1,
	manifestId: 'batch-1',
	wishlist: { shortId: 'fixed', title: 'Christmas', recipient: 'Rosie' },
	items: [],
};

function allowedRateLimit() {
	return { limit: vi.fn(async () => ({ success: true })) };
}

function request(body: unknown = { manifest }, headers: Record<string, string> = {}) {
	return new Request('https://app.example/api/internal/v1/gift-ingestion', {
		method: 'POST',
		headers: {
			authorization: 'Bearer top-secret',
			'content-type': 'application/json',
			...headers,
		},
		body: typeof body === 'string' ? body : JSON.stringify(body),
	});
}

describe('gift ingestion HTTP handler', () => {
	it('is disabled without all dedicated secret and fixed-target configuration', async () => {
		for (const config of [
			{ token: '', targetShortId: 'fixed', actorId: 'actor' },
			{ token: 'top-secret', targetShortId: '', actorId: 'actor' },
			{ token: 'top-secret', targetShortId: 'fixed', actorId: '' },
		]) {
			const process = vi.fn();
			const response = await createGiftIngestionHandler({ config, process })(request());
			expect(response.status).toBe(404);
			expect(process).not.toHaveBeenCalled();
		}
	});

	it('requires the dedicated bearer token, JSON content type, valid JSON, and bounded body', async () => {
		const process = vi.fn();
		const handler = createGiftIngestionHandler({
			config: { token: 'top-secret', targetShortId: 'fixed', actorId: 'actor' },
			process,
			rateLimit: allowedRateLimit(),
		});
		for (const incoming of [
			request(undefined, { authorization: 'Bearer wrong' }),
			request(undefined, { authorization: '' }),
			request('{}', { 'content-type': 'text/plain' }),
			request('{broken'),
			request('x'.repeat(1_048_577)),
		]) {
			const response = await handler(incoming);
			expect(response.status).toBeGreaterThanOrEqual(400);
		}
		expect(process).not.toHaveBeenCalled();
	});

	it('does not spend authenticated quota on invalid or missing bearer tokens', async () => {
		const process = vi.fn(async () => ({ mode: 'dry-run' }));
		const rateLimit = { limit: vi.fn(async () => ({ success: true })) };
		const handler = createGiftIngestionHandler({
			config: { token: 'top-secret', targetShortId: 'fixed', actorId: 'actor' },
			process,
			rateLimit,
		});

		expect((await handler(request(undefined, { authorization: 'Bearer wrong' }))).status).toBe(
			401,
		);
		expect((await handler(request(undefined, { authorization: '' }))).status).toBe(401);
		expect(rateLimit.limit).not.toHaveBeenCalled();
	});

	it('checks the shared rate limit with a fixed non-secret key before reading the body', async () => {
		const sequence: string[] = [];
		const incoming = request();
		const originalText = incoming.text.bind(incoming);
		vi.spyOn(incoming, 'text').mockImplementation(async () => {
			sequence.push('body');
			return originalText();
		});
		const rateLimit = {
			limit: vi.fn(async (input: { key: string }) => {
				sequence.push(`limit:${input.key}`);
				return { success: true };
			}),
		};
		const handler = createGiftIngestionHandler({
			config: { token: 'top-secret', targetShortId: 'fixed', actorId: 'actor' },
			process: vi.fn(async () => ({ mode: 'dry-run' })),
			rateLimit,
		});

		expect((await handler(incoming)).status).toBe(200);
		expect(sequence).toEqual(['limit:gift-ingestion-endpoint', 'body']);
	});

	it('returns a typed 429 without reading the body or invoking DB/R2 operations when denied', async () => {
		const process = vi.fn();
		const prepare = vi.fn();
		const cleanup = vi.fn();
		const incoming = request();
		const readBody = vi.spyOn(incoming, 'text');
		const handler = createGiftIngestionHandler({
			config: { token: 'top-secret', targetShortId: 'fixed', actorId: 'actor' },
			process,
			prepare,
			cleanup,
			rateLimit: { limit: vi.fn(async () => ({ success: false })) },
		});

		const result = await handler(incoming);

		expect(result.status).toBe(429);
		expect(await result.json()).toEqual({
			error: 'Rate limit exceeded',
			code: 'rate_limit_exceeded',
		});
		expect(readBody).not.toHaveBeenCalled();
		expect(process).not.toHaveBeenCalled();
		expect(prepare).not.toHaveBeenCalled();
		expect(cleanup).not.toHaveBeenCalled();
	});

	it('fails closed with a typed 503 and no DB/R2 operations when the binding is unavailable', async () => {
		for (const rateLimit of [
			undefined,
			{ limit: vi.fn(async () => Promise.reject(new Error('binding failure'))) },
		]) {
			const process = vi.fn();
			const prepare = vi.fn();
			const cleanup = vi.fn();
			const handler = createGiftIngestionHandler({
				config: { token: 'top-secret', targetShortId: 'fixed', actorId: 'actor' },
				process,
				prepare,
				cleanup,
				rateLimit,
			});

			const result = await handler(request());

			expect(result.status).toBe(503);
			expect(await result.json()).toEqual({
				error: 'Ingestion rate limit unavailable',
				code: 'rate_limit_unavailable',
			});
			expect(process).not.toHaveBeenCalled();
			expect(prepare).not.toHaveBeenCalled();
			expect(cleanup).not.toHaveBeenCalled();
		}
	});

	it('issues image preparation only through the fixed validated handler action', async () => {
		const prepare = vi.fn(async () => [
			{
				itemId: 'item-1',
				key: 'gifts/ingestion/key',
				uploadUrl: 'https://r2.example/signed',
			},
		]);
		const handler = createGiftIngestionHandler({
			config: { token: 'top-secret', targetShortId: 'fixed', actorId: 'actor' },
			process: vi.fn(),
			prepare,
			rateLimit: allowedRateLimit(),
		});
		const response = await handler(
			request({
				action: 'prepare-images',
				manifest,
				images: [
					{
						itemId: 'item-1',
						sha256: 'a'.repeat(64),
						contentType: 'image/png',
						byteLength: 30,
						width: 2,
						height: 3,
					},
				],
			}),
		);
		expect(response.status).toBe(200);
		expect(prepare).toHaveBeenCalledWith(
			manifest,
			expect.objectContaining({ config: { targetShortId: 'fixed', actorId: 'actor' } }),
		);
	});

	it('routes validated cleanup references through the configured shared cleanup operation', async () => {
		const cleanup = vi.fn(async () => undefined);
		const handler = createGiftIngestionHandler({
			config: { token: 'top-secret', targetShortId: 'fixed', actorId: 'actor' },
			process: vi.fn(),
			cleanup,
			rateLimit: allowedRateLimit(),
		});
		const preparedImages = [
			{
				wishlistId: 'wishlist-id',
				manifestId: 'batch-1',
				itemId: 'item-1',
				key: `gifts/ingestion/wishlist-id/batch-1/item-1/${'a'.repeat(64)}.png`,
				sha256: 'a'.repeat(64),
				contentType: 'image/png',
				byteLength: 30,
			},
		];
		const result = await handler(
			request({ action: 'cleanup-images', manifest, preparedImages }),
		);

		expect(result.status).toBe(200);
		expect(cleanup).toHaveBeenCalledWith(manifest, {
			preparedImages,
			config: { targetShortId: 'fixed', actorId: 'actor' },
		});
	});

	it('retains typed ingestion responses and hides unknown exception details behind 500', async () => {
		const config = { token: 'top-secret', targetShortId: 'fixed', actorId: 'actor' };
		const conflict = await createGiftIngestionHandler({
			config,
			rateLimit: allowedRateLimit(),
			process: vi.fn(async () => {
				throw new IngestionError('target_mismatch', 'Safe public detail');
			}),
		})(request());
		const unknown = await createGiftIngestionHandler({
			config,
			rateLimit: allowedRateLimit(),
			process: vi.fn(async () => {
				throw new Error('database password and internal detail');
			}),
		})(request());

		expect(conflict.status).toBe(409);
		expect(await conflict.json()).toEqual({
			error: 'Safe public detail',
			code: 'target_mismatch',
		});
		expect(unknown.status).toBe(500);
		expect(await unknown.json()).toEqual({ error: 'Ingestion failed' });
	});

	it('defaults to dry-run and accepts only an explicit apply boolean without destination or credentials', async () => {
		const process = vi.fn(async (_manifest: unknown, options: { apply: boolean }) => ({
			mode: options.apply ? 'apply' : 'dry-run',
		}));
		const handler = createGiftIngestionHandler({
			config: { token: 'top-secret', targetShortId: 'fixed', actorId: 'actor' },
			process,
			rateLimit: allowedRateLimit(),
		});
		const dryResponse = await handler(request());
		expect(dryResponse.status).toBe(200);
		expect(process).toHaveBeenLastCalledWith(
			manifest,
			expect.objectContaining({
				apply: false,
				config: { targetShortId: 'fixed', actorId: 'actor' },
			}),
		);

		const applyResponse = await handler(request({ manifest, apply: true }));
		expect(applyResponse.status).toBe(200);
		expect(await applyResponse.json()).toEqual({ mode: 'apply' });
		expect(process).toHaveBeenLastCalledWith(
			manifest,
			expect.objectContaining({ apply: true }),
		);

		for (const forbidden of [
			{ manifest, apply: true, destinationWishlistId: 'other' },
			{ manifest, sql: 'delete from gift' },
			{ manifest, databaseUrl: 'postgres://secret' },
			{ manifest, r2Secret: 'secret' },
			{ manifest, environment: 'staging' },
			{ manifest, cookie: 'better-auth.session=secret' },
		]) {
			const response = await handler(request(forbidden));
			expect(response.status).toBe(400);
		}
	});
});
