import * as m from '$lib/paraglide/messages.js';
import type { WishlistThemeId } from './wishlist_themes.js';

interface WishlistThemeMessages {
	name: () => string;
	description: () => string;
}

const WISHLIST_THEME_MESSAGES = {
	toys: { name: m.wishlist_theme_toys_name, description: m.wishlist_theme_toys_description },
	kids_clothes: {
		name: m.wishlist_theme_kids_clothes_name,
		description: m.wishlist_theme_kids_clothes_description,
	},
	gamer: { name: m.wishlist_theme_gamer_name, description: m.wishlist_theme_gamer_description },
	minimal: {
		name: m.wishlist_theme_minimal_name,
		description: m.wishlist_theme_minimal_description,
	},
	wedding: {
		name: m.wishlist_theme_wedding_name,
		description: m.wishlist_theme_wedding_description,
	},
	christmas: {
		name: m.wishlist_theme_christmas_name,
		description: m.wishlist_theme_christmas_description,
	},
	outdoor: {
		name: m.wishlist_theme_outdoor_name,
		description: m.wishlist_theme_outdoor_description,
	},
	books: { name: m.wishlist_theme_books_name, description: m.wishlist_theme_books_description },
	baby: { name: m.wishlist_theme_baby_name, description: m.wishlist_theme_baby_description },
	retro: { name: m.wishlist_theme_retro_name, description: m.wishlist_theme_retro_description },
	party: { name: m.wishlist_theme_party_name, description: m.wishlist_theme_party_description },
	space: { name: m.wishlist_theme_space_name, description: m.wishlist_theme_space_description },
	music: { name: m.wishlist_theme_music_name, description: m.wishlist_theme_music_description },
	pets: { name: m.wishlist_theme_pets_name, description: m.wishlist_theme_pets_description },
	gourmet: {
		name: m.wishlist_theme_gourmet_name,
		description: m.wishlist_theme_gourmet_description,
	},
	travel: {
		name: m.wishlist_theme_travel_name,
		description: m.wishlist_theme_travel_description,
	},
} satisfies Record<WishlistThemeId, WishlistThemeMessages>;

/** The localized theme name in the current locale. */
export function wishlistThemeName(themeId: WishlistThemeId): string {
	return WISHLIST_THEME_MESSAGES[themeId].name();
}

/** The localized one-line audience description in the current locale. */
export function wishlistThemeDescription(themeId: WishlistThemeId): string {
	return WISHLIST_THEME_MESSAGES[themeId].description();
}
