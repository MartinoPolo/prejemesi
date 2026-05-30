import { pgEnum } from 'drizzle-orm/pg-core';

export const wishlistStatusEnum = pgEnum('wishlist_status', ['draft', 'active', 'archived']);

export const wishlistThemeEnum = pgEnum('wishlist_theme', [
	'default',
	'christmas',
	'birthday',
	'fun',
	'elegant',
	'custom',
]);
