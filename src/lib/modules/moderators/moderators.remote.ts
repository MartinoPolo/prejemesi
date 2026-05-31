import 'use server';

import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment, moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { guardedCommand } from '$lib/server/remote.js';
import type {
	GenerateInviteInput,
	AcceptInviteInput,
	RevokeInviteInput,
	RemoveModeratorInput,
	SelfPromoteInput,
	ModeratorsData,
	ModeratorWithUser,
	PendingInvite,
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
		error(404, 'Seznam nebyl nalezen');
	}
	if (row.ownerId !== userId) {
		error(403, 'Pouze vlastnik muze spravovat moderatory');
	}

	return row;
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get moderators and pending invites for a wishlist.
 * Accessible by owner and moderators.
 */
export const getModeratorsForWishlist = guardedCommand(
	async ({ user: currentUser }, wishlistId: string): Promise<ModeratorsData> => {
		const database = getDb();

		// Verify the wishlist exists and user has access
		const wishlistRows = await database
			.select()
			.from(wishlist)
			.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
			.limit(1);

		const wishlistRow = wishlistRows[0];
		if (wishlistRow === undefined) {
			error(404, 'Seznam nebyl nalezen');
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
				error(403, 'Nemáte přístup');
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

/**
 * Generate a moderator invite link. Owner only.
 * Creates a token stored in DB and returns the invite URL path.
 */
export const generateModeratorInviteLink = guardedCommand(
	async ({ user: currentUser }, input: GenerateInviteInput) => {
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
			error(500, 'Nepodařilo se vytvořit pozvánku');
		}

		return {
			token: created.token,
			invitePath: `/w/${wishlistRow.shortId}/invite/${created.token}`,
		};
	},
);

/**
 * Accept a moderator invite. Authenticated user clicks invite link.
 * Validates token, creates moderator assignment.
 */
export const acceptModeratorInvite = guardedCommand(
	async ({ user: currentUser }, input: AcceptInviteInput) => {
		const database = getDb();

		// Find the invite
		const inviteRows = await database
			.select()
			.from(moderatorInvite)
			.where(eq(moderatorInvite.token, input.token))
			.limit(1);

		const invite = inviteRows[0];
		if (invite === undefined) {
			error(404, 'Pozvánka nebyla nalezena');
		}

		// Check if revoked
		if (invite.revokedAt !== null) {
			error(400, 'Tato pozvánka byla zrušena');
		}

		// Check if already used
		if (invite.usedAt !== null) {
			error(400, 'Tato pozvánka již byla použita');
		}

		// Verify the wishlist still exists
		const wishlistRows = await database
			.select()
			.from(wishlist)
			.where(and(eq(wishlist.id, invite.wishlistId), isNull(wishlist.deletedAt)))
			.limit(1);

		const wishlistRow = wishlistRows[0];
		if (wishlistRow === undefined) {
			error(404, 'Seznam nebyl nalezen');
		}

		// Cannot accept own invite (owner)
		if (wishlistRow.ownerId === currentUser.id) {
			error(400, 'Vlastník nemůže přijmout pozvánku na svůj seznam');
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
			error(400, 'Již jste moderátorem tohoto seznamu');
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
			error(500, 'Nepodařilo se přiřadit moderátora');
		}

		return {
			wishlistId: invite.wishlistId,
			wishlistShortId: wishlistRow.shortId,
			wishlistTitle: wishlistRow.title,
		};
	},
);

/**
 * Revoke a pending moderator invite. Owner only.
 */
export const revokeModeratorInvite = guardedCommand(
	async ({ user: currentUser }, input: RevokeInviteInput) => {
		const database = getDb();

		// Find the invite
		const inviteRows = await database
			.select()
			.from(moderatorInvite)
			.where(eq(moderatorInvite.id, input.inviteId))
			.limit(1);

		const invite = inviteRows[0];
		if (invite === undefined) {
			error(404, 'Pozvánka nebyla nalezena');
		}

		// Verify ownership of the wishlist
		await verifyWishlistOwner(currentUser.id, invite.wishlistId);

		// Check if already used or revoked
		if (invite.usedAt !== null) {
			error(400, 'Pozvánka již byla použita');
		}
		if (invite.revokedAt !== null) {
			error(400, 'Pozvánka již byla zrušena');
		}

		// Revoke
		await database
			.update(moderatorInvite)
			.set({ revokedAt: new Date() })
			.where(eq(moderatorInvite.id, input.inviteId));
	},
);

/**
 * Remove an existing moderator. Owner only.
 */
export const removeModerator = guardedCommand(
	async ({ user: currentUser }, input: RemoveModeratorInput) => {
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
			error(404, 'Moderátor nebyl nalezen');
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

/**
 * Owner self-promotes to moderator (sees full reservation state).
 * Sets ownerIsModerator flag on the wishlist.
 */
export const selfPromoteToModerator = guardedCommand(
	async ({ user: currentUser }, input: SelfPromoteInput) => {
		const database = getDb();
		const wishlistRow = await verifyWishlistOwner(currentUser.id, input.wishlistId);

		if (wishlistRow.ownerIsModerator) {
			error(400, 'Již vidíte stav rezervací');
		}

		// Set the flag
		await database
			.update(wishlist)
			.set({
				ownerIsModerator: true,
				updatedAt: new Date(),
			})
			.where(eq(wishlist.id, input.wishlistId));

		// TODO: Send notification to all visitors/followers

		return { success: true };
	},
);
