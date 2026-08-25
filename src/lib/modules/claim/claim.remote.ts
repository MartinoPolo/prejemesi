import * as v from 'valibot';
import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { claimInvite } from '$lib/server/db/claim.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { guardedCommand, guardedQueryWithArgs, singleFlightRefresh } from '$lib/server/remote.js';
import {
	verifyManagerAccess,
	requireWishlistRow,
	resolveWishlistRole,
} from '$lib/modules/wishlists/wishlist_access.js';
import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
import {
	getMyWishlists,
	getModeratedWishlists,
	getFollowedWishlists,
	getHomeOverview,
	getWishlistByShortId,
} from '$lib/modules/wishlists/wishlists.remote.js';
import {
	GenerateClaimInviteInputSchema,
	AcceptClaimInviteInputSchema,
	RevokeClaimInviteInputSchema,
	type ClaimInvitesData,
	type PendingClaimInvite,
} from './types.js';

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Pending claim invites for the správce panel nudge. Visible to any manager (recipient or
 * správce). Only for-someone lists ever have claim invites — a linked list rejects generation.
 */
export const getClaimInvitesForWishlist = guardedQueryWithArgs(
	v.string(),
	async ({ user: currentUser }, wishlistId): Promise<ClaimInvitesData> => {
		const database = getDb();

		const wishlistRow = await requireWishlistRow(wishlistId);
		const role = await resolveWishlistRole({ user: currentUser }, wishlistRow);
		if (!canManageWishlist(role)) {
			error(403, SERVER_ERROR.ACCESS_DENIED);
		}

		const inviteRows = await database
			.select({
				id: claimInvite.id,
				token: claimInvite.token,
				createdAt: claimInvite.createdAt,
				usedAt: claimInvite.usedAt,
				revokedAt: claimInvite.revokedAt,
			})
			.from(claimInvite)
			.where(
				and(
					eq(claimInvite.wishlistId, wishlistId),
					isNull(claimInvite.usedAt),
					isNull(claimInvite.revokedAt),
				),
			)
			.orderBy(claimInvite.createdAt);

		const pendingInvites: PendingClaimInvite[] = inviteRows.map((row) => ({
			id: row.id,
			token: row.token,
			createdAt: row.createdAt,
			usedAt: row.usedAt,
			revokedAt: row.revokedAt,
		}));

		return {
			pendingInvites,
			isForSomeoneElse: wishlistRow.recipientUserId === null,
			recipientName: wishlistRow.recipientName,
		};
	},
);

// ── Commands ─────────────────────────────────────────────────────────────────

/**
 * Generate a claim link („Pozvat obdarovaného"). Any manager may generate; rejected on
 * archived lists and on linked-recipient lists (nothing to claim). Mirrors the moderator
 * invite flow, including the optional email send (both modes).
 */
export const generateClaimInviteLink = guardedCommand(
	GenerateClaimInviteInputSchema,
	async ({ user: currentUser }, input) => {
		const database = getDb();
		const { wishlistRow } = await verifyManagerAccess(currentUser.id, input.wishlistId);

		if (wishlistRow.status === 'archived') {
			error(400, SERVER_ERROR.CANNOT_INVITE_ON_ARCHIVED);
		}
		// A linked recipient already has an account — there is nothing to claim.
		if (wishlistRow.recipientUserId !== null) {
			error(400, SERVER_ERROR.CLAIM_NOT_FOR_LINKED_RECIPIENT);
		}

		const [created] = await database
			.insert(claimInvite)
			.values({
				wishlistId: input.wishlistId,
				createdByUserId: currentUser.id,
			})
			.returning();

		if (created === undefined) {
			error(500, SERVER_ERROR.FAILED_TO_CREATE_INVITE);
		}

		const claimPath = `/w/${wishlistRow.shortId}/claim/${created.token}`;

		// When an email is supplied we email the claim link regardless of whether the address
		// belongs to an account (the claim page handles register-then-claim). Look it up so the
		// správce can be told the invitee has no account yet.
		let unregisteredInvitee = false;
		if (input.email !== undefined && input.email !== '') {
			const existingUser = await database
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, input.email.toLowerCase()))
				.limit(1);
			unregisteredInvitee = existingUser[0] === undefined;

			await dispatchNotification({
				type: NOTIFICATION_TYPE.CLAIM_INVITED,
				targetEmails: [input.email],
				wishlistId: input.wishlistId,
				actorId: currentUser.id,
				actorName: currentUser.name,
				urlPathOverride: claimPath,
			});
		}

		return { token: created.token, claimPath, unregisteredInvitee };
	},
);

