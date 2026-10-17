import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.schema.js';
import { wishlist } from './wishlist.schema.js';
import { personalAccessToken } from './access_token.schema.js';
import { generateToken } from './id.js';
import { cascadingReferenceColumn } from './columns.js';

/**
 * An image an agent supplied by URL, fetched and stored in R2. Its id is the reference a gift
 * change names; it attaches once, for its user on its wishlist, until it expires. The row is
 * written after the object is stored. An unattached row is purged with its object after expiry;
 * an attached one once undo can no longer detach it, its object deleted only if no gift uses it.
 */
export const agentImage = pgTable(
	'agent_image',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateToken()),
		userId: cascadingReferenceColumn('user_id', () => user.id),
		wishlistId: cascadingReferenceColumn('wishlist_id', () => wishlist.id),
		tokenId: text('token_id').references(() => personalAccessToken.id, {
			onDelete: 'set null',
		}),
		objectKey: text('object_key').notNull().unique(),
		contentType: text('content_type').notNull(),
		byteLength: integer('byte_length').notNull(),
		width: integer('width').notNull(),
		height: integer('height').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		// Set by the transaction that attached the image to a gift.
		attachedAt: timestamp('attached_at', { withTimezone: true }),
	},
	(table) => ({
		userCreatedIdx: index('agent_image_user_created_idx').on(table.userId, table.createdAt),
		expiresIdx: index('agent_image_expires_idx').on(table.expiresAt),
		attachedIdx: index('agent_image_attached_idx').on(table.attachedAt),
		wishlistIdx: index('agent_image_wishlist_idx').on(table.wishlistId),
		tokenIdx: index('agent_image_token_idx').on(table.tokenId),
	}),
);
