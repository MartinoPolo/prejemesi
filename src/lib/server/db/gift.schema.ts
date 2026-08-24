import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
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
import type { GiftLink, DescriptionAppend } from '$lib/modules/gifts/types.js';
import type { PreShareGiftSnapshot } from '$lib/modules/gifts/gift_post_share.js';

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
		// Post-share description edits accrue here as immutable, timestamped segments rendered as
		// accent-colored appends (REQ-4). The frozen base stays in `description`.
		descriptionAppends: jsonb('description_appends')
			.$type<DescriptionAppend[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		// Set on the first post-share field edit; drives the "Upraveno po sdílení" transparency badge
		// (REQ-6). Never set by reorder/mark-received.
		editedAfterShareAt: timestamp('edited_after_share_at', { withTimezone: true }),
		// Captured at the FIRST in-grace edit (issue #124): the field values right before that edit,
		// i.e. the share-time state. Each later in-grace edit compares the gift against this snapshot;
		// a byte-identical match clears `editedAfterShareAt` (net-zero revert carries no signal for
		// gifters). Cleared whenever `editedAfterShareAt` is cleared or the grace window closes.
		preEditShareSnapshot: jsonb('pre_edit_share_snapshot').$type<PreShareGiftSnapshot>(),
		// Up to 10 purchase links; links[0] is primary (drives the domain chip / OG / "Bez odkazu").
		links: jsonb('links')
			.$type<GiftLink[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		price: numeric('price', { precision: 12, scale: 2, mode: 'number' }),
		// Non-binding upper bound of a price range (issue #155): non-null makes `price` the lower
		// bound and displays as "min–max <currency>" (a hint, never scraped/binding). Null = single
		// price, matching every pre-#155 row without a migration.
		priceMax: numeric('price_max', { precision: 12, scale: 2, mode: 'number' }),
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
		// Per-browser capability token for anonymous reservations. Lets an anonymous
		// visitor recognise and cancel their own reservation (matched against the
		// httpOnly `prejemesi_anon_id` cookie). Null for authenticated reservations.
		anonymousVisitorId: text('anonymous_visitor_id'),
		quantity: integer('quantity').notNull().default(1),
		// Gifter-private "I already bought this" marker. Optional self-tracking flag set by the
		// authenticated reserver; never exposed to the wishlist owner. Null = reserved-not-bought.
		purchasedAt: timestamp('purchased_at', { withTimezone: true }),
		// Who cancelled this reservation (issue #213, REQ-10). Written on every cancellation path;
		// stays NULL for a guest self-cancel (a guest has no account to record). An OVERRIDE is
		// therefore `cancelledByUserId !== null && cancelledByUserId !== userId` — that is what
		// distinguishes a správce/administrator release from the gifter cancelling their own.
		cancelledByUserId: text('cancelled_by_user_id').references(() => user.id, {
			onDelete: 'set null',
		}),
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
		anonVisitorActiveIdx: index('reservation_anon_visitor_active_idx')
			.on(table.anonymousVisitorId)
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
