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
import { wishlistStatusEnum, wishlistThemeEnum } from './enums.js';
import { generateId } from './id.js';
import type { WishlistImageSlots } from '$lib/modules/images/types.js';

export function generateShortId(): string {
	return generateId(8);
}

export const wishlist = pgTable(
	'wishlist',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		shortId: text('short_id')
			.notNull()
			.unique()
			.$defaultFn(() => generateShortId()),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description'),
		eventDate: timestamp('event_date', { withTimezone: true }),
		status: wishlistStatusEnum('status').notNull().default('draft'),
		theme: wishlistThemeEnum('theme').notNull().default('default'),
		customThemeColor: text('custom_theme_color'),
		// One wishlist image assignment + per-slot crop metadata (REQ-2). Replaces
		// the obsolete separate banner/thumbnail keys (no compatibility shim kept).
		imageKey: text('image_key'),
		imageSlots: jsonb('image_slots').$type<WishlistImageSlots>(),
		ownerIsModerator: boolean('owner_is_moderator').notNull().default(false),
		sharedAt: timestamp('shared_at', { withTimezone: true }),
		// Last edit to the event date during the post-share grace window (issue #83). Drives the
		// debounced 2-min reversibility of the event-date lock; falls back to `sharedAt` when never
		// re-edited. Server is the authority – the client countdown derives from this.
		eventDateEditedAt: timestamp('event_date_edited_at', { withTimezone: true }),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		ownerStatusIdx: index('wishlist_owner_status_idx')
			.on(table.ownerId, table.status)
			.where(sql`${table.deletedAt} IS NULL`),
		shortIdIdx: uniqueIndex('wishlist_short_id_idx').on(table.shortId),
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
