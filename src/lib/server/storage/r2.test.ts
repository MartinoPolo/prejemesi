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

// ── Mock $env/dynamic/private ───────────────────────────────────────────────
vi.mock('$env/dynamic/private', () => ({
	env: new Proxy(mockEnv, {
		get: (_target, prop: string) => mockEnv[prop],
	}),
}));

import { isAllowedContentType, getPublicUrl } from './r2.js';

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
	it('returns {R2_PUBLIC_URL}/{key} when env var is set', () => {
		mockEnv['R2_PUBLIC_URL'] = 'https://cdn.example.com';

		expect(getPublicUrl('gifts/abc123.jpg')).toBe('https://cdn.example.com/gifts/abc123.jpg');
	});

	it('strips trailing slash from R2_PUBLIC_URL', () => {
		mockEnv['R2_PUBLIC_URL'] = 'https://cdn.example.com/';

		expect(getPublicUrl('gifts/abc123.jpg')).toBe('https://cdn.example.com/gifts/abc123.jpg');
	});

	it('returns /api/upload/{key} when R2_PUBLIC_URL is not set', () => {
		// mockEnv has no R2_PUBLIC_URL

		expect(getPublicUrl('gifts/abc123.jpg')).toBe('/api/upload/gifts/abc123.jpg');
	});

	it('returns /api/upload/{key} when R2_PUBLIC_URL is empty string', () => {
		mockEnv['R2_PUBLIC_URL'] = '';

		expect(getPublicUrl('gifts/abc123.jpg')).toBe('/api/upload/gifts/abc123.jpg');
	});
});
