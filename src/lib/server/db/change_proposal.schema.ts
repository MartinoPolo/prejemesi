import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { ChangeProposalStatus } from '$lib/modules/change_proposals/types.js';
import type {
	ChangeProposalGrantSnapshot,
	ChangeProposalUndoTargets,
	StoredChangeRow,
} from '$lib/server/agent_access/change_proposal_records.js';
import { user } from './auth.schema.js';
import { wishlist } from './wishlist.schema.js';
import { agentAccessOauthGrant, personalAccessToken } from './access_token.schema.js';
import { generateId } from './id.js';
import { cascadingReferenceColumn } from './columns.js';

/**
 * A batch of agent changes for one wishlist, dry-run at submission and reviewed by its submitter.
 * Revoking the token keeps its proposals; deleting the wishlist or the submitter removes them.
 */
export const changeProposal = pgTable(
	'change_proposal',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateId()),
		// Null only for a proposal that created wishlists, applied at once by fast-forward.
		wishlistId: text('wishlist_id').references(() => wishlist.id, { onDelete: 'cascade' }),
		submitterUserId: cascadingReferenceColumn('submitter_user_id', () => user.id),
		// The submitting credential: a personal access token or an OAuth grant, the other null.
		tokenId: text('token_id').references(() => personalAccessToken.id, {
			onDelete: 'set null',
		}),
		oauthGrantId: text('oauth_grant_id').references(() => agentAccessOauthGrant.id, {
			onDelete: 'set null',
		}),
		channel: text('channel').notNull(),
		tokenName: text('token_name').notNull(),
		grant: jsonb('grant').$type<ChangeProposalGrantSnapshot>().notNull(),
		status: text('status').$type<ChangeProposalStatus>().notNull(),
		rows: jsonb('rows').$type<StoredChangeRow[]>().notNull(),
		// Summed for the daily change budget without reading the rows.
		rowCount: integer('row_count').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		appliedAt: timestamp('applied_at', { withTimezone: true }),
		appliedBatchId: text('applied_batch_id'),
		appliedRowIds: text('applied_row_ids').array(),
		undoTargets: jsonb('undo_targets').$type<ChangeProposalUndoTargets>(),
		discardedAt: timestamp('discarded_at', { withTimezone: true }),
		undoneAt: timestamp('undone_at', { withTimezone: true }),
	},
	(table) => ({
		submitterCreatedIdx: index('change_proposal_submitter_created_idx').on(
			table.submitterUserId,
			table.createdAt,
		),
		expiresIdx: index('change_proposal_expires_idx').on(table.expiresAt),
		wishlistIdx: index('change_proposal_wishlist_idx').on(table.wishlistId),
		tokenIdx: index('change_proposal_token_idx').on(table.tokenId),
		oauthGrantIdx: index('change_proposal_oauth_grant_idx').on(table.oauthGrantId),
	}),
);

/**
 * A mutating API request's `Idempotency-Key`: the response is stored once the request succeeds
 * and replayed for a retry with the same key and request.
 */
export const agentIdempotencyKey = pgTable(
	'agent_idempotency_key',
	{
		tokenId: cascadingReferenceColumn('token_id', () => personalAccessToken.id),
		key: text('key').notNull(),
		// SHA-256 of the method, path and canonical JSON body.
		requestFingerprint: text('request_fingerprint').notNull(),
		// Both null while the first request is still in progress.
		responseStatus: integer('response_status'),
		responseBody: jsonb('response_body'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.tokenId, table.key] }),
		createdIdx: index('agent_idempotency_key_created_idx').on(table.createdAt),
	}),
);

/** Like `agentIdempotencyKey`, for the keys of an OAuth grant. */
export const agentOauthIdempotencyKey = pgTable(
	'agent_oauth_idempotency_key',
	{
		grantId: cascadingReferenceColumn('grant_id', () => agentAccessOauthGrant.id),
		key: text('key').notNull(),
		requestFingerprint: text('request_fingerprint').notNull(),
		responseStatus: integer('response_status'),
		responseBody: jsonb('response_body'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.grantId, table.key] }),
		createdIdx: index('agent_oauth_idempotency_key_created_idx').on(table.createdAt),
	}),
);
