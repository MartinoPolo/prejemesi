import { index, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema.js';
import { wishlist } from './wishlist.schema.js';

export const wishlistFollower = pgTable(
	'wishlist_follower',
	{
		wishlistId: text('wishlist_id')
			.notNull()
			.references(() => wishlist.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		lastVisitedAt: timestamp('last_visited_at', { withTimezone: true }),
		unfollowedAt: timestamp('unfollowed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.wishlistId, table.userId] }),
		userActiveIdx: index('wishlist_follower_user_active_idx')
			.on(table.userId)
			.where(sql`${table.unfollowedAt} IS NULL`),
		userUnfollowedIdx: index('wishlist_follower_user_unfollowed_idx')
			.on(table.userId)
			.where(sql`${table.unfollowedAt} IS NOT NULL`),
	}),
);
