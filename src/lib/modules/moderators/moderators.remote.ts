import * as v from 'valibot';
import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment, moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { guardedCommand, guardedQueryWithArgs } from '$lib/server/remote.js';
import {
	GenerateInviteInputSchema,
	AcceptInviteInputSchema,
	RevokeInviteInputSchema,
	RemoveModeratorInputSchema,
	SelfPromoteInputSchema,
	type ModeratorsData,
	type ModeratorWithUser,
	type PendingInvite,
} from './types.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function verifyWishlistOwner(userId: string, wishlistId: string) {
	const database = getDb();

	const rows = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = rows[0];
	if (row === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}
	if (row.ownerId !== userId) {
		error(403, SERVER_ERROR.ONLY_OWNER_CAN_MANAGE_MODERATORS);
	}

	return row;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const getModeratorsForWishlist = guardedQueryWithArgs(
	v.string(),
	async ({ user: currentUser }, wishlistId): Promise<ModeratorsData> => {
		const database = getDb();

		// Verify the wishlist exists and user has access
		const wishlistRows = await database
			.select()
			.from(wishlist)
			.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
			.limit(1);

		const wishlistRow = wishlistRows[0];
		if (wishlistRow === undefined) {
			error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
		}

		const isOwner = wishlistRow.ownerId === currentUser.id;

		if (!isOwner) {
			// Check if moderator
			const modRows = await database
				.select()
				.from(moderatorAssignment)
				.where(
					and(
						eq(moderatorAssignment.wishlistId, wishlistId),
						eq(moderatorAssignment.userId, currentUser.id),
						isNull(moderatorAssignment.deletedAt),
					),
				)
				.limit(1);

			if (modRows[0] === undefined) {
				error(403, SERVER_ERROR.ACCESS_DENIED);
			}
		}

		// Fetch active moderators with user info
		const moderatorRows = await database
			.select({
				id: moderatorAssignment.id,
				userId: moderatorAssignment.userId,
				userName: user.name,
				userImage: user.image,
				assignedAt: moderatorAssignment.assignedAt,
			})
			.from(moderatorAssignment)
			.innerJoin(user, eq(moderatorAssignment.userId, user.id))
			.where(
				and(
					eq(moderatorAssignment.wishlistId, wishlistId),
					isNull(moderatorAssignment.deletedAt),
				),
			)
			.orderBy(moderatorAssignment.assignedAt);

		const moderators: ModeratorWithUser[] = moderatorRows.map((row) => ({
			id: row.id,
			userId: row.userId,
			userName: row.userName,
			userImage: row.userImage,
			assignedAt: row.assignedAt,
		}));

		// Fetch pending invites (only for owner)
		let pendingInvites: PendingInvite[] = [];
		if (isOwner) {
			const inviteRows = await database
				.select({
					id: moderatorInvite.id,
					token: moderatorInvite.token,
					createdAt: moderatorInvite.createdAt,
					usedAt: moderatorInvite.usedAt,
					revokedAt: moderatorInvite.revokedAt,
				})
				.from(moderatorInvite)
				.where(
					and(
						eq(moderatorInvite.wishlistId, wishlistId),
						isNull(moderatorInvite.usedAt),
						isNull(moderatorInvite.revokedAt),
					),
				)
				.orderBy(moderatorInvite.createdAt);

			pendingInvites = inviteRows.map((row) => ({
				id: row.id,
				token: row.token,
				createdAt: row.createdAt,
				usedAt: row.usedAt,
				revokedAt: row.revokedAt,
			}));
		}

		return {
			moderators,
			pendingInvites,
			ownerIsModerator: wishlistRow.ownerIsModerator,
		};
	},
);

// ── Commands ─────────────────────────────────────────────────────────────────

export const generateModeratorInviteLink = guardedCommand(
	GenerateInviteInputSchema,
	async ({ user: currentUser }, input) => {
		const database = getDb();
		const wishlistRow = await verifyWishlistOwner(currentUser.id, input.wishlistId);

		// Create invite record (token is auto-generated via $defaultFn)
		const [created] = await database
			.insert(moderatorInvite)
			.values({
				wishlistId: input.wishlistId,
				createdByUserId: currentUser.id,
			})
			.returning();

		if (created === undefined) {
			error(500, SERVER_ERROR.FAILED_TO_CREATE_INVITE);
		}

		return {
			token: created.token,
			invitePath: `/w/${wishlistRow.shortId}/invite/${created.token}`,
		};
	},
);

