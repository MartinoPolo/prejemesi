import { boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema.js';
import { wishlistStatusEnum, wishlistThemeEnum } from './enums.js';
import { generateId } from './id.js';

export const wishlist = pgTable(
	'wishlist',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description'),
		eventDate: timestamp('event_date', { withTimezone: true }),
		status: wishlistStatusEnum('status').notNull().default('draft'),
		theme: wishlistThemeEnum('theme').notNull().default('default'),
		customThemeColor: text('custom_theme_color'),
		bannerImageKey: text('banner_image_key'),
		thumbnailImageKey: text('thumbnail_image_key'),
		ownerIsModerator: boolean('owner_is_moderator').notNull().default(false),
		sharedAt: timestamp('shared_at', { withTimezone: true }),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		ownerStatusIdx: index('wishlist_owner_status_idx')
			.on(table.ownerId, table.status)
			.where(sql`${table.deletedAt} IS NULL`),
	}),
);

export const priorityLevel = pgTable(
	'priority_level',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		wishlistId: text('wishlist_id')
			.notNull()
			.references(() => wishlist.id, { onDelete: 'cascade' }),
		sortOrder: integer('sort_order').notNull().default(0),
		label: text('label').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		wishlistOrderIdx: index('priority_level_wishlist_order_idx').on(
			table.wishlistId,
			table.sortOrder,
		),
	}),
);
