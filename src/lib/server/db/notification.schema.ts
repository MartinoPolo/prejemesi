import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema.js';
import { wishlist } from './wishlist.schema.js';
import { gift } from './gift.schema.js';
import { generateId } from './id.js';

export const notification = pgTable(
	'notification',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		wishlistId: text('wishlist_id').references(() => wishlist.id, { onDelete: 'set null' }),
		giftId: text('gift_id').references(() => gift.id, { onDelete: 'set null' }),
		actorId: text('actor_id').references(() => user.id),
		actorName: text('actor_name'),
		read: boolean('read').notNull().default(false),
		emailSent: boolean('email_sent').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		userUnreadIdx: index('notification_user_unread_idx')
			.on(table.userId)
			.where(sql`${table.read} = false`),
		createdAtIdx: index('notification_created_at_idx').on(table.createdAt),
	}),
);
