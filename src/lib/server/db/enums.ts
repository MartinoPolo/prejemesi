import { pgEnum } from 'drizzle-orm/pg-core';
import { SUPPORTED_LOCALES } from '$lib/i18n/locale.js';
import {
	WISHLIST_KINDS,
	WISHLIST_OCCASIONS,
	WISHLIST_THEMES,
} from '$lib/modules/wishlists/types.js';
import { GIFT_LINK_GROUP_KIND } from '$lib/modules/gifts/gift_link_group_kind.js';
import { PALETTES } from '$lib/theme/palettes.js';
import { DEPTH_STYLES } from '$lib/theme/depth_styles.js';
import { DARK_WISHLIST_BACKGROUNDS } from '$lib/theme/dark_wishlist_background.js';

export const giftLinkGroupKindEnum = pgEnum('gift_link_group_kind', [
	GIFT_LINK_GROUP_KIND.linkedCopies,
	GIFT_LINK_GROUP_KIND.sharedAcrossRecipients,
]);

export const wishlistStatusEnum = pgEnum('wishlist_status', ['draft', 'active', 'archived']);

export const wishlistKindEnum = pgEnum('wishlist_kind', WISHLIST_KINDS);

export const wishlistOccasionEnum = pgEnum('wishlist_occasion', WISHLIST_OCCASIONS);

/**
 * Superseded by `paletteEnum` (Redesign 2026). Column kept in the DB for
 * rollback safety; no code reads it anymore. Values inlined here (the former
 * `BACKGROUND_THEMES` constant + its UI were removed) so the enum DDL is stable.
 */
export const appBackgroundThemeEnum = pgEnum('app_background_theme', [
	'default',
	'golden-hour',
	'twilight',
]);

export const preferredLocaleEnum = pgEnum('preferred_locale', SUPPORTED_LOCALES);

/**
 * Superseded by `paletteEnum` (Redesign 2026). Column kept in the DB for
 * rollback safety; wishlist rows were migrated to `palette`.
 */
export const wishlistThemeEnum = pgEnum('wishlist_theme', WISHLIST_THEMES);

/** Redesign 2026 — the single theming system (user preference + wishlist identity). */
export const paletteEnum = pgEnum('palette', PALETTES);

/** Viewer-owned semantic sticker depth. */
export const depthStyleEnum = pgEnum('depth_style', DEPTH_STYLES);

/** Viewer-owned dark-mode page background behind a wishlist. */
export const darkWishlistBackgroundEnum = pgEnum(
	'dark_wishlist_background',
	DARK_WISHLIST_BACKGROUNDS,
);
