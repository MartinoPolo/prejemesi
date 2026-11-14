import { tv } from 'tailwind-variants';

/**
 * Hero frames: the motif's or stored override's frame around the wishlist hero content.
 * The paper itself (notebook rules, kraft, tag shape, ribbon, flap) is drawn in
 * WishlistHeroFrame's scoped styles, which also set the `--hero-*` geometry these slots read.
 */
export const wishlistHeroFrameVariants = tv({
	slots: {
		face: 'relative flex items-center gap-6 pt-6 pr-(--hero-face-end) pb-6 pl-(--hero-face-start)',
		/** The Blok polaroid is drawn in WishlistHeader's styles; other frames add `photoTile`. */
		photo: 'reveal relative w-[132px] shrink-0 overflow-hidden border-(length:--border-w) border-edge',
		photoImage: 'relative aspect-square overflow-hidden',
		/** The shape of the flat photo tile, also the Vzhled preview's tile on every frame. */
		photoTile: 'rounded-[calc(var(--radius-panel)/2)]',
	},
	variants: {
		frame: {
			notebook: {
				photo: 'polaroid overflow-visible',
				photoImage: 'polaroid-img',
			},
			gift: { face: 'pt-[calc(var(--space-6)+var(--hero-band))]' },
			/** `rounded-full` follows the scope's pill radius, so Soft and Sharp corners square it. */
			tag: { photoTile: 'rounded-full' },
			invitation: { face: 'pt-[calc(var(--space-6)+var(--hero-flap))]' },
		},
	},
});
