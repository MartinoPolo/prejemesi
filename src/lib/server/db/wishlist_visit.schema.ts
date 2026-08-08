import { index, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.schema.js';
import { wishlist } from './wishlist.schema.js';

/**
 * Last-visit recency per (user, wishlist), powering the „Nedávné" row on /home (issue #225).
 *
 * `wishlistFollower.lastVisitedAt` only covers followers; owners and moderators have no
 * follower row, yet the Nedávné row mixes all three roles (own lists included). This table
 * records a visit for ANY authed viewer, keyed independently of follow state.
 */
export const wishlistVisit = pgTable(
	'wishlist_visit',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		wishlistId: text('wishlist_id')
			.notNull()
			.references(() => wishlist.id, { onDelete: 'cascade' }),
		lastVisitedAt: timestamp('last_visited_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.wishlistId] }),
		userIdx: index('wishlist_visit_user_idx').on(table.userId),
	}),
);
