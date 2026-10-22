import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_FIT_MODES } from '$lib/components/derived/image-frame/index.js';
import type { WishlistImageSlots } from '$lib/modules/images/types.js';

const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string | undefined> }));

vi.mock('$env/dynamic/public', () => ({
	env: new Proxy(mockEnv, { get: (_target, property: string) => mockEnv[property] }),
}));

const { buildLandingSocialMetaTags, buildWishlistSocialMetaTags, landingPageUrl } =
	await import('./social_meta.js');

type MetaTags = ReturnType<typeof buildLandingSocialMetaTags>;

const PUBLIC_IMAGE_BASE = 'https://images.example.com';

const wishlistWithoutImage = {
	shortId: 'abc123',
	title: 'Vánoce 2026',
	recipientDisplayName: 'Rosie',
	imageKey: null,
	imageSlots: null,
};

function contentOf(tags: MetaTags, key: string): string | undefined {
	return tags.find((tag) => (tag.property ?? tag.name) === key)?.content;
}

function keysOf(tags: MetaTags): string[] {
	return tags.map((tag) => tag.property ?? tag.name ?? '');
}

beforeEach(() => {
	for (const key of Object.keys(mockEnv)) {
		delete mockEnv[key];
	}
});

describe('buildWishlistSocialMetaTags (issue #528)', () => {
	it('emits the complete Open Graph and Twitter set for a wishlist', () => {
		const tags = buildWishlistSocialMetaTags(wishlistWithoutImage, 'cs');

		expect(keysOf(tags)).toEqual(
			expect.arrayContaining([
				'og:site_name',
				'og:locale',
				'og:type',
				'og:url',
				'og:title',
				'og:description',
				'og:image',
				'og:image:width',
				'og:image:height',
				'og:image:alt',
				'twitter:card',
				'twitter:title',
				'twitter:description',
				'twitter:image',
				'twitter:image:alt',
			]),
		);
		expect(new Set(keysOf(tags)).size).toBe(tags.length);
		expect(contentOf(tags, 'og:site_name')).toBe('Přejeme si');
		expect(contentOf(tags, 'og:locale')).toBe('cs_CZ');
		expect(contentOf(tags, 'og:url')).toBe('https://prejemesi.cz/w/abc123');
		expect(contentOf(tags, 'og:title')).toBe('Vánoce 2026');
		expect(contentOf(tags, 'og:description')).toBe('Seznam přání pro Rosie');
		expect(contentOf(tags, 'twitter:card')).toBe('summary_large_image');
		expect(contentOf(tags, 'twitter:title')).toBe('Vánoce 2026');
	});

	it('falls back to the bundled branded 1200×630 image when the wishlist has none', () => {
		const tags = buildWishlistSocialMetaTags(wishlistWithoutImage, 'cs');
		const imageUrl = contentOf(tags, 'og:image')!;

		expect(imageUrl).toMatch(/^https:\/\/prejemesi\.cz\/.+social-preview.*\.png$/);
		expect(contentOf(tags, 'twitter:image')).toBe(imageUrl);
		expect(contentOf(tags, 'og:image:width')).toBe('1200');
		expect(contentOf(tags, 'og:image:height')).toBe('630');
	});

	it("uses the wishlist's social slot crop with its dimensions when an image is assigned", () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_IMAGE_BASE;
		const imageSlots: WishlistImageSlots = {
			social: { fitMode: IMAGE_FIT_MODES.coverCrop, focal: { x: 20, y: 80 }, zoom: 1 },
		};
		const tags = buildWishlistSocialMetaTags(
			{ ...wishlistWithoutImage, imageKey: 'wishlists/a.jpg', imageSlots },
			'cs',
		);

		expect(contentOf(tags, 'og:image')).toBe(
			`${PUBLIC_IMAGE_BASE}/cdn-cgi/image/width=1200,height=630,fit=cover,gravity=0.20x0.80,format=jpeg/wishlists/a.jpg`,
		);
		expect(contentOf(tags, 'og:image:width')).toBe('1200');
		expect(contentOf(tags, 'og:image:height')).toBe('630');
		expect(contentOf(tags, 'og:image:alt')).toBe('Vánoce 2026');
	});

	it('omits image dimensions and absolutizes the URL for an untransformed image', () => {
		const tags = buildWishlistSocialMetaTags(
			{ ...wishlistWithoutImage, imageKey: 'wishlists/a.jpg' },
			'cs',
		);

		expect(contentOf(tags, 'og:image')).toBe('https://prejemesi.cz/api/upload/wishlists/a.jpg');
		expect(contentOf(tags, 'og:image:width')).toBeUndefined();
		expect(contentOf(tags, 'og:image:height')).toBeUndefined();
	});

	it('localizes the English preview', () => {
		const tags = buildWishlistSocialMetaTags(wishlistWithoutImage, 'en');

		expect(contentOf(tags, 'og:locale')).toBe('en_US');
		expect(contentOf(tags, 'og:locale:alternate')).toBe('cs_CZ');
		expect(contentOf(tags, 'og:description')).toBe('Wishlist for Rosie');
	});
});

describe('buildLandingSocialMetaTags (issue #528)', () => {
	it('previews the landing page with the branded image and locale-specific URL', () => {
		const czechTags = buildLandingSocialMetaTags('cs');
		const englishTags = buildLandingSocialMetaTags('en');

		expect(contentOf(czechTags, 'og:url')).toBe('https://prejemesi.cz');
		expect(contentOf(englishTags, 'og:url')).toBe('https://prejemesi.cz/en');
		expect(landingPageUrl('en')).toBe('https://prejemesi.cz/en');
		expect(contentOf(czechTags, 'og:image')).toBe(
			contentOf(buildWishlistSocialMetaTags(wishlistWithoutImage, 'cs'), 'og:image'),
		);
		expect(contentOf(czechTags, 'og:image:width')).toBe('1200');
		expect(contentOf(czechTags, 'og:site_name')).toBe('Přejeme si');
		expect(contentOf(englishTags, 'og:locale')).toBe('en_US');
		expect(contentOf(englishTags, 'og:title')).not.toBe(contentOf(czechTags, 'og:title'));
	});
});
