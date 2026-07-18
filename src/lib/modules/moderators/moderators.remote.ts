import * as v from 'valibot';
import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment, moderatorInvite } from '$lib/server/db/moderator.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { guardedCommand, guardedQueryWithArgs, singleFlightRefresh } from '$lib/server/remote.js';
import { resolveUserImageUrl } from '$lib/modules/images/public_url.js';
import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import {
	verifyManagerAccess,
	verifyLinkedRecipientAccess,
	requireWishlistRow,
	assertNotLastManager,
	resolveWishlistRole,
} from '$lib/modules/wishlists/wishlist_access.js';
import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
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

// ── Queries ──────────────────────────────────────────────────────────────────

export const getModeratorsForWishlist = guardedQueryWithArgs(
	v.string(),
	async ({ user: currentUser }, wishlistId): Promise<ModeratorsData> => {
		const database = getDb();

		// Access + role: only managers (recipient or správce) may view the správci panel.
		const wishlistRow = await requireWishlistRow(wishlistId);
		const role = await resolveWishlistRole({ user: currentUser }, wishlistRow);
		if (!canManageWishlist(role)) {
			error(403, SERVER_ERROR.ACCESS_DENIED);
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
			userImage: resolveUserImageUrl(row.userImage),
			assignedAt: row.assignedAt,
		}));

		// Pending invites are visible to any manager (recipient or správce can invite/revoke).
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

		const pendingInvites: PendingInvite[] = inviteRows.map((row) => ({
			id: row.id,
			token: row.token,
			createdAt: row.createdAt,
			usedAt: row.usedAt,
			revokedAt: row.revokedAt,
		}));

		return {
			moderators,
			pendingInvites,
			recipientIsModerator: wishlistRow.recipientIsModerator,
			isForSomeoneElse: wishlistRow.recipientUserId === null,
			recipientName: wishlistRow.recipientName,
		};
	},
);

// ── Commands ─────────────────────────────────────────────────────────────────

export const generateModeratorInviteLink = guardedCommand(
	GenerateInviteInputSchema,
	async ({ user: currentUser }, input) => {
		const database = getDb();
		const { wishlistRow } = await verifyManagerAccess(currentUser.id, input.wishlistId);

		if (wishlistRow.status === 'archived') {
			error(400, SERVER_ERROR.CANNOT_INVITE_ON_ARCHIVED);
		}

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

		const invitePath = `/w/${wishlistRow.shortId}/invite/${created.token}`;

		// When an email is supplied we email the invite link regardless of whether the
		// address belongs to an account (the accept page handles register-then-accept).
		// Look the email up so the manager can be told the invitee has no account yet.
		let unregisteredInvitee = false;
		if (input.email !== undefined && input.email !== '') {
			const existingUser = await database
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, input.email.toLowerCase()))
				.limit(1);
			unregisteredInvitee = existingUser[0] === undefined;

			await dispatchNotification({
				type: NOTIFICATION_TYPE.MODERATOR_INVITED,
				targetEmails: [input.email],
				wishlistId: input.wishlistId,
				actorId: currentUser.id,
				actorName: currentUser.name,
				urlPathOverride: invitePath,
				wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
			});
		}

		return { token: created.token, invitePath, unregisteredInvitee };
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

		if (wishlistRow.status === 'archived') {
			error(400, SERVER_ERROR.CANNOT_INVITE_ON_ARCHIVED);
		}

		// The linked recipient already manages the list — accepting a správce invite is redundant.
		if (wishlistRow.recipientUserId === currentUser.id) {
			error(400, SERVER_ERROR.RECIPIENT_CANNOT_ACCEPT_OWN_INVITE);
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

		return database.transaction(async (tx) => {
			await tx
				.update(moderatorInvite)
				.set({
					usedByUserId: currentUser.id,
					usedAt: new Date(),
				})
				.where(eq(moderatorInvite.id, invite.id));

			const [assignment] = await tx
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
		});
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

		// Any manager (recipient or správce) may revoke invites.
		await verifyManagerAccess(currentUser.id, invite.wishlistId);

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

		// Any manager (recipient or správce) may remove správci.
		const { wishlistRow } = await verifyManagerAccess(currentUser.id, assignment.wishlistId);

		// Orphan guard: a for-someone list must keep at least one správce.
		await assertNotLastManager(wishlistRow);

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

		// Self-promote is a linked-recipient action only: it opts the recipient into seeing
		// reservation counts. Správci already see full state; free-text recipients have no account.
		const wishlistRow = await verifyLinkedRecipientAccess(currentUser.id, input.wishlistId);
		if (wishlistRow.status === 'archived') {
			error(400, SERVER_ERROR.CANNOT_SELF_PROMOTE_ON_ARCHIVED);
		}
		if (wishlistRow.recipientIsModerator === true) {
			error(400, SERVER_ERROR.ALREADY_SEEING_RESERVATIONS);
		}

		// Set the flag
		await database
			.update(wishlist)
			.set({
				recipientIsModerator: true,
				updatedAt: new Date(),
			})
			.where(eq(wishlist.id, input.wishlistId));

		const followerRows = await database
			.select({ userId: wishlistFollower.userId })
			.from(wishlistFollower)
			.where(
				and(
					eq(wishlistFollower.wishlistId, input.wishlistId),
					isNull(wishlistFollower.unfollowedAt),
				),
			);

		await dispatchNotification({
			type: NOTIFICATION_TYPE.RECIPIENT_SELF_PROMOTED,
			targetUserIds: followerRows
				.map((row) => row.userId)
				.filter((targetUserId) => targetUserId !== currentUser.id),
			wishlistId: input.wishlistId,
			actorId: currentUser.id,
			actorName: currentUser.name,
			wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
		});

		// Single-flight refresh (issue #108, REQ-3/4): self-promotion changes both the
		// header flag and the gift shaping (counts become visible) on the open page.
		singleFlightRefresh(getWishlistByShortId, wishlistRow.shortId);
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);

		return { success: true };
	},
);
