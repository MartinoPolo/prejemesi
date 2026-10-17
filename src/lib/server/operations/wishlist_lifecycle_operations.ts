import * as v from 'valibot';
import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { rejectDemoOperation } from '$lib/server/demo/scope.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { FlipRecipientToFreeTextInputSchema } from '$lib/modules/wishlists/types.js';
import { assertWishlistMutable } from '$lib/modules/wishlists/wishlist_access.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import {
	activeFollowerUserIds,
	activeModeratorUserIds,
	requireLiveWishlistRow,
	requireWishlistManagement,
	resolveWishlistAccess,
} from './wishlist_management.js';
import {
	assertRevertAllowed,
	cancelActiveReservations,
	clearPostShareGiftState,
	resolveRevertAccess,
	type CancelledReserver,
} from './wishlist_revert.js';

const WishlistLifecycleInputSchema = v.strictObject({ wishlistId: v.string() });

function withoutActor(context: MutationOperationContext, userIds: readonly string[]): string[] {
	return userIds.filter((userId) => userId !== context.actor.userId);
}

/**
 * Shares a draft: it becomes active and the post-share grace window opens. The first share is
 * recorded for good; reverting to draft keeps it.
 */
export const shareWishlistOperation = defineOperation({
	name: 'shareWishlist',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: WishlistLifecycleInputSchema,
	async run(context, input) {
		rejectDemoOperation();
		const { wishlistRow } = await requireWishlistManagement(
			context.transaction,
			context.actor.userId,
			input.wishlistId,
			{ lock: true },
		);
		if (wishlistRow.status === 'archived') {
			error(400, SERVER_ERROR.CANNOT_SHARE_ARCHIVED_WISHLIST);
		}
		if (wishlistRow.sharedAt !== null) {
			return { shortId: wishlistRow.shortId, alreadyShared: true } as const;
		}
		await context.transaction
			.update(wishlist)
			.set({
				sharedAt: context.now,
				firstSharedAt: wishlistRow.firstSharedAt ?? context.now,
				status: 'active',
				updatedAt: context.now,
			})
			.where(eq(wishlist.id, input.wishlistId));
		return { shortId: wishlistRow.shortId, alreadyShared: false } as const;
	},
});

/** Registered reservers are notified in-app and by email, anonymous ones by email; never the actor. */
function notifyCancelledReserversAfterCommit(
	context: MutationOperationContext,
	wishlistId: string,
	cancelledReservers: readonly CancelledReserver[],
): void {
	const targetUserIds = withoutActor(
		context,
		cancelledReservers.flatMap((reserver) => reserver.userId ?? []),
	);
	const targetEmails = cancelledReservers.flatMap((reserver) =>
		reserver.anonymousEmail === null || reserver.anonymousEmail === ''
			? []
			: [reserver.anonymousEmail],
	);
	context.deferEffect(() =>
		dispatchNotification({
			type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
			targetUserIds,
			targetEmails,
			wishlistId,
			actorId: context.actor.userId,
			actorName: context.actor.userName,
		}),
	);
}

/**
 * Reverts a shared list to draft. A správce reverts a reservation-free list silently; with
 * reservations only an administrator may, cancelling them and notifying the reservers.
 */
export const revertWishlistToDraftOperation = defineOperation({
	name: 'revertWishlistToDraft',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: WishlistLifecycleInputSchema,
	async run(context, input) {
		// Locked before counting reservations so the capability holds until the batch commits.
		const { role, wishlistRow } = await resolveWishlistAccess(
			context.transaction,
			context.actor.userId,
			input.wishlistId,
			{ lock: true },
		);
		const access = { role, wishlistRow, isAppAdministrator: context.actor.isAppAdministrator };
		const { capability, hasReservations } = await resolveRevertAccess(
			context.transaction,
			access,
		);
		assertRevertAllowed(capability, access);
		if (hasReservations) {
			const cancelledReservers = await cancelActiveReservations(context, input.wishlistId);
			notifyCancelledReserversAfterCommit(context, input.wishlistId, cancelledReservers);
		}
		await clearPostShareGiftState(context, input.wishlistId);
		// Clearing `sharedAt` releases the event-date lock; a re-share opens a fresh grace window.
		// `firstSharedAt` stays: the recipient's copy-only rule outlives the revert.
		await context.transaction
			.update(wishlist)
			.set({
				status: 'draft',
				sharedAt: null,
				eventDateEditedAt: null,
				updatedAt: context.now,
			})
			.where(eq(wishlist.id, input.wishlistId));
		return { shortId: wishlistRow.shortId, reverted: true } as const;
	},
});

