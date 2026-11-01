import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoisted mock state (available inside vi.mock factories) ─────────────────
const { mockEnv } = vi.hoisted(() => {
	const mockEnv: Record<string, string | undefined> = {};
	return { mockEnv };
});

// ── Mock $app/server ────────────────────────────────────────────────────────
vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => ({
		platform: { env: { R2: undefined } },
	})),
}));

// ── Mock $env/dynamic/public (getPublicUrl resolves via PUBLIC_R2_URL) ──────
vi.mock('$env/dynamic/public', () => ({
	env: new Proxy(mockEnv, {
		get: (_target, prop: string) => mockEnv[prop],
	}),
}));

import { getRequestEvent } from '$app/server';
import { deleteObjectsBestEffort, isAllowedContentType, getPublicUrl } from './r2.js';

beforeEach(() => {
	vi.clearAllMocks();
	// Reset env between tests
	for (const key of Object.keys(mockEnv)) {
		delete mockEnv[key];
	}
});

describe('isAllowedContentType', () => {
	it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])(
		'returns true for %s',
		(contentType) => {
			expect(isAllowedContentType(contentType)).toBe(true);
		},
	);

	it.each(['application/pdf', 'text/html', 'image/svg+xml', 'video/mp4'])(
		'returns false for %s',
		(contentType) => {
			expect(isAllowedContentType(contentType)).toBe(false);
		},
	);
});

describe('getPublicUrl', () => {
	it('returns {PUBLIC_R2_URL}/{key} when env var is set', () => {
		mockEnv['PUBLIC_R2_URL'] = 'https://cdn.example.com';

		expect(getPublicUrl('gifts/abc123.jpg')).toBe('https://cdn.example.com/gifts/abc123.jpg');
	});

	it('strips trailing slash from PUBLIC_R2_URL', () => {
		mockEnv['PUBLIC_R2_URL'] = 'https://cdn.example.com/';

		expect(getPublicUrl('gifts/abc123.jpg')).toBe('https://cdn.example.com/gifts/abc123.jpg');
	});

	it.each([undefined, ''])(
		'returns the same-origin upload URL when PUBLIC_R2_URL is %s',
		(publicUrl) => {
			mockEnv['PUBLIC_R2_URL'] = publicUrl;

			expect(getPublicUrl('gifts/abc123.jpg')).toBe('/api/upload/gifts/abc123.jpg');
		},
	);
});

describe('deleteObjectsBestEffort', () => {
	it('deletes only stored object keys, never prepared static paths or external URLs', async () => {
		const deleteObjects = vi.fn(async () => {});
		vi.mocked(getRequestEvent).mockReturnValueOnce({
			platform: { env: { R2: { delete: deleteObjects } } },
		} as unknown as ReturnType<typeof getRequestEvent>);

		await deleteObjectsBestEffort([
			'wishlists/banners/abc.jpg',
			'/demo/wishlists/my-everyday.webp',
			'https://lh3.googleusercontent.com/avatar.jpg',
			null,
			'',
		]);

		expect(deleteObjects).toHaveBeenCalledExactlyOnceWith(['wishlists/banners/abc.jpg']);
	});

	it('skips the bucket call when only static paths remain', async () => {
		const deleteObjects = vi.fn(async () => {});
		vi.mocked(getRequestEvent).mockReturnValueOnce({
			platform: { env: { R2: { delete: deleteObjects } } },
		} as unknown as ReturnType<typeof getRequestEvent>);

		await deleteObjectsBestEffort(['/demo/wishlists/my-everyday.webp']);

		expect(deleteObjects).not.toHaveBeenCalled();
	});
});
