import { pgEnum } from 'drizzle-orm/pg-core';
import { BACKGROUND_THEMES } from '$lib/components/base/theme/types.js';
import { WISHLIST_THEMES } from '$lib/modules/wishlists/types.js';

export const wishlistStatusEnum = pgEnum('wishlist_status', ['draft', 'active', 'archived']);

/** User-level app background theme preference (REQ-3). Reuses the canonical token list. */
export const appBackgroundThemeEnum = pgEnum('app_background_theme', BACKGROUND_THEMES);

/** Reuses the canonical wishlist theme list so the enum can never drift from it. */
export const wishlistThemeEnum = pgEnum('wishlist_theme', WISHLIST_THEMES);
