import * as v from 'valibot';
import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { claimInvite } from '$lib/server/db/claim.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { rejectDemoOperation } from '$lib/server/demo/scope.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import {
	AcceptClaimInviteInputSchema,
	GenerateClaimInviteInputSchema,
	RevokeClaimInviteInputSchema,
	type ClaimInvitesData,
} from '$lib/modules/claim/types.js';
import { requireOperationActor } from './actor.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import {
	assertWishlistTakesInvites,
	createInviteLink,
	lockAcceptableInvite,
	markInviteUsed,
	readPendingInvites,
	revokePendingInvite,
} from './invite_links.js';
import { optionalEmail } from './optional_email.js';
import {
	activeModeratorUserIds,
	requireLiveWishlistRow,
	requireWishlistManagement,
	type WishlistRow,
} from './wishlist_management.js';

/**
 * Pending claim invites for the správce panel nudge, visible to any manager. Human-only: it
 * returns live claim tokens, and a claim transfers ownership of the list.
 */
export const readClaimInvitesOperation = defineOperation({
	name: 'readClaimInvites',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: v.strictObject({ wishlistId: v.string() }),
	async run(context, input): Promise<ClaimInvitesData> {
		const actor = requireOperationActor(context.actor);
		const database = getDb();
		const { wishlistRow } = await requireWishlistManagement(
			database,
			actor.userId,
			input.wishlistId,
			{ lock: false },
		);
		return {
			pendingInvites: await readPendingInvites(database, claimInvite, input.wishlistId),
			isForSomeoneElse: wishlistRow.recipientUserId === null,
			recipientName: wishlistRow.recipientName,
		};
	},
});

/**
 * A claim link („Pozvat obdarovaného") from any manager, optionally emailed. Only a free-text
 * recipient can be claimed: a linked recipient already has an account.
 */
export const generateClaimInviteLinkOperation = defineOperation({
	name: 'generateClaimInviteLink',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: GenerateClaimInviteInputSchema,
	async run(context, input) {
		rejectDemoOperation();
		const { wishlistRow } = await requireWishlistManagement(
			context.transaction,
			context.actor.userId,
			input.wishlistId,
			{ lock: true },
		);
		assertWishlistTakesInvites(wishlistRow);
		if (wishlistRow.recipientUserId !== null) {
			error(400, SERVER_ERROR.CLAIM_NOT_FOR_LINKED_RECIPIENT);
		}
		const inviteeEmail = optionalEmail(input.email);
		const invite = await createInviteLink(context, {
			inviteTable: claimInvite,
			wishlistRow,
			pathSegment: 'claim',
			email: inviteeEmail,
		});
		if (inviteeEmail !== null) {
			context.deferEffect(() =>
				dispatchNotification({
					type: NOTIFICATION_TYPE.CLAIM_INVITED,
					targetEmails: [inviteeEmail],
					wishlistId: wishlistRow.id,
					actorId: context.actor.userId,
					actorName: context.actor.userName,
					urlPathOverride: invite.path,
				}),
			);
		}
		return {
			token: invite.token,
			claimPath: invite.path,
			unregisteredInvitee: invite.unregisteredInvitee,
		};
	},
});

async function requireClaimableWishlist(
	context: MutationOperationContext,
	wishlistId: string,
): Promise<WishlistRow> {
	const wishlistRow = await requireLiveWishlistRow(context.transaction, wishlistId, {
		lock: true,
	});
	assertWishlistTakesInvites(wishlistRow);
	// The list was linked in the meantime: nothing is left to claim.
	if (wishlistRow.recipientUserId !== null) {
		error(400, SERVER_ERROR.CLAIM_ALREADY_LINKED);
	}
	return wishlistRow;
}

/**
 * Once a list was shared, a claimer who ever held správce access (even a revoked assignment, so a
 * flip → claim-back cannot launder reservation visibility) is rejected.
 */
