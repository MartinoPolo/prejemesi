import {
	boolean,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { AgentScope } from '$lib/modules/access_tokens/scopes.js';
import { user } from './auth.schema.js';
import { wishlist } from './wishlist.schema.js';
import { generateId } from './id.js';
import { cascadingReferenceColumn } from './columns.js';

/**
 * A credential that lets the user's agent act as them. Only the SHA-256 hash of the value is
 * stored; deleting the user deletes their tokens, which revokes them.
 */
export const personalAccessToken = pgTable(
	'personal_access_token',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: cascadingReferenceColumn('user_id', () => user.id),
		name: text('name').notNull(),
		tokenPrefix: text('token_prefix').notNull(),
		tokenHash: text('token_hash').notNull(),
		scopes: text('scopes').array().$type<AgentScope[]>().notNull(),
		// Explicit, so a restricted token whose wishlists were all deleted never reaches every wishlist.
		restrictedToWishlists: boolean('restricted_to_wishlists').notNull().default(false),
		fastForward: boolean('fast_forward').notNull().default(false),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		rolledAt: timestamp('rolled_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
	},
	(table) => ({
		tokenHashUnique: uniqueIndex('personal_access_token_hash_unique').on(table.tokenHash),
		userIdx: index('personal_access_token_user_idx').on(table.userId),
	}),
);

/** The wishlists a restricted token is limited to. */
export const personalAccessTokenWishlist = pgTable(
	'personal_access_token_wishlist',
	{
		tokenId: cascadingReferenceColumn('token_id', () => personalAccessToken.id),
		wishlistId: cascadingReferenceColumn('wishlist_id', () => wishlist.id),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.tokenId, table.wishlistId] }),
		wishlistIdx: index('personal_access_token_wishlist_wishlist_idx').on(table.wishlistId),
	}),
);
