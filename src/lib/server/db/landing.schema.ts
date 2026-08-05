import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { generateId } from './id.js';

/**
 * Likes on the landing page's demo gifts (issue #218).
 *
 * The demo is fixture-only in every other respect — reservations never leave the
 * browser — but the heart is real: it is the one shared, persistent counter every
 * anonymous visitor contributes to, so the landing page shows live proof that other
 * people are here. There is no `gift` row to reference (the demo gifts are hand-written
 * fixtures), so the row keys on the fixture's slug plus the anonymous visitor cookie id
 * from `anonymous_visitor.ts`. Slugs are validated against a hard allowlist in the
 * remote command, which is why no foreign key is needed or possible.
 *
 * Mirrors `giftLike`'s soft-delete idiom: unliking flips `deleted_at` instead of
 * deleting, and the unique + lookup indexes are partial on `deleted_at IS NULL`.
 */
export const landingDemoLike = pgTable(
	'landing_demo_like',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		giftSlug: text('gift_slug').notNull(),
		anonVisitorId: text('anon_visitor_id').notNull(),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		uniqueActiveLike: uniqueIndex('landing_demo_like_unique_active')
			.on(table.giftSlug, table.anonVisitorId)
			.where(sql`${table.deletedAt} IS NULL`),
		giftSlugActiveIdx: index('landing_demo_like_gift_slug_active_idx')
			.on(table.giftSlug)
			.where(sql`${table.deletedAt} IS NULL`),
	}),
);
