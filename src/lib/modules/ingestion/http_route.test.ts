import { describe, expect, it, vi } from 'vitest';
import { createGiftIngestionPost } from './http_route.js';

describe('gift ingestion route binding', () => {
	it('forwards the request-scoped Workers rate-limit binding to the handler', async () => {
		const request = new Request('https://app.example/api/internal/v1/gift-ingestion', {
			method: 'POST',
		});
		const rateLimit = { limit: vi.fn(async () => ({ success: true })) };
		const handler = vi.fn(async () => new Response(null, { status: 204 }));
		const post = createGiftIngestionPost(handler);

		const result = await post({
			request,
			platform: { env: { GIFT_INGESTION_RATE_LIMIT: rateLimit } },
		});

		expect(result.status).toBe(204);
		expect(handler).toHaveBeenCalledWith(request, rateLimit);
	});
});