/** Archives the list read-only and tells its followers and správci. */
export const archiveWishlistOperation = defineOperation({
	name: 'archiveWishlist',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: WishlistLifecycleInputSchema,
	async run(context, input) {
		const { wishlistRow } = await requireWishlistManagement(
			context.transaction,
			context.actor.userId,
			input.wishlistId,
			{ lock: true },
		);
		const [archived] = await context.transaction
			.update(wishlist)
			.set({ status: 'archived', archivedAt: context.now, updatedAt: context.now })
			.where(eq(wishlist.id, input.wishlistId))
			.returning();
		const targetUserIds = withoutActor(context, [
			...(await activeFollowerUserIds(context.transaction, input.wishlistId)),
			...(await activeModeratorUserIds(context.transaction, input.wishlistId)),
		]);
		context.deferEffect(() =>
			dispatchNotification({
				type: NOTIFICATION_TYPE.WISHLIST_ARCHIVED,
				targetUserIds,
				wishlistId: input.wishlistId,
				actorId: context.actor.userId,
				actorName: context.actor.userName,
				wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
			}),
		);
		return { wishlist: archived, wishlistShortId: wishlistRow.shortId };
	},
});

/** Soft-deletes an unshared list; a shared list must be archived instead. */
export const deleteWishlistOperation = defineOperation({
	name: 'deleteWishlist',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: WishlistLifecycleInputSchema,
	async run(context, input) {
		const { wishlistRow } = await requireWishlistManagement(
			context.transaction,
			context.actor.userId,
			input.wishlistId,
			{ lock: true },
		);
		if (wishlistRow.sharedAt !== null) {
			error(400, 'Cannot delete a shared wishlist. Archive it instead.');
		}
		const giftImageRows = await context.transaction
			.select({ imageKey: gift.imageKey })
			.from(gift)
			.where(and(eq(gift.wishlistId, input.wishlistId), isNull(gift.deletedAt)));
		await context.transaction
			.update(wishlist)
			.set({ deletedAt: context.now, updatedAt: context.now })
			.where(eq(wishlist.id, input.wishlistId));
		// The list's own and its gifts' uploaded images become unreachable with it.
		const unreachableImageKeys = [
			wishlistRow.imageKey,
			...giftImageRows.map((row) => row.imageKey),
		];
		context.deferEffect(() => deleteObjectsBestEffort(unreachableImageKeys));
		return { wishlistShortId: wishlistRow.shortId };
	},
});

/**
 * The linked recipient turns their own list into a for-someone list and keeps managing it as a
 * správce. On a shared list followers learn the actor now sees reservations.
 */
export const flipRecipientToFreeTextOperation = defineOperation({
	name: 'flipRecipientToFreeText',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: FlipRecipientToFreeTextInputSchema,
	async run(context, input) {
		// The lock makes a concurrent second flip wait, re-read the flipped row and get a 403.
		const wishlistRow = await requireLiveWishlistRow(context.transaction, input.id, {
			lock: true,
		});
		if (wishlistRow.recipientUserId !== context.actor.userId) {
			error(403, SERVER_ERROR.ACCESS_DENIED);
		}
		assertWishlistMutable(wishlistRow);
		const [updated] = await context.transaction
			.update(wishlist)
			.set({
				recipientUserId: null,
				recipientName: input.recipientName,
				recipientIsModerator: false,
				updatedAt: context.now,
			})
			.where(eq(wishlist.id, input.id))
			.returning();
		// A linked recipient never holds an active assignment, so a plain insert is safe.
		await context.transaction
			.insert(moderatorAssignment)
			.values({ wishlistId: input.id, userId: context.actor.userId });
		if (wishlistRow.sharedAt !== null) {
			const targetUserIds = withoutActor(
				context,
				await activeFollowerUserIds(context.transaction, input.id),
			);
			context.deferEffect(() =>
				dispatchNotification({
					type: NOTIFICATION_TYPE.RECIPIENT_SELF_PROMOTED,
					targetUserIds,
					wishlistId: input.id,
					actorId: context.actor.userId,
					actorName: context.actor.userName,
				}),
			);
		}
		return { wishlist: updated, wishlistShortId: wishlistRow.shortId };
	},
});
