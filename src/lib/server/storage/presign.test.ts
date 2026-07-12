import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoisted mock state (available inside vi.mock factories) ─────────────────
const { mockEnv } = vi.hoisted(() => {
	const mockEnv: Record<string, string | undefined> = {};
	return { mockEnv };
});

vi.mock('$env/dynamic/private', () => ({
	env: new Proxy(mockEnv, {
		get: (_target, prop: string) => mockEnv[prop],
	}),
}));

import {
	presignUploadUrl,
	isPresignConfigured,
	PRESIGNED_UPLOAD_EXPIRY_SECONDS,
} from './presign.js';

function setPresignEnv() {
	mockEnv['R2_ACCOUNT_ID'] = 'test-account-id';
	mockEnv['R2_BUCKET_NAME'] = 'test-bucket';
	mockEnv['R2_ACCESS_KEY_ID'] = 'test-access-key';
	mockEnv['R2_SECRET_ACCESS_KEY'] = 'test-secret-key';
}

const TEST_INPUT = {
	objectKey: 'gifts/abc123.jpg',
	contentType: 'image/jpeg',
	contentLength: 1024,
};

beforeEach(() => {
	for (const key of Object.keys(mockEnv)) {
		delete mockEnv[key];
	}
});

describe('isPresignConfigured', () => {
	it('is false when credentials are missing', () => {
		expect(isPresignConfigured()).toBe(false);
	});

	it('is false when any single credential is empty', () => {
		setPresignEnv();
		mockEnv['R2_SECRET_ACCESS_KEY'] = '';
		expect(isPresignConfigured()).toBe(false);
	});

	it('is true when all credentials are set', () => {
		setPresignEnv();
		expect(isPresignConfigured()).toBe(true);
	});
});

describe('presignUploadUrl', () => {
	it('returns null when credentials are not configured', async () => {
		expect(await presignUploadUrl(TEST_INPUT)).toBeNull();
	});

	it('signs a PUT URL against the account S3 endpoint with the exact object key', async () => {
		setPresignEnv();
		const url = new URL((await presignUploadUrl(TEST_INPUT))!);

		expect(url.origin).toBe('https://test-account-id.r2.cloudflarestorage.com');
		expect(url.pathname).toBe('/test-bucket/gifts/abc123.jpg');
	});

	it('binds expiry, content-type, and content-length into the signature (REQ-7)', async () => {
		setPresignEnv();
		const url = new URL((await presignUploadUrl(TEST_INPUT))!);

		expect(url.searchParams.get('X-Amz-Expires')).toBe(String(PRESIGNED_UPLOAD_EXPIRY_SECONDS));
		expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
		expect(url.searchParams.get('X-Amz-Credential')).toContain('test-access-key');

		const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders') ?? '';
		expect(signedHeaders).toContain('content-type');
		expect(signedHeaders).toContain('content-length');
		expect(signedHeaders).toContain('host');
	});

	it('produces a different signature for a different object key', async () => {
		setPresignEnv();
		const first = new URL((await presignUploadUrl(TEST_INPUT))!);
		const second = new URL(
			(await presignUploadUrl({ ...TEST_INPUT, objectKey: 'gifts/other.jpg' }))!,
		);

		expect(first.searchParams.get('X-Amz-Signature')).not.toBe(
			second.searchParams.get('X-Amz-Signature'),
		);
	});
});
