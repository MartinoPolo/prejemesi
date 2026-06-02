import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema.js';
import { wishlist, priorityLevel } from './wishlist.schema.js';
import { generateId } from './id.js';
import type { ImageMetadata } from '$lib/modules/images/types.js';

export const gift = pgTable(
	'gift',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		wishlistId: text('wishlist_id')
			.notNull()
			.references(() => wishlist.id, { onDelete: 'cascade' }),
		priorityLevelId: text('priority_level_id').references(() => priorityLevel.id, {
			onDelete: 'set null',
		}),
		name: text('name').notNull(),
		description: text('description'),
		url: text('url'),
		price: integer('price'),
		currency: text('currency').default('CZK'),
		imageUrl: text('image_url'),
		imageKey: text('image_key'),
		// Image presentation metadata: fit mode, normalized crop/focal, bg fill (REQ-1).
		imageMeta: jsonb('image_meta').$type<ImageMetadata>(),
		quantity: integer('quantity').default(1),
		sortOrder: integer('sort_order').notNull().default(0),
		received: boolean('received').notNull().default(false),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		wishlistSortIdx: index('gift_wishlist_sort_idx')
			.on(table.wishlistId, table.sortOrder)
			.where(sql`${table.deletedAt} IS NULL`),
	}),
);

export const reservation = pgTable(
	'reservation',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		giftId: text('gift_id')
			.notNull()
			.references(() => gift.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		anonymousName: text('anonymous_name'),
		anonymousEmail: text('anonymous_email'),
		quantity: integer('quantity').notNull().default(1),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		giftActiveIdx: index('reservation_gift_active_idx')
			.on(table.giftId)
			.where(sql`${table.deletedAt} IS NULL`),
		userActiveIdx: index('reservation_user_active_idx')
			.on(table.userId)
			.where(sql`${table.deletedAt} IS NULL`),
	}),
);

export const giftLike = pgTable(
	'gift_like',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		giftId: text('gift_id')
			.notNull()
			.references(() => gift.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		uniqueActiveLike: uniqueIndex('gift_like_unique_active')
			.on(table.giftId, table.userId)
			.where(sql`${table.deletedAt} IS NULL`),
		giftActiveIdx: index('gift_like_gift_active_idx')
			.on(table.giftId)
			.where(sql`${table.deletedAt} IS NULL`),
	}),
);
