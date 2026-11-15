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
import {
	agentImageStorage,
	deleteObjectsBestEffort,
	getPublicUrl,
	isAllowedContentType,
	putObject,
	type AgentImageBucket,
} from './r2.js';

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

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

describe('server-side puts', () => {
	it('store an upload with its content type and a long-lived immutable cache policy', async () => {
		const put = vi.fn(async () => null);
		vi.mocked(getRequestEvent).mockReturnValueOnce({
			platform: { env: { R2: { put } } },
		} as unknown as ReturnType<typeof getRequestEvent>);
		const body = Uint8Array.from([1, 2, 3]);

		await expect(putObject('gifts/abc.webp', body, 'image/webp')).resolves.toBe(true);

		expect(put).toHaveBeenCalledExactlyOnceWith('gifts/abc.webp', body, {
			httpMetadata: { contentType: 'image/webp', cacheControl: IMMUTABLE_CACHE_CONTROL },
		});
	});

	it('store an agent image with the same cache policy', async () => {
		const put = vi.fn<AgentImageBucket['put']>(async () => null);
		const storage = agentImageStorage({ put, delete: vi.fn(async () => {}) });
		const body = Uint8Array.from([4]);

		await storage.put('gifts/agent/list/abc.png', body, 'image/png');

		expect(put).toHaveBeenCalledExactlyOnceWith('gifts/agent/list/abc.png', body, {
			httpMetadata: { contentType: 'image/png', cacheControl: IMMUTABLE_CACHE_CONTROL },
		});
	});
});

describe('deleteObjectsBestEffort', () => {
	it('deletes only stored object keys, never prepared static paths or external URLs', async () => {
		const deleteObjects = vi.fn(async () => {});
		vi.mocked(getRequestEvent).mockReturnValueOnce({
			platform: { env: { R2: { delete: deleteObjects } } },
		} as unknown as ReturnType<typeof getRequestEvent>);

		await deleteObjectsBestEffort([
			'wishlists/banners/abc.jpg',
			'/demo/v1/wishlists/my-everyday.webp',
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

		await deleteObjectsBestEffort(['/demo/v1/wishlists/my-everyday.webp']);

		expect(deleteObjects).not.toHaveBeenCalled();
	});
});
