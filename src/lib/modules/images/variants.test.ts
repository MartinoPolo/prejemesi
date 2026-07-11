import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoisted mock state (available inside vi.mock factories) ─────────────────
const { mockEnv } = vi.hoisted(() => {
	const mockEnv: Record<string, string | undefined> = {};
	return { mockEnv };
});

vi.mock('$env/dynamic/public', () => ({
	env: new Proxy(mockEnv, {
		get: (_target, prop: string) => mockEnv[prop],
	}),
}));

import { transformedImageUrl, IMAGE_VARIANTS } from './variants.js';
import { imagePublicUrl, resolveUserImageUrl, isStoredObjectKey } from './public_url.js';

const PUBLIC_BASE = 'https://images.example.com';

beforeEach(() => {
	for (const key of Object.keys(mockEnv)) {
		delete mockEnv[key];
	}
});

describe('imagePublicUrl', () => {
	it('uses the public base when PUBLIC_R2_URL is set', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;
		expect(imagePublicUrl('gifts/a.jpg')).toBe(`${PUBLIC_BASE}/gifts/a.jpg`);
	});

	it('falls back to the upload API route in local dev', () => {
		expect(imagePublicUrl('gifts/a.jpg')).toBe('/api/upload/gifts/a.jpg');
	});
});

describe('isStoredObjectKey / resolveUserImageUrl', () => {
	it('detects object keys vs URLs', () => {
		expect(isStoredObjectKey('avatars/a.jpg')).toBe(true);
		expect(isStoredObjectKey('https://lh3.googleusercontent.com/x')).toBe(false);
		expect(isStoredObjectKey('/api/upload/avatars/a.jpg')).toBe(false);
	});

	it('resolves an avatar object key to the public URL', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;
		expect(resolveUserImageUrl('avatars/a.jpg')).toBe(`${PUBLIC_BASE}/avatars/a.jpg`);
	});

	it('passes external URLs through and maps empty to null', () => {
		expect(resolveUserImageUrl('https://example.com/pic.png')).toBe(
			'https://example.com/pic.png',
		);
		expect(resolveUserImageUrl(null)).toBeNull();
		expect(resolveUserImageUrl('')).toBeNull();
	});
});

describe('transformedImageUrl', () => {
	it('builds a /cdn-cgi/image/ URL with bounded width for R2-hosted images (REQ-3)', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(transformedImageUrl(`${PUBLIC_BASE}/gifts/a.jpg`, 'card')).toBe(
			`${PUBLIC_BASE}/cdn-cgi/image/width=${String(IMAGE_VARIANTS.card.width)},fit=scale-down,format=auto/gifts/a.jpg`,
		);
	});

	it('adds anim=false for GIF sources so cards load a still frame (REQ-5)', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(transformedImageUrl(`${PUBLIC_BASE}/gifts/a.GIF`, 'listThumb')).toBe(
			`${PUBLIC_BASE}/cdn-cgi/image/width=${String(IMAGE_VARIANTS.listThumb.width)},fit=scale-down,format=auto,anim=false/gifts/a.GIF`,
		);
	});

	it('returns the original for a null variant (detail views keep originals)', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;
		const src = `${PUBLIC_BASE}/gifts/a.gif`;

		expect(transformedImageUrl(src, null)).toBe(src);
	});

	it('passes external URLs through untouched', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;
		const external = 'https://cdn.alza.cz/products/x.jpg';

		expect(transformedImageUrl(external, 'card')).toBe(external);
	});

	it('passes local-dev proxy paths through untouched (no transformations in dev)', () => {
		expect(transformedImageUrl('/api/upload/gifts/a.jpg', 'card')).toBe(
			'/api/upload/gifts/a.jpg',
		);
	});

	it('handles null src', () => {
		expect(transformedImageUrl(null, 'card')).toBeNull();
	});
});
