import type { WishlistThemeId } from '../wishlist_themes.js';
import type { WishlistThemeArt } from './types.js';

export type { MotifPlacement, WishlistThemeArt } from './types.js';

/** One dynamic import per theme, so a wishlist page downloads only its own theme's art. */
const artLoaders = {
	toys: () => import('./toys.js'),
	kids_clothes: () => import('./kids_clothes.js'),
	gamer: () => import('./gamer.js'),
	minimal: () => import('./minimal.js'),
	wedding: () => import('./wedding.js'),
	christmas: () => import('./christmas.js'),
	outdoor: () => import('./outdoor.js'),
	books: () => import('./books.js'),
	baby: () => import('./baby.js'),
	retro: () => import('./retro.js'),
	party: () => import('./party.js'),
	space: () => import('./space.js'),
	music: () => import('./music.js'),
	pets: () => import('./pets.js'),
	gourmet: () => import('./gourmet.js'),
	travel: () => import('./travel.js'),
} satisfies Record<WishlistThemeId, () => Promise<WishlistThemeArt>>;

export async function loadWishlistThemeArt(id: WishlistThemeId): Promise<WishlistThemeArt> {
	const { motifs, placements } = await artLoaders[id]();
	return { motifs, placements };
}
