import { describe, it, expect } from 'vitest';
import { createUploadToken, verifyUploadToken, UPLOAD_TOKEN_EXPIRY_MS } from './upload_token.js';

const TEST_SECRET = 'test-secret-for-hmac-signing';
const TEST_OBJECT_KEY = 'gifts/abc123.jpg';
const TEST_USER_ID = 'user-42';

describe('upload token HMAC', () => {
	describe('createUploadToken', () => {
		it('returns a token string and expiresAt timestamp', async () => {
			const result = await createUploadToken(TEST_OBJECT_KEY, TEST_USER_ID, TEST_SECRET);

			expect(result.token).toBeTypeOf('string');
			expect(result.token).toContain('.');
			expect(result.expiresAt).toBeTypeOf('number');
			expect(result.expiresAt).toBeGreaterThan(Date.now());
		});

		it('uses default 15-minute expiry', async () => {
			const before = Date.now();
			const result = await createUploadToken(TEST_OBJECT_KEY, TEST_USER_ID, TEST_SECRET);
			const after = Date.now();

			expect(result.expiresAt).toBeGreaterThanOrEqual(before + UPLOAD_TOKEN_EXPIRY_MS);
			expect(result.expiresAt).toBeLessThanOrEqual(after + UPLOAD_TOKEN_EXPIRY_MS);
		});

		it('respects custom expiry', async () => {
			const before = Date.now();
			const customExpiry = 5 * 60 * 1000;
			const result = await createUploadToken(
				TEST_OBJECT_KEY,
				TEST_USER_ID,
				TEST_SECRET,
				customExpiry,
			);

			expect(result.expiresAt).toBeGreaterThanOrEqual(before + customExpiry);
			expect(result.expiresAt).toBeLessThanOrEqual(Date.now() + customExpiry);
		});
	});

	describe('verifyUploadToken', () => {
		it('round-trips correctly — verified payload matches input', async () => {
			const { token } = await createUploadToken(TEST_OBJECT_KEY, TEST_USER_ID, TEST_SECRET);
			const payload = await verifyUploadToken(token, TEST_SECRET);

			expect(payload.objectKey).toBe(TEST_OBJECT_KEY);
			expect(payload.userId).toBe(TEST_USER_ID);
			expect(payload.expiresAt).toBeTypeOf('number');
		});

		it('rejects a token signed with a different secret', async () => {
			const { token } = await createUploadToken(TEST_OBJECT_KEY, TEST_USER_ID, TEST_SECRET);

			await expect(verifyUploadToken(token, 'wrong-secret')).rejects.toThrow(
				'Invalid upload token signature',
			);
		});

		it('rejects a token with tampered payload', async () => {
			const { token } = await createUploadToken(TEST_OBJECT_KEY, TEST_USER_ID, TEST_SECRET);
			const signature = token.split('.')[1];

			const tamperedPayload = btoa(
				JSON.stringify({
					objectKey: 'evil/path.jpg',
					userId: TEST_USER_ID,
					expiresAt: 999,
				}),
			)
				.replace(/\+/g, '-')
				.replace(/\//g, '_')
				.replace(/=+$/g, '');

			await expect(
				verifyUploadToken(`${tamperedPayload}.${signature}`, TEST_SECRET),
			).rejects.toThrow('Invalid upload token signature');
		});

		it('rejects a token with tampered signature', async () => {
			const { token } = await createUploadToken(TEST_OBJECT_KEY, TEST_USER_ID, TEST_SECRET);
			const [payload, signature] = token.split('.');

			const tamperedSignature = signature.slice(0, -4) + 'XXXX';

			await expect(
				verifyUploadToken(`${payload}.${tamperedSignature}`, TEST_SECRET),
			).rejects.toThrow('Invalid upload token signature');
		});

		it('rejects a malformed token without a dot separator', async () => {
			await expect(verifyUploadToken('nodothere', TEST_SECRET)).rejects.toThrow(
				'Malformed upload token',
			);
		});

		it('rejects an empty payload part', async () => {
			await expect(verifyUploadToken('.signature', TEST_SECRET)).rejects.toThrow(
				'Malformed upload token',
			);
		});

		it('rejects an empty signature part', async () => {
			await expect(verifyUploadToken('payload.', TEST_SECRET)).rejects.toThrow(
				'Malformed upload token',
			);
		});

		it('rejects a completely empty string', async () => {
			await expect(verifyUploadToken('', TEST_SECRET)).rejects.toThrow(
				'Malformed upload token',
			);
		});
	});
});
