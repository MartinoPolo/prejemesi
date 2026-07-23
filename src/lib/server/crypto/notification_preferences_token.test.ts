import { describe, it, expect } from 'vitest';
import {
	createNotificationPreferencesToken,
	verifyNotificationPreferencesToken,
	NOTIFICATION_PREFERENCES_TOKEN_EXPIRY_MS,
} from './notification_preferences_token.js';

const TEST_SECRET = 'test-secret-for-hmac-signing';
const TEST_USER_ID = 'user-42';

describe('notification preferences token HMAC', () => {
	it('round-trips – verify returns the userId that was signed', async () => {
		const { token } = await createNotificationPreferencesToken(TEST_USER_ID, TEST_SECRET);
		const result = await verifyNotificationPreferencesToken(token, TEST_SECRET);

		expect(result).toEqual({ userId: TEST_USER_ID });
	});

	it('uses a long default expiry (365 days)', async () => {
		const before = Date.now();
		const { expiresAt } = await createNotificationPreferencesToken(TEST_USER_ID, TEST_SECRET);
		const after = Date.now();

		expect(expiresAt).toBeGreaterThanOrEqual(before + NOTIFICATION_PREFERENCES_TOKEN_EXPIRY_MS);
		expect(expiresAt).toBeLessThanOrEqual(after + NOTIFICATION_PREFERENCES_TOKEN_EXPIRY_MS);
	});

	it('rejects a token tampered in the payload', async () => {
		const { token } = await createNotificationPreferencesToken(TEST_USER_ID, TEST_SECRET);
		const [, signature] = token.split('.');

		const tamperedPayload = btoa(
			JSON.stringify({
				userId: 'someone-else',
				purpose: 'notification-preferences',
				expiresAt: 999,
			}),
		)
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/g, '');

		const result = await verifyNotificationPreferencesToken(
			`${tamperedPayload}.${signature}`,
			TEST_SECRET,
		);
		expect(result).toBeNull();
	});

	it('rejects a token tampered in the signature', async () => {
		const { token } = await createNotificationPreferencesToken(TEST_USER_ID, TEST_SECRET);
		const [payload, signature] = token.split('.');
		const tamperedSignature = signature.slice(0, -4) + 'XXXX';

		const result = await verifyNotificationPreferencesToken(
			`${payload}.${tamperedSignature}`,
			TEST_SECRET,
		);
		expect(result).toBeNull();
	});

	it('rejects a token signed with a different secret', async () => {
		const { token } = await createNotificationPreferencesToken(TEST_USER_ID, TEST_SECRET);
		const result = await verifyNotificationPreferencesToken(token, 'wrong-secret');
		expect(result).toBeNull();
	});

	it('rejects an expired token', async () => {
		const { token } = await createNotificationPreferencesToken(
			TEST_USER_ID,
			TEST_SECRET,
			-1000,
		);
		const result = await verifyNotificationPreferencesToken(token, TEST_SECRET);
		expect(result).toBeNull();
	});

	it('rejects a wrong-purpose token (e.g. an upload token) even with the right secret', async () => {
		const { createUploadToken } = await import('./upload_token.js');
		const { token } = await createUploadToken('gifts/abc.jpg', TEST_USER_ID, TEST_SECRET);

		const result = await verifyNotificationPreferencesToken(token, TEST_SECRET);
		expect(result).toBeNull();
	});

	it('rejects a malformed token without a dot separator', async () => {
		const result = await verifyNotificationPreferencesToken('nodothere', TEST_SECRET);
		expect(result).toBeNull();
	});

	it('rejects a completely empty string', async () => {
		const result = await verifyNotificationPreferencesToken('', TEST_SECRET);
		expect(result).toBeNull();
	});
});
