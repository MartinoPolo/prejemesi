import { pgEnum } from 'drizzle-orm/pg-core';
import { BACKGROUND_THEMES } from '$lib/components/base/theme/types.js';
import { SUPPORTED_LOCALES } from '$lib/i18n/locale.js';
import { WISHLIST_THEMES } from '$lib/modules/wishlists/types.js';
import { PALETTES } from '$lib/theme/palettes.js';

export const wishlistStatusEnum = pgEnum('wishlist_status', ['draft', 'active', 'archived']);

/**
 * Superseded by `paletteEnum` (Redesign 2026). Column kept in the DB for
 * rollback safety; no code reads it anymore.
 */
export const appBackgroundThemeEnum = pgEnum('app_background_theme', BACKGROUND_THEMES);

export const preferredLocaleEnum = pgEnum('preferred_locale', SUPPORTED_LOCALES);

/**
 * Superseded by `paletteEnum` (Redesign 2026). Column kept in the DB for
 * rollback safety; wishlist rows were migrated to `palette`.
 */
export const wishlistThemeEnum = pgEnum('wishlist_theme', WISHLIST_THEMES);

/** Redesign 2026 — the single theming system (user preference + wishlist identity). */
export const paletteEnum = pgEnum('palette', PALETTES);
