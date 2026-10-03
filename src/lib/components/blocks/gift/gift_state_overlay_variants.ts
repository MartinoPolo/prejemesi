import { tv } from 'tailwind-variants';
import type { GiftOverlayKind } from '$lib/modules/gifts/gift_display_state.js';
import { badgeShape } from '$lib/components/base/badge/index.js';

const giftStateBadgeKinds = {
	received: 'bg-primary text-primary-foreground [text-shadow:0_1px_1px_var(--ink)]',
	'own-reservation': 'bg-(--gift-overlay-own-reservation) text-white',
	'own-purchased': 'bg-(--gift-overlay-bought) text-white',
	unavailable: 'bg-(--gift-overlay-unavailable) text-white',
	partial: 'bg-card text-foreground',
} satisfies Record<GiftOverlayKind, string>;

/**
 * Gift state badges over images: solid, level, static ordinary shadow and the shared badge radius.
 * Each state owns a distinct theme fill so ownership, purchase and availability read apart.
 */
export const giftStateBadgeVariants = tv({
	base: [
		badgeShape,
		'max-w-[calc(100%_-_0.5rem)] border-ink px-2 py-1 text-center text-xs leading-4 font-bold shadow-sticker [overflow-wrap:anywhere] sm:px-3 sm:py-1.5',
	],
	variants: {
		kind: giftStateBadgeKinds,
	},
});
