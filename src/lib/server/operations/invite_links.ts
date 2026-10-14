import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { DatabaseTransaction, getDb } from '$lib/server/db/index.js';
import type { moderatorInvite } from '$lib/server/db/moderator.schema.js';
import type { claimInvite } from '$lib/server/db/claim.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { PendingInvite } from '$lib/modules/moderators/types.js';
import type { MutationOperationContext } from './operation.js';
import { optionalEmail } from './optional_email.js';
import { requireWishlistManagement, type WishlistRow } from './wishlist_management.js';

/** Správce invites and claim invites share one token-link shape and lifecycle. */
type InviteTable = typeof moderatorInvite | typeof claimInvite;
type InviteRow = typeof moderatorInvite.$inferSelect;

/** Pending (unused, unrevoked) invites; any manager may share or revoke them. */
export function readPendingInvites(
	database: ReturnType<typeof getDb>,
	inviteTable: InviteTable,
	wishlistId: string,
): Promise<PendingInvite[]> {
	return database
		.select({
			id: inviteTable.id,
			token: inviteTable.token,
			createdAt: inviteTable.createdAt,
			usedAt: inviteTable.usedAt,
			revokedAt: inviteTable.revokedAt,
		})
		.from(inviteTable)
		.where(
			and(
				eq(inviteTable.wishlistId, wishlistId),
				isNull(inviteTable.usedAt),
				isNull(inviteTable.revokedAt),
			),
		)
		.orderBy(inviteTable.createdAt);
}

/**
 * Locked before the wishlist so accepting and revoking the same invite serialize; nothing locks
 * an invite after its wishlist.
 */
async function lockInvite(
	transaction: DatabaseTransaction,
	inviteTable: InviteTable,
	lookup: { column: 'id' | 'token'; value: string },
): Promise<InviteRow> {
	const [invite] = await transaction
		.select()
		.from(inviteTable)
		.where(eq(inviteTable[lookup.column], lookup.value))
		.for('update');
	if (invite === undefined) {
		error(404, SERVER_ERROR.INVITE_NOT_FOUND);
	}
	return invite;
}

/** An archived wishlist is read-only: it takes no new managers or owners. */
export function assertWishlistTakesInvites(wishlistRow: WishlistRow): void {
	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_INVITE_ON_ARCHIVED);
	}
}

export interface CreatedInviteLink {
	token: string;
	path: string;
	unregisteredInvitee: boolean;
}

/**
 * Creates an invite link. With an email the link is mailed whether or not the address has an
 * account (the link page handles register-then-accept); the manager learns when it has none.
 */
export async function createInviteLink(
	context: MutationOperationContext,
	params: {
		inviteTable: InviteTable;
		wishlistRow: WishlistRow;
		pathSegment: 'invite' | 'claim';
		email: string | null | undefined;
	},
): Promise<CreatedInviteLink> {
	const { inviteTable, wishlistRow, pathSegment } = params;
	const inviteeEmail = optionalEmail(params.email);
	const [created] = await context.transaction
		.insert(inviteTable)
		.values({ wishlistId: wishlistRow.id, createdByUserId: context.actor.userId })
		.returning();
	if (created === undefined) {
		error(500, SERVER_ERROR.FAILED_TO_CREATE_INVITE);
	}
	const path = `/w/${wishlistRow.shortId}/${pathSegment}/${created.token}`;
	if (inviteeEmail === null) {
		return { token: created.token, path, unregisteredInvitee: false };
	}
	const existingUsers = await context.transaction
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, inviteeEmail.toLowerCase()))
		.limit(1);
	return { token: created.token, path, unregisteredInvitee: existingUsers[0] === undefined };
}

/** Any manager (recipient or správce) may revoke a pending invite. */
export async function revokePendingInvite(
	context: MutationOperationContext,
	inviteTable: InviteTable,
	inviteId: string,
): Promise<void> {
	const invite = await lockInvite(context.transaction, inviteTable, {
		column: 'id',
		value: inviteId,
	});
	await requireWishlistManagement(context.transaction, context.actor.userId, invite.wishlistId, {
		lock: true,
	});
	if (invite.usedAt !== null) {
		error(400, SERVER_ERROR.INVITE_ALREADY_USED);
	}
	if (invite.revokedAt !== null) {
		error(400, SERVER_ERROR.INVITE_ALREADY_REVOKED);
	}
	await context.transaction
		.update(inviteTable)
		.set({ revokedAt: context.now })
		.where(eq(inviteTable.id, inviteId));
}

/** Locks an invite by token for accepting: 400 once revoked or used. */
export async function lockAcceptableInvite(
	context: MutationOperationContext,
	inviteTable: InviteTable,
	token: string,
): Promise<InviteRow> {
	const invite = await lockInvite(context.transaction, inviteTable, {
		column: 'token',
		value: token,
	});
	if (invite.revokedAt !== null) {
		error(400, SERVER_ERROR.INVITE_ALREADY_REVOKED);
	}
	if (invite.usedAt !== null) {
		error(400, SERVER_ERROR.INVITE_ALREADY_USED);
	}
	return invite;
}

export async function markInviteUsed(
	context: MutationOperationContext,
	inviteTable: InviteTable,
	inviteId: string,
): Promise<void> {
	await context.transaction
		.update(inviteTable)
		.set({ usedByUserId: context.actor.userId, usedAt: context.now })
		.where(eq(inviteTable.id, inviteId));
}
