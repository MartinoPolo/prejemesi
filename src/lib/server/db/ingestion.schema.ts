import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { gift } from './gift.schema.js';
import { generateId } from './id.js';
import { wishlist } from './wishlist.schema.js';

export const giftIngestionRun = pgTable(
	'gift_ingestion_run',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		manifestId: text('manifest_id').notNull(),
		wishlistId: text('wishlist_id')
			.notNull()
			.references(() => wishlist.id),
		manifestHash: text('manifest_hash').notNull(),
		status: text('status').notNull(),
		result: jsonb('result').$type<Record<string, unknown>>().notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		manifestUnique: uniqueIndex('gift_ingestion_run_manifest_unique').on(table.manifestId),
		wishlistStartedIdx: index('gift_ingestion_run_wishlist_started_idx').on(
			table.wishlistId,
			table.startedAt,
		),
	}),
);

export const giftIngestionOrphan = pgTable(
	'gift_ingestion_orphan',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		manifestId: text('manifest_id').notNull(),
		itemId: text('item_id').notNull(),
		objectKey: text('object_key').notNull(),
		reason: text('reason').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
	},
	(table) => ({
		unresolvedIdx: index('gift_ingestion_orphan_unresolved_idx').on(
			table.resolvedAt,
			table.createdAt,
		),
	}),
);

export const giftIngestionItem = pgTable(
	'gift_ingestion_item',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		runId: text('run_id')
			.notNull()
			.references(() => giftIngestionRun.id),
		itemId: text('item_id').notNull(),
		sourceUrl: text('source_url').notNull(),
		itemHash: text('item_hash').notNull(),
		provenance: jsonb('provenance')
			.$type<Record<string, unknown>>()
			.notNull()
			.default(sql`'{}'::jsonb`),
		createdGiftId: text('created_gift_id').references(() => gift.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		itemUnique: uniqueIndex('gift_ingestion_item_item_unique').on(table.itemId),
		runIdx: index('gift_ingestion_item_run_idx').on(table.runId),
	}),
);