export const acceptModeratorInvite = guardedCommand(
	AcceptInviteInputSchema,
	async ({ user: currentUser }, input) => {
		const database = getDb();

		// Find the invite
		const inviteRows = await database
			.select()
			.from(moderatorInvite)
			.where(eq(moderatorInvite.token, input.token))
			.limit(1);

		const invite = inviteRows[0];
		if (invite === undefined) {
			error(404, SERVER_ERROR.INVITE_NOT_FOUND);
		}

		// Check if revoked
		if (invite.revokedAt !== null) {
			error(400, SERVER_ERROR.INVITE_ALREADY_REVOKED);
		}

		// Check if already used
		if (invite.usedAt !== null) {
			error(400, SERVER_ERROR.INVITE_ALREADY_USED);
		}

		// Verify the wishlist still exists
		const wishlistRows = await database
			.select()
			.from(wishlist)
			.where(and(eq(wishlist.id, invite.wishlistId), isNull(wishlist.deletedAt)))
			.limit(1);

		const wishlistRow = wishlistRows[0];
		if (wishlistRow === undefined) {
			error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
		}

		// Cannot accept own invite (owner)
		if (wishlistRow.ownerId === currentUser.id) {
			error(400, SERVER_ERROR.OWNER_CANNOT_ACCEPT_OWN_INVITE);
		}

		// Check if already a moderator
		const existingModRows = await database
			.select()
			.from(moderatorAssignment)
			.where(
				and(
					eq(moderatorAssignment.wishlistId, invite.wishlistId),
					eq(moderatorAssignment.userId, currentUser.id),
					isNull(moderatorAssignment.deletedAt),
				),
			)
			.limit(1);

		if (existingModRows[0] !== undefined) {
			error(400, SERVER_ERROR.ALREADY_MODERATOR);
		}

		// Mark invite as used
		await database
			.update(moderatorInvite)
			.set({
				usedByUserId: currentUser.id,
				usedAt: new Date(),
			})
			.where(eq(moderatorInvite.id, invite.id));

		// Create moderator assignment
		const [assignment] = await database
			.insert(moderatorAssignment)
			.values({
				wishlistId: invite.wishlistId,
				userId: currentUser.id,
			})
			.returning();

		if (assignment === undefined) {
			error(500, SERVER_ERROR.FAILED_TO_ASSIGN_MODERATOR);
		}

		return {
			wishlistId: invite.wishlistId,
			wishlistShortId: wishlistRow.shortId,
			wishlistTitle: wishlistRow.title,
		};
	},
);

export const revokeModeratorInvite = guardedCommand(
	RevokeInviteInputSchema,
	async ({ user: currentUser }, input) => {
		const database = getDb();

		// Find the invite
		const inviteRows = await database
			.select()
			.from(moderatorInvite)
			.where(eq(moderatorInvite.id, input.inviteId))
			.limit(1);

		const invite = inviteRows[0];
		if (invite === undefined) {
			error(404, SERVER_ERROR.INVITE_NOT_FOUND);
		}

		// Verify ownership of the wishlist
		await verifyWishlistOwner(currentUser.id, invite.wishlistId);

		// Check if already used or revoked
		if (invite.usedAt !== null) {
			error(400, SERVER_ERROR.INVITE_ALREADY_USED);
		}
		if (invite.revokedAt !== null) {
			error(400, SERVER_ERROR.INVITE_ALREADY_REVOKED);
		}

		// Revoke
		await database
			.update(moderatorInvite)
			.set({ revokedAt: new Date() })
			.where(eq(moderatorInvite.id, input.inviteId));
	},
);

export const removeModerator = guardedCommand(
	RemoveModeratorInputSchema,
	async ({ user: currentUser }, input) => {
		const database = getDb();

		// Find the assignment
		const assignmentRows = await database
			.select()
			.from(moderatorAssignment)
			.where(
				and(
					eq(moderatorAssignment.id, input.assignmentId),
					isNull(moderatorAssignment.deletedAt),
				),
			)
			.limit(1);

		const assignment = assignmentRows[0];
		if (assignment === undefined) {
			error(404, SERVER_ERROR.MODERATOR_NOT_FOUND);
		}

		// Verify ownership of the wishlist
		await verifyWishlistOwner(currentUser.id, assignment.wishlistId);

		// Soft delete
		await database
			.update(moderatorAssignment)
			.set({ deletedAt: new Date() })
			.where(eq(moderatorAssignment.id, input.assignmentId));
	},
);

export const selfPromoteToModerator = guardedCommand(
	SelfPromoteInputSchema,
	async ({ user: currentUser }, input) => {
		const database = getDb();
		const wishlistRow = await verifyWishlistOwner(currentUser.id, input.wishlistId);

		if (wishlistRow.ownerIsModerator) {
			error(400, SERVER_ERROR.ALREADY_SEEING_RESERVATIONS);
		}

		// Set the flag
		await database
			.update(wishlist)
			.set({
				ownerIsModerator: true,
				updatedAt: new Date(),
			})
			.where(eq(wishlist.id, input.wishlistId));

		return { success: true };
	},
);
