import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema.js';
import { wishlist } from './wishlist.schema.js';
import { gift } from './gift.schema.js';
import { generateId } from './id.js';
import type { NewGiftDigestPayload } from '$lib/modules/notifications/new_gift_digest.js';

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
		payload: jsonb('payload').$type<NewGiftDigestPayload>(),
		visibleAt: timestamp('visible_at', { withTimezone: true }),
		dedupeKey: text('dedupe_key'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		userUnreadIdx: index('notification_user_unread_idx')
			.on(table.userId)
			.where(sql`${table.read} = false`),
		createdAtIdx: index('notification_created_at_idx').on(table.createdAt),
		dedupeKeyUnique: uniqueIndex('notification_dedupe_key_unique')
			.on(table.dedupeKey)
			.where(sql`${table.dedupeKey} IS NOT NULL`),
	}),
);

export const newGiftDigestState = pgTable('new_gift_digest_state', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	activeNotificationId: text('active_notification_id').references(() => notification.id, {
		onDelete: 'set null',
	}),
	windowStartedAt: timestamp('window_started_at', { withTimezone: true }),
	windowEndsAt: timestamp('window_ends_at', { withTimezone: true }),
});
