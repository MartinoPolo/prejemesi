import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { ChatContentBlock, ChatRole } from '$lib/server/chat/chat_model.js';
import { user } from './auth.schema.js';
import { wishlist } from './wishlist.schema.js';
import { changeProposal } from './change_proposal.schema.js';
import { generateId } from './id.js';
import { cascadingReferenceColumn } from './columns.js';

/** One conversation with the AI assistant about one wishlist; kept 30 days after its last turn. */
export const chatSession = pgTable(
	'chat_session',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: cascadingReferenceColumn('user_id', () => user.id),
		wishlistId: cascadingReferenceColumn('wishlist_id', () => wishlist.id),
		title: text('title').notNull(),
		// Fast-forward per chat: off for each new chat.
		fastForward: boolean('fast_forward').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		lastTurnAt: timestamp('last_turn_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		userWishlistIdx: index('chat_session_user_wishlist_idx').on(
			table.userId,
			table.wishlistId,
			table.lastTurnAt,
		),
		lastTurnIdx: index('chat_session_last_turn_idx').on(table.lastTurnAt),
	}),
);

/**
 * A message in the provider-neutral form the model is sent again on the next turn; an assistant
 * message that proposed changes names its proposal.
 */
export const chatMessage = pgTable(
	'chat_message',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		sessionId: cascadingReferenceColumn('session_id', () => chatSession.id),
		// Orders a session's messages; several can share a millisecond.
		sequence: integer('sequence').generatedAlwaysAsIdentity(),
		role: text('role').$type<ChatRole>().notNull(),
		content: jsonb('content').$type<ChatContentBlock[]>().notNull(),
		proposalId: text('proposal_id').references(() => changeProposal.id, {
			onDelete: 'set null',
		}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		sessionSequenceIdx: index('chat_message_session_sequence_idx').on(
			table.sessionId,
			table.sequence,
		),
		// Today's turns count against the daily caps.
		roleCreatedIdx: index('chat_message_role_created_idx').on(table.role, table.createdAt),
	}),
);
