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

interface EditedGiftReserver {
	userId: string | null;
	email: string | null;
	giftIds: Set<string>;
}

interface NotificationGroup {
	wishlistId: string;
	wishlist: { title: string; shortId: string };
	gifts: ReservedGiftEdit[];
	targetUserIds: string[];
	targetEmails: string[];
}

/** Every reserver (account or anonymous email) of the edited gifts other than the editing actor. */
async function loadEditedGiftReservers(
	transaction: DatabaseTransaction,
	editedGiftIds: readonly string[],
	actor: OperationActor,
): Promise<EditedGiftReserver[]> {
	const reservationRows = await transaction
		.select({
			giftId: reservation.giftId,
			userId: reservation.userId,
			anonymousEmail: reservation.anonymousEmail,
		})
		.from(reservation)
		.where(and(inArray(reservation.giftId, editedGiftIds), isNull(reservation.deletedAt)));

	const reserversByKey = new Map<string, EditedGiftReserver>();
	const addReservedGift = (
		reserverKey: string,
		reserver: { userId: string | null; email: string | null },
		giftId: string,
	) => {
		const entry = reserversByKey.get(reserverKey) ?? { ...reserver, giftIds: new Set() };
		entry.giftIds.add(giftId);
		reserversByKey.set(reserverKey, entry);
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
	return [...reserversByKey.values()];
}

function groupEditsByWishlist(edits: readonly ReservedGiftEdit[]): ReservedGiftEdit[][] {
	const editsByWishlistId = new Map<string, ReservedGiftEdit[]>();
	for (const edit of edits) {
		editsByWishlistId.set(edit.wishlistId, [
			...(editsByWishlistId.get(edit.wishlistId) ?? []),
			edit,
		]);
	}
	return [...editsByWishlistId.values()];
}

function addNotificationTarget(group: NotificationGroup, reserver: EditedGiftReserver): void {
	if (reserver.userId !== null) {
		group.targetUserIds.push(reserver.userId);
	}
	if (reserver.email !== null) {
		group.targetEmails.push(reserver.email);
	}
}

/** Reservers who reserved exactly the same edited gifts on a wishlist share one group. */
function groupReserversByReservedEdits(
	reservers: readonly EditedGiftReserver[],
	edits: readonly ReservedGiftEdit[],
): NotificationGroup[] {
	const groups = new Map<string, NotificationGroup>();
	for (const reserver of reservers) {
		const reservedEdits = edits.filter((edit) => reserver.giftIds.has(edit.giftId));
		for (const wishlistEdits of groupEditsByWishlist(reservedEdits)) {
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
			addNotificationTarget(group, reserver);
			groups.set(groupKey, group);
		}
	}
	return [...groups.values()];
}

function toReservedGiftEditedNotification(
	group: NotificationGroup,
	actor: OperationActor,
): DispatchNotificationInput {
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
	const reservers = await loadEditedGiftReservers(transaction, [...editsByGiftId.keys()], actor);
	return groupReserversByReservedEdits(reservers, [...editsByGiftId.values()]).map((group) =>
		toReservedGiftEditedNotification(group, actor),
	);
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