/**
 * Claim a list (logged-in). Links `recipientUserId` = claimer and CLEARS `recipientName`
 * (the account name becomes canonical). Spoiler guards:
 *  1. If the list was ever shared, reject a claimer who ever held správce access — including
 *     revoked/soft-deleted assignment rows (catches the Part 1 flip's auto-assignment). This
 *     keeps the "recipient never saw reservations" promise honest against flip → claim-back
 *     laundering. Skipped entirely when the list was never shared.
 *  2. Reject while the claimer holds active reservations on the list (a recipient never sees
 *     reservation state, so their own would silently vanish — cancel first).
 * A current active správce claiming a never-shared list is allowed; their assignment is
 * soft-deleted in the same transaction (the list becomes linked, so the orphan guard is
 * inherently satisfied). Active správci (minus the claimer) get an in-app notification.
 */
export const acceptClaimInvite = guardedCommand(
	AcceptClaimInviteInputSchema,
	async ({ user: currentUser }, input) => {
		const database = getDb();

		const inviteRows = await database
			.select()
			.from(claimInvite)
			.where(eq(claimInvite.token, input.token))
			.limit(1);

		const invite = inviteRows[0];
		if (invite === undefined) {
			error(404, SERVER_ERROR.INVITE_NOT_FOUND);
		}
		if (invite.revokedAt !== null) {
			error(400, SERVER_ERROR.INVITE_ALREADY_REVOKED);
		}
		if (invite.usedAt !== null) {
			error(400, SERVER_ERROR.INVITE_ALREADY_USED);
		}

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
		// The list was linked in the meantime — nothing left to claim.
		if (wishlistRow.recipientUserId !== null) {
			error(400, SERVER_ERROR.CLAIM_ALREADY_LINKED);
		}

		// Guard 1: spoiler protection. Only meaningful once the list was shared (reservations can
		// only exist post-share). Reject if the claimer holds ANY assignment row for this list —
		// active OR soft-deleted — so a flip → claim-back cannot launder reservation visibility.
		if (wishlistRow.sharedAt !== null) {
			const priorAssignmentRows = await database
				.select({ id: moderatorAssignment.id })
				.from(moderatorAssignment)
				.where(
					and(
						eq(moderatorAssignment.wishlistId, invite.wishlistId),
						eq(moderatorAssignment.userId, currentUser.id),
					),
				)
				.limit(1);
			if (priorAssignmentRows[0] !== undefined) {
				error(400, SERVER_ERROR.CLAIM_EX_MANAGER);
			}
		}

		// Guard 2: the claimer must hold no active reservations on this list — a recipient never
		// sees reservation state, so their own reservations would silently disappear from view.
		const activeReservationRows = await database
			.select({ id: reservation.id })
			.from(reservation)
			.innerJoin(gift, eq(reservation.giftId, gift.id))
			.where(
				and(
					eq(gift.wishlistId, invite.wishlistId),
					eq(reservation.userId, currentUser.id),
					isNull(reservation.deletedAt),
					isNull(gift.deletedAt),
				),
			)
			.limit(1);
		if (activeReservationRows[0] !== undefined) {
			error(400, SERVER_ERROR.CLAIM_HAS_RESERVATIONS);
		}

		// Active správci to notify (captured before the claimer's own assignment, if any, is
		// soft-deleted below); the claimer is filtered out of the recipient list.
		const managerRows = await database
			.select({ userId: moderatorAssignment.userId })
			.from(moderatorAssignment)
			.where(
				and(
					eq(moderatorAssignment.wishlistId, invite.wishlistId),
					isNull(moderatorAssignment.deletedAt),
				),
			);

		const result = await database.transaction(async (tx) => {
			await tx
				.update(claimInvite)
				.set({ usedByUserId: currentUser.id, usedAt: new Date() })
				.where(eq(claimInvite.id, invite.id));

			await tx
				.update(wishlist)
				.set({
					recipientUserId: currentUser.id,
					recipientName: null,
					recipientIsModerator: false,
					updatedAt: new Date(),
				})
				.where(eq(wishlist.id, invite.wishlistId));

			// If the claimer is themselves an active správce (only reachable on never-shared lists —
			// guard 1 blocks shared ones), soft-delete that assignment: they become the linked
			// recipient and must not also hold reservation visibility.
			await tx
				.update(moderatorAssignment)
				.set({ deletedAt: new Date() })
				.where(
					and(
						eq(moderatorAssignment.wishlistId, invite.wishlistId),
						eq(moderatorAssignment.userId, currentUser.id),
						isNull(moderatorAssignment.deletedAt),
					),
				);

			// A visitor may have followed this free-text-recipient list before claiming it.
			// Soft-delete that relationship atomically so recipient-only views cannot retain
			// reservation-derived followed-list data after the role transition.
			await tx
				.update(wishlistFollower)
				.set({ unfollowedAt: new Date() })
				.where(
					and(
						eq(wishlistFollower.wishlistId, invite.wishlistId),
						eq(wishlistFollower.userId, currentUser.id),
						isNull(wishlistFollower.unfollowedAt),
					),
				);

			return {
				wishlistId: invite.wishlistId,
				wishlistShortId: wishlistRow.shortId,
				wishlistTitle: wishlistRow.title,
			};
		});

		// Heads-up to the active správci (minus the claimer) that the recipient linked their
		// account. In-app only (RECIPIENT_CLAIMED is not an email type).
		await dispatchNotification({
			type: NOTIFICATION_TYPE.RECIPIENT_CLAIMED,
			targetUserIds: managerRows
				.map((row) => row.userId)
				.filter((targetUserId) => targetUserId !== currentUser.id),
			wishlistId: invite.wishlistId,
			actorId: currentUser.id,
			actorName: currentUser.name,
		});

		// Single-flight refresh (issue #108, REQ-3/4): the claimed list appears in the
		// claimer's "Moje seznamy" (and, if they held a správce assignment, disappears from
		// "Spravované") without a reload. Untracked queries are a no-op.
		singleFlightRefresh(getWishlistByShortId, result.wishlistShortId);
		singleFlightRefresh(getMyWishlists);
		singleFlightRefresh(getModeratedWishlists);
		singleFlightRefresh(getFollowedWishlists);
		singleFlightRefresh(getHomeOverview);

		return result;
	},
);

/**
 * Revoke a pending claim link. Any manager may revoke. Mirrors `revokeModeratorInvite`.
 */
export const revokeClaimInvite = guardedCommand(
	RevokeClaimInviteInputSchema,
	async ({ user: currentUser }, input) => {
		const database = getDb();

		const inviteRows = await database
			.select()
			.from(claimInvite)
			.where(eq(claimInvite.id, input.inviteId))
			.limit(1);

		const invite = inviteRows[0];
		if (invite === undefined) {
			error(404, SERVER_ERROR.INVITE_NOT_FOUND);
		}

		await verifyManagerAccess(currentUser.id, invite.wishlistId);

		if (invite.usedAt !== null) {
			error(400, SERVER_ERROR.INVITE_ALREADY_USED);
		}
		if (invite.revokedAt !== null) {
			error(400, SERVER_ERROR.INVITE_ALREADY_REVOKED);
		}

		await database
			.update(claimInvite)
			.set({ revokedAt: new Date() })
			.where(eq(claimInvite.id, input.inviteId));
	},
);
