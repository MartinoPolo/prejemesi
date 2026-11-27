import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { gift } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { isOwnerSharedGiftDeleteGraceOpen } from '$lib/modules/gifts/gift_deletion_rules.js';
import { giftFollowsStrictPostShareRules } from '$lib/modules/gifts/gift_strict_post_share_rules.js';
import { galleryImageKeys } from '$lib/modules/gifts/gift_images.js';
import type { MutationOperationContext } from './operation.js';
import type { GiftRow } from './gift_presentation_update.js';
import type { ManagedWishlist, WishlistRow } from './wishlist_management.js';
import { giftHasActiveReservation, loadReservedGiftIds } from './wishlist_kind_rules.js';
import { deleteUnreferencedGiftImagesBestEffort } from './gift_gallery.js';
import {
	leaveLinkGroup,
	loadSharedGiftSiblings,
	sharedGiftRecipientUserIds,
	type LinkGroupMember,
} from './gift_link_group.js';

/**
 * Whether a shared gift (issue #737) has an active reservation on any of its other rows: reserving
 * it gives it to all its recipients at once. False without shared siblings.
 */
export async function sharedGiftIsReserved(
	transaction: MutationOperationContext['transaction'],
	sharedGiftSiblings: readonly LinkGroupMember[],
): Promise<boolean> {
	const siblingGiftIds = sharedGiftSiblings.map((member) => member.giftId);
	return (await loadReservedGiftIds(transaction, siblingGiftIds)).size > 0;
}

/** One list's row of a gift, as the recipient's post-share deletion grace sees it. */
interface ShareGraceRow {
	wishlist: Pick<WishlistRow, 'kind' | 'sharedAt' | 'deletedAt' | 'recipientUserId'>;
	giftCreatedAt: Date;
}

/**
 * The rows whose recipient deletion grace limits this delete: the own row for the recipient, and
 * every row of a shared gift for one of its recipients, even on a list they manage. None for a
 * správce, who sees reservation state.
 */
function recipientDeleteGraceRows(deletion: {
	actorUserId: string;
	role: ManagedWishlist['role'];
	ownRow: ShareGraceRow;
	sharedGiftSiblings: readonly LinkGroupMember[];
}): ShareGraceRow[] {
	const { actorUserId, role, ownRow, sharedGiftSiblings } = deletion;
	const actorReceivesSharedGift =
		sharedGiftSiblings.length > 0 &&
		sharedGiftRecipientUserIds([
			ownRow.wishlist,
			...sharedGiftSiblings.map((member) => member.wishlist),
		]).has(actorUserId);
	if (actorReceivesSharedGift) {
		return [
			ownRow,
			...sharedGiftSiblings.map((member) => ({
				wishlist: member.wishlist,
				giftCreatedAt: member.createdAt,
			})),
		];
	}
	return role === WISHLIST_ROLES.recipient ? [ownRow] : [];
}

/** Whether a row's list shared the gift under the strict rules and its delete grace has passed. */
function recipientDeleteGraceClosed(
	graceRow: ShareGraceRow,
	hasActiveReservation: boolean,
	now: Date,
): boolean {
	const { wishlist: graceWishlist, giftCreatedAt } = graceRow;
	return (
		graceWishlist.deletedAt === null &&
		graceWishlist.sharedAt !== null &&
		giftFollowsStrictPostShareRules(graceWishlist.kind, hasActiveReservation) &&
		!isOwnerSharedGiftDeleteGraceOpen(
			{ wishlistSharedAt: graceWishlist.sharedAt, giftCreatedAt },
			now,
		)
	);
}

/**
 * Soft-deletes a gift under the deletion rules: on a shared wishlist the recipient may delete only
 * within the share grace (pre-share gift) or creation grace (post-share gift), and nobody deletes a
 * reserved gift. Správci see reservation state, so they are exempt from the grace limits, and so
 * is an unreserved gift on a permanent wishlist. The caller holds the gift row FOR UPDATE, so a
 * reservation state it already read under that lock may be passed in instead of re-queried.
 * Only reservations made on this copy count; a linked copy then leaves its group, and the other
 * copies keep theirs. A shared gift is reserved for all its recipients at once, so a reservation
 * on any of its rows blocks removing it from any list (issue #737). Its recipients, even on a list
 * they manage, get the recipient grace of every list first, so the reserved block cannot reveal
 * its surprise. The caller holds the group locked (`lockLinkedCopies`).
 */
export async function softDeleteGift(
	context: MutationOperationContext,
	giftRow: GiftRow,
	managedWishlist: ManagedWishlist,
	knownReservationState?: { hasActiveReservation: boolean },
): Promise<void> {
	const { transaction, now } = context;
	const { role, wishlistRow } = managedWishlist;
	const sharedGiftSiblings = await loadSharedGiftSiblings(transaction, giftRow);
	const hasActiveReservation =
		(await sharedGiftIsReserved(transaction, sharedGiftSiblings)) ||
		(knownReservationState?.hasActiveReservation ??
			(await giftHasActiveReservation(transaction, giftRow.id)));
	const graceRows = recipientDeleteGraceRows({
		actorUserId: context.actor.userId,
		role,
		ownRow: { wishlist: wishlistRow, giftCreatedAt: giftRow.createdAt },
		sharedGiftSiblings,
	});
	const deleteGraceClosed = graceRows.some((graceRow) =>
		recipientDeleteGraceClosed(graceRow, hasActiveReservation, now),
	);
	if (deleteGraceClosed) {
		error(403, SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING);
	}

	if (hasActiveReservation) {
		error(400, SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT);
	}

	await transaction
		.update(gift)
		.set({ deletedAt: now, updatedAt: now })
		.where(eq(gift.id, giftRow.id));
	await leaveLinkGroup(transaction, giftRow);
	context.recordGiftRevisions([
		{
			giftId: giftRow.id,
			wishlistId: giftRow.wishlistId,
			before: giftRow,
			after: { ...giftRow, deletedAt: now },
		},
	]);

	// Storage cleanup (issue #107): the uploaded images are unreachable once the gift is deleted.
	const deletedImageKeys = galleryImageKeys(giftRow.images);
	context.deferEffect(() => deleteUnreferencedGiftImagesBestEffort(deletedImageKeys));
}
