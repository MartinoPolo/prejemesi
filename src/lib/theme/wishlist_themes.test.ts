import { describe, expect, it } from 'vitest';
import { PALETTES } from './palettes.js';
import { loadWishlistThemeArt } from './wishlist_theme_art/index.js';
import { wishlistThemeDescription, wishlistThemeName } from './wishlist_theme_messages.js';
import { WISHLIST_THEME_IDS, WISHLIST_THEMES } from './wishlist_themes.js';

describe('wishlist theme registry', () => {
	it('offers at least sixteen themes', () => {
		expect(new Set(WISHLIST_THEME_IDS).size).toBeGreaterThanOrEqual(16);
	});

	it.each(WISHLIST_THEME_IDS)('%s has a registry palette and a name and description', (id) => {
		expect(PALETTES).toContain(WISHLIST_THEMES[id].palette);
		expect(wishlistThemeName(id).trim()).not.toBe('');
		expect(wishlistThemeDescription(id).trim()).not.toBe('');
	});

	it.each(WISHLIST_THEME_IDS)('%s loads art whose placements use its motifs', async (id) => {
		const art = await loadWishlistThemeArt(id);
		expect(art.motifs.length).toBeGreaterThan(0);
		expect(art.placements.length).toBeGreaterThan(0);
		for (const placement of art.placements) {
			expect(art.motifs[placement.motif]).toEqual(expect.any(String));
		}
	});
});
