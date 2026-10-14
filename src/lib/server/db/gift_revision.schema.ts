import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.schema.js';
import { gift } from './gift.schema.js';
import { wishlist } from './wishlist.schema.js';
import { generateId } from './id.js';
import { cascadingReferenceColumn } from './columns.js';
import type { GiftRevisionSnapshot } from '$lib/server/operations/gift_revision_snapshot.js';

/** Before/after record of one gift change made through the operation core, kept for history and undo. */
export const giftRevision = pgTable(
	'gift_revision',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		giftId: cascadingReferenceColumn('gift_id', () => gift.id),
		wishlistId: cascadingReferenceColumn('wishlist_id', () => wishlist.id),
		batchId: text('batch_id').notNull(),
		actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
		channel: text('channel').notNull(),
		operation: text('operation').notNull(),
		// Null for a created gift; a soft delete keeps `after` and sets its `deletedAt`.
		before: jsonb('before').$type<GiftRevisionSnapshot>(),
		after: jsonb('after').$type<GiftRevisionSnapshot>().notNull(),
		// Insert-time wall clock, not the transaction start: revisions are inserted while their gift
		// rows are locked, so this orders a gift's revisions by commit order.
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.default(sql`clock_timestamp()`),
	},
	(table) => ({
		// Matches the latest-revision query's `DESC` order, whose default is NULLS FIRST.
		giftLatestIdx: index('gift_revision_gift_latest_idx').on(
			table.giftId,
			table.createdAt.desc().nullsFirst(),
			table.id.desc().nullsFirst(),
		),
		batchIdx: index('gift_revision_batch_idx').on(table.batchId),
		createdIdx: index('gift_revision_created_idx').on(table.createdAt),
		wishlistCreatedIdx: index('gift_revision_wishlist_created_idx').on(
			table.wishlistId,
			table.createdAt,
		),
		actorUserIdx: index('gift_revision_actor_user_idx').on(table.actorUserId),
	}),
);
