import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema.js';
import { wishlist } from './wishlist.schema.js';
import { generateId, generateToken } from './id.js';

export const moderatorAssignment = pgTable(
	'moderator_assignment',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		wishlistId: text('wishlist_id')
			.notNull()
			.references(() => wishlist.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		uniqueActiveAssignment: uniqueIndex('moderator_assignment_unique_active')
			.on(table.wishlistId, table.userId)
			.where(sql`${table.deletedAt} IS NULL`),
	}),
);

export const moderatorInvite = pgTable(
	'moderator_invite',
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
		wishlistIdx: index('moderator_invite_wishlist_idx').on(table.wishlistId),
	}),
);