async function assertClaimerNeverManagedSharedList(
	context: MutationOperationContext,
	wishlistRow: WishlistRow,
): Promise<void> {
	if (wishlistRow.sharedAt === null) {
		return;
	}
	const [priorAssignment] = await context.transaction
		.select({ id: moderatorAssignment.id })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistRow.id),
				eq(moderatorAssignment.userId, context.actor.userId),
			),
		)
		.limit(1);
	if (priorAssignment !== undefined) {
		error(400, SERVER_ERROR.CLAIM_EX_MANAGER);
	}
}

/** A recipient never sees reservation state, so the claimer's own reservations would vanish. */
async function assertClaimerHoldsNoReservations(
	context: MutationOperationContext,
	wishlistId: string,
): Promise<void> {
	const [activeReservation] = await context.transaction
		.select({ id: reservation.id })
		.from(reservation)
		.innerJoin(gift, eq(reservation.giftId, gift.id))
		.where(
			and(
				eq(gift.wishlistId, wishlistId),
				eq(reservation.userId, context.actor.userId),
				isNull(reservation.deletedAt),
				isNull(gift.deletedAt),
			),
		)
		.limit(1);
	if (activeReservation !== undefined) {
		error(400, SERVER_ERROR.CLAIM_HAS_RESERVATIONS);
	}
}

/**
 * The claimer becomes the linked recipient and the account name replaces the free-text one. A
 * claiming správce (only possible on a never-shared list) loses the assignment, and a claimer who
 * followed the list unfollows it, so no recipient view keeps reservation-derived data.
 */
async function linkClaimerAsRecipient(
	context: MutationOperationContext,
	wishlistId: string,
): Promise<void> {
	const claimerUserId = context.actor.userId;
	await context.transaction
		.update(wishlist)
		.set({
			recipientUserId: claimerUserId,
			recipientName: null,
			recipientIsModerator: false,
			updatedAt: context.now,
		})
		.where(eq(wishlist.id, wishlistId));
	await context.transaction
		.update(moderatorAssignment)
		.set({ deletedAt: context.now })
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				eq(moderatorAssignment.userId, claimerUserId),
				isNull(moderatorAssignment.deletedAt),
			),
		);
	await context.transaction
		.update(wishlistFollower)
		.set({ unfollowedAt: context.now })
		.where(
			and(
				eq(wishlistFollower.wishlistId, wishlistId),
				eq(wishlistFollower.userId, claimerUserId),
				isNull(wishlistFollower.unfollowedAt),
			),
		);
}

/** In-app only: the active správci other than the claimer, read before the claimer's assignment ends. */
async function notifyManagersOfClaimAfterCommit(
	context: MutationOperationContext,
	wishlistId: string,
): Promise<void> {
	const managerUserIds = await activeModeratorUserIds(context.transaction, wishlistId);
	context.deferEffect(() =>
		dispatchNotification({
			type: NOTIFICATION_TYPE.RECIPIENT_CLAIMED,
			targetUserIds: managerUserIds.filter((userId) => userId !== context.actor.userId),
			wishlistId,
			actorId: context.actor.userId,
			actorName: context.actor.userName,
		}),
	);
}

/** Claims a for-someone list for the signed-in account; an invite works once. */
export const acceptClaimInviteOperation = defineOperation({
	name: 'acceptClaimInvite',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: AcceptClaimInviteInputSchema,
	async run(context, input) {
		const invite = await lockAcceptableInvite(context, claimInvite, input.token);
		const wishlistRow = await requireClaimableWishlist(context, invite.wishlistId);
		await assertClaimerNeverManagedSharedList(context, wishlistRow);
		await assertClaimerHoldsNoReservations(context, wishlistRow.id);
		await notifyManagersOfClaimAfterCommit(context, wishlistRow.id);
		await markInviteUsed(context, claimInvite, invite.id);
		await linkClaimerAsRecipient(context, wishlistRow.id);
		return {
			wishlistId: wishlistRow.id,
			wishlistShortId: wishlistRow.shortId,
			wishlistTitle: wishlistRow.title,
		};
	},
});

/** Any manager may revoke a pending claim link. */
export const revokeClaimInviteOperation = defineOperation({
	name: 'revokeClaimInvite',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: RevokeClaimInviteInputSchema,
	run: (context, input) => revokePendingInvite(context, claimInvite, input.inviteId),
});
