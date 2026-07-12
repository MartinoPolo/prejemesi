/**
 * Emoji shown for a wishlist that has no cover image (REQ-3 fallback hero,
 * dashboard cards, navbar dropdown thumbnails).
 *
 * The visual theming of a wishlist is now the palette system (Redesign 2026);
 * the retained `theme` column (kept for rollback safety) still carries the
 * historical preset name for existing rows, which we map to a representative
 * emoji. New rows default to `default` → 🎁.
 */
const THEME_EMOJI: Record<string, string> = {
	default: '🎁',
	christmas: '🎄',
	birthday: '🎂',
	fun: '🎉',
	elegant: '💍',
	custom: '✨',
};

/** Representative fallback emoji for a wishlist's (retained) theme value. */
export function getWishlistEmoji(theme: string): string {
	return THEME_EMOJI[theme] ?? THEME_EMOJI.default;
}
