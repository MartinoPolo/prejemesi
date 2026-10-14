import { and, inArray, isNull } from 'drizzle-orm';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { reservation } from '$lib/server/db/gift.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import {
	NOTIFICATION_TYPE,
	type DispatchNotificationInput,
} from '$lib/modules/notifications/types.js';
import type { OperationActor } from './actor.js';
import { RESERVER_NOTIFICATION_CONCURRENCY } from './constants.js';

/** A správce edit to a gift that reservers must hear about. */
export interface ReservedGiftEdit {
	giftId: string;
	giftName: string;
	wishlistId: string;
	wishlist: { title: string; shortId: string };
}

interface NotificationGroup {
	wishlistId: string;
	wishlist: { title: string; shortId: string };
	gifts: ReservedGiftEdit[];
	targetUserIds: string[];
	targetEmails: string[];
}

/**
 * Plans at most one notification per reserver for a batch: each reserver (account or anonymous
 * email) gets every edited gift they reserved on a wishlist in one dispatch, and reservers sharing
 * the same gift set share a dispatch. Reads reservations inside the batch transaction.
 */
export async function planReservedGiftEditNotifications(
	transaction: DatabaseTransaction,
	edits: readonly ReservedGiftEdit[],
	actor: OperationActor,
): Promise<DispatchNotificationInput[]> {
	const editsByGiftId = new Map(edits.map((edit) => [edit.giftId, edit]));
	if (editsByGiftId.size === 0) {
		return [];
	}

	const reservationRows = await transaction
		.select({
			giftId: reservation.giftId,
			userId: reservation.userId,
			anonymousEmail: reservation.anonymousEmail,
		})
		.from(reservation)
		.where(
			and(
				inArray(reservation.giftId, [...editsByGiftId.keys()]),
				isNull(reservation.deletedAt),
			),
		);

	const giftIdsByReserver = new Map<
		string,
		{ userId: string | null; email: string | null; giftIds: Set<string> }
	>();
	const addReservedGift = (
		reserverKey: string,
		reserver: { userId: string | null; email: string | null },
		giftId: string,
	) => {
		const entry = giftIdsByReserver.get(reserverKey) ?? { ...reserver, giftIds: new Set() };
		entry.giftIds.add(giftId);
		giftIdsByReserver.set(reserverKey, entry);
	};
	for (const row of reservationRows) {
		if (row.userId !== null && row.userId !== actor.userId) {
			addReservedGift(`user:${row.userId}`, { userId: row.userId, email: null }, row.giftId);
		}
		if (row.anonymousEmail !== null && row.anonymousEmail !== '') {
			addReservedGift(
				`email:${row.anonymousEmail}`,
				{ userId: null, email: row.anonymousEmail },
				row.giftId,
			);
		}
	}

	const groups = new Map<string, NotificationGroup>();
	for (const reserver of giftIdsByReserver.values()) {
		const reservedEdits = [...editsByGiftId.values()].filter((edit) =>
			reserver.giftIds.has(edit.giftId),
		);
		const editsByWishlistId = new Map<string, ReservedGiftEdit[]>();
		for (const edit of reservedEdits) {
			editsByWishlistId.set(edit.wishlistId, [
				...(editsByWishlistId.get(edit.wishlistId) ?? []),
				edit,
			]);
		}
		for (const wishlistEdits of editsByWishlistId.values()) {
			const [firstEdit] = wishlistEdits;
			if (firstEdit === undefined) {
				continue;
			}
			const groupKey = `${firstEdit.wishlistId}:${wishlistEdits.map((edit) => edit.giftId).join(',')}`;
			const group = groups.get(groupKey) ?? {
				wishlistId: firstEdit.wishlistId,
				wishlist: firstEdit.wishlist,
				gifts: wishlistEdits,
				targetUserIds: [],
				targetEmails: [],
			};
			if (reserver.userId !== null) {
				group.targetUserIds.push(reserver.userId);
			}
			if (reserver.email !== null) {
				group.targetEmails.push(reserver.email);
			}
			groups.set(groupKey, group);
		}
	}

	return [...groups.values()].map((group) => {
		const [singleGift] = group.gifts;
		const giftDetails =
			group.gifts.length === 1 && singleGift !== undefined
				? { giftId: singleGift.giftId, giftName: singleGift.giftName }
				: { giftNames: group.gifts.map((gift) => gift.giftName) };
		return {
			type: NOTIFICATION_TYPE.RESERVED_GIFT_EDITED,
			targetUserIds: group.targetUserIds,
			targetEmails: group.targetEmails,
			wishlistId: group.wishlistId,
			...giftDetails,
			actorId: actor.userId,
			actorName: actor.userName,
			wishlist: group.wishlist,
		};
	});
}

/** Best effort: a failed notification never fails the committed batch. */
export async function dispatchReservedGiftEditNotifications(
	notifications: readonly DispatchNotificationInput[],
): Promise<void> {
	let nextNotificationIndex = 0;
	const dispatchNext = async (): Promise<void> => {
		while (nextNotificationIndex < notifications.length) {
			const notificationInput = notifications[nextNotificationIndex++];
			if (notificationInput === undefined) {
				return;
			}
			try {
				await dispatchNotification(notificationInput);
			} catch (thrown) {
				console.error('[Notification] reserver edit notification failed', thrown);
			}
		}
	};
	await Promise.all(
		Array.from(
			{ length: Math.min(RESERVER_NOTIFICATION_CONCURRENCY, notifications.length) },
			dispatchNext,
		),
	);
}
