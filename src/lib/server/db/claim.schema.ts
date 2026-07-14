import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from './auth.schema.js';
import { wishlist } from './wishlist.schema.js';
import { generateId, generateToken } from './id.js';

/**
 * Claim invite (issue #150): a token link („Pozvat obdarovaného") a správce generates so a
 * free-text recipient's real account can claim the list. Mirrors `moderator_invite` column
 * semantics (token, wishlist, creator, usedBy, revocation/expiry) — accepting sets the
 * claimer as the linked recipient and clears the free-text name.
 */
export const claimInvite = pgTable(
	'claim_invite',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		wishlistId: text('wishlist_id')
			.notNull()
			.references(() => wishlist.id, { onDelete: 'cascade' }),
		token: text('token')
			.notNull()
			.unique()
			.$defaultFn(() => generateToken()),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id),
		usedByUserId: text('used_by_user_id').references(() => user.id),
		usedAt: timestamp('used_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		wishlistIdx: index('claim_invite_wishlist_idx').on(table.wishlistId),
	}),
);
