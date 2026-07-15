import { describe, it, expect } from 'vitest';
import { wishlistSocialDescription } from './social_description.js';

/**
 * OG/social description (2026-07-14 header decision): sentence form „Seznam přání pro
 * {name}" on ALL lists. The helper deliberately takes only the recipient display name —
 * no self/for-someone linkage parameter exists, so the form cannot diverge per list kind.
 */
describe('wishlistSocialDescription', () => {
	it('uses the Czech sentence form „Seznam přání pro {name}" (no colon in prose)', () => {
		expect(wishlistSocialDescription('Rosie', { locale: 'cs' })).toBe('Seznam přání pro Rosie');
	});

	it('uses the English sentence form "Wishlist for {name}"', () => {
		expect(wishlistSocialDescription('Rosie', { locale: 'en' })).toBe('Wishlist for Rosie');
	});

	it('never emits the colon header form („Pro: …" is header UI only)', () => {
		expect(wishlistSocialDescription('Rosie', { locale: 'cs' })).not.toContain('Pro:');
		expect(wishlistSocialDescription('Rosie', { locale: 'en' })).not.toContain('For:');
	});
});
