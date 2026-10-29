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

import {
	responsiveImageSource,
	ladderWidthFor,
	socialCropImageUrl,
	IMAGE_TRANSFORM_WIDTHS,
	OG_IMAGE_WIDTH,
	OG_IMAGE_HEIGHT,
} from './variants.js';
import {
	imagePublicUrl,
	resolveGiftImageUrl,
	resolveUserImageUrl,
	isStoredObjectKey,
} from './public_url.js';

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

describe('resolveGiftImageUrl', () => {
	it('resolves the stored key through PUBLIC_R2_URL before a raw retailer URL', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(resolveGiftImageUrl('https://shop.example/image.jpg', 'gifts/a.jpg')).toBe(
			`${PUBLIC_BASE}/gifts/a.jpg`,
		);
	});

	it('falls back to the raw retailer URL when no stored key exists', () => {
		expect(resolveGiftImageUrl('https://shop.example/image.jpg', null)).toBe(
			'https://shop.example/image.jpg',
		);
	});

	it('returns null when neither image source exists', () => {
		expect(resolveGiftImageUrl(null, null)).toBeNull();
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

describe('responsiveImageSource', () => {
	const transform = (width: number, path = 'gifts/a.jpg', extra = '') =>
		`${PUBLIC_BASE}/cdn-cgi/image/width=${String(width)},fit=scale-down,format=auto${extra}/${path}`;

	it('offers the bounded width ladder as srcset and declares the painted CSS width', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		const source = responsiveImageSource(`${PUBLIC_BASE}/gifts/a.jpg`, 'card', 225);

		expect(source?.srcset).toBe(
			IMAGE_TRANSFORM_WIDTHS.map((width) => `${transform(width)} ${String(width)}w`).join(
				', ',
			),
		);
		expect(source?.sizes).toBe('225px');
	});

	it('falls back to a src covering the painted width on a 2x display', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(responsiveImageSource(`${PUBLIC_BASE}/gifts/a.jpg`, 'banner', 225)?.src).toBe(
			transform(480),
		);
	});

	it('rounds fractional painted widths up so the browser never under-selects', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(responsiveImageSource(`${PUBLIC_BASE}/gifts/a.jpg`, 'card', 150.2)?.sizes).toBe(
			'151px',
		);
	});

	it('adds anim=false for GIF sources so cards load a still frame (REQ-5)', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		const source = responsiveImageSource(`${PUBLIC_BASE}/gifts/a.GIF`, 'listThumb', 120);

		expect(source?.src).toBe(transform(320, 'gifts/a.GIF', ',anim=false'));
		expect(source?.srcset).not.toMatch(/format=auto\/gifts/);
	});

	it('returns null for a null variant (the Gift viewer keeps originals)', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(responsiveImageSource(`${PUBLIC_BASE}/gifts/a.gif`, null, 300)).toBeNull();
	});

	it('returns null for external URLs, local-dev proxy paths, and missing sources', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(responsiveImageSource('https://cdn.alza.cz/products/x.jpg', 'card', 300)).toBeNull();
		expect(responsiveImageSource(null, 'card', 300)).toBeNull();
		delete mockEnv['PUBLIC_R2_URL'];
		expect(responsiveImageSource('/api/upload/gifts/a.jpg', 'card', 300)).toBeNull();
	});
});

describe('ladderWidthFor', () => {
	it('picks the smallest rung delivering at least the required pixels', () => {
		expect(ladderWidthFor(1)).toBe(IMAGE_TRANSFORM_WIDTHS[0]);
		expect(ladderWidthFor(320)).toBe(320);
		expect(ladderWidthFor(321)).toBe(480);
	});

	it('caps at the top rung', () => {
		expect(ladderWidthFor(10_000)).toBe(IMAGE_TRANSFORM_WIDTHS.at(-1));
	});
});

describe('socialCropImageUrl', () => {
	it('builds a fixed 1200x630 cover crop with gravity from the focal point (issue #117)', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(socialCropImageUrl(`${PUBLIC_BASE}/wishlists/a.jpg`, { x: 25, y: 75 })).toBe(
			`${PUBLIC_BASE}/cdn-cgi/image/width=${String(OG_IMAGE_WIDTH)},height=${String(OG_IMAGE_HEIGHT)},fit=cover,gravity=0.25x0.75,format=jpeg/wishlists/a.jpg`,
		);
	});

	it('defaults to a centered gravity for an unset (centered) focal point', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(socialCropImageUrl(`${PUBLIC_BASE}/wishlists/a.jpg`, { x: 50, y: 50 })).toBe(
			`${PUBLIC_BASE}/cdn-cgi/image/width=${String(OG_IMAGE_WIDTH)},height=${String(OG_IMAGE_HEIGHT)},fit=cover,gravity=0.50x0.50,format=jpeg/wishlists/a.jpg`,
		);
	});

	it('clamps out-of-range focal percentages into 0..1 gravity fractions', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(socialCropImageUrl(`${PUBLIC_BASE}/wishlists/a.jpg`, { x: -10, y: 140 })).toBe(
			`${PUBLIC_BASE}/cdn-cgi/image/width=${String(OG_IMAGE_WIDTH)},height=${String(OG_IMAGE_HEIGHT)},fit=cover,gravity=0.00x1.00,format=jpeg/wishlists/a.jpg`,
		);
	});

	it('adds anim=false for GIF sources', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(socialCropImageUrl(`${PUBLIC_BASE}/wishlists/a.GIF`, { x: 50, y: 50 })).toBe(
			`${PUBLIC_BASE}/cdn-cgi/image/width=${String(OG_IMAGE_WIDTH)},height=${String(OG_IMAGE_HEIGHT)},fit=cover,gravity=0.50x0.50,format=jpeg,anim=false/wishlists/a.GIF`,
		);
	});

	it('passes external URLs through untouched', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;
		const external = 'https://cdn.alza.cz/products/x.jpg';

		expect(socialCropImageUrl(external, { x: 50, y: 50 })).toBe(external);
	});

	it('passes local-dev proxy paths through untouched (no transformations in dev)', () => {
		expect(socialCropImageUrl('/api/upload/wishlists/a.jpg', { x: 50, y: 50 })).toBe(
			'/api/upload/wishlists/a.jpg',
		);
	});

	it('handles null src', () => {
		expect(socialCropImageUrl(null, { x: 50, y: 50 })).toBeNull();
	});
});
