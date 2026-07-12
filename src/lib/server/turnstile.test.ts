import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from './turnstile.js';

const secretKey = 'test-secret';

function response(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

describe('verifyTurnstileToken', () => {
	it('rejects a missing token', async () => {
		expect(
			await verifyTurnstileToken({ token: undefined, secretKey, fetcher: vi.fn() }),
		).toEqual({ success: false, reason: 'missing' });
	});

	it('rejects an invalid token', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				response({ success: false, 'error-codes': ['invalid-input-response'] }),
			);
		expect(await verifyTurnstileToken({ token: 'invalid', secretKey, fetcher })).toEqual({
			success: false,
			reason: 'invalid',
		});
	});

	it('classifies expired or replayed tokens', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				response({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
			);
		expect(await verifyTurnstileToken({ token: 'used', secretKey, fetcher })).toEqual({
			success: false,
			reason: 'expired_or_replayed',
		});
	});

	it('fails closed when Siteverify is unavailable', async () => {
		const fetcher = vi.fn().mockRejectedValue(new TypeError('network unavailable'));
		expect(await verifyTurnstileToken({ token: 'valid', secretKey, fetcher })).toEqual({
			success: false,
			reason: 'unavailable',
		});
	});

	it('accepts a successful Siteverify response', async () => {
		const fetcher = vi.fn().mockResolvedValue(response({ success: true }));
		expect(await verifyTurnstileToken({ token: 'valid', secretKey, fetcher })).toEqual({
			success: true,
		});
		expect(fetcher).toHaveBeenCalledWith(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ secret: secretKey, response: 'valid' }),
			},
		);
	});

	it('fails closed in production when the secret is missing', async () => {
		expect(
			await verifyTurnstileToken({
				token: 'valid',
				secretKey: undefined,
				fetcher: vi.fn(),
				isDevelopment: false,
			}),
		).toEqual({ success: false, reason: 'configuration' });
	});
});
