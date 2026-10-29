import * as v from 'valibot';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { gift, giftLike, reservation } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { SERVER_ERROR, encodeServerError } from '$lib/modules/errors/server_error_codes.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { resolveRoleOnWishlistRow } from '$lib/modules/wishlists/wishlist_access.js';
import {
	canReleaseReservation,
	resolveReservationReleaseCapability,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import {
	ReserveGiftInputSchema,
	SetReservationPurchasedInputSchema,
	UnreserveInputSchema,
} from '$lib/modules/reservations/types.js';
import type { OperationActor } from './actor.js';
import { OPERATION_EXPOSURE, OPERATION_KIND, defineOperation } from './operation.js';
import { optionalEmail } from './optional_email.js';
import { executeAnonymousVisitorMutation, type AnonymousVisitorMutationContext } from './runner.js';
import { activeFollowerUserIds, type WishlistRow } from './wishlist_management.js';

type ReservationRow = typeof reservation.$inferSelect;
interface ReservationTarget {
	gift: typeof gift.$inferSelect;
	wishlist: WishlistRow;
}

/**
 * Who reserves or cancels. A signed-in caller is the operation actor; an anonymous visitor (UI
 * only) is identified by the per-browser capability cookie the adapter reads or mints.
 */
type ReservingParticipant =
	| { kind: 'user'; actor: OperationActor }
	| {
			kind: 'anonymousVisitor';
			name: string | undefined;
			email: string | undefined;
			/** Called only once the reservation fits, so a rejected one mints no cookie. */
			claimVisitorId(): string | null;
	  };
type CancellingParticipant =
	| { kind: 'user'; actor: OperationActor }
	| { kind: 'anonymousVisitor'; visitorId: string | null };

// Agent-exposed inputs reject unknown fields; the remote wire schemas stay as they are.
const SignedInReserveInputSchema = v.strictObject({
	giftId: ReserveGiftInputSchema.entries.giftId,
	quantity: ReserveGiftInputSchema.entries.quantity,
});
const AnonymousReserveInputSchema = v.pick(ReserveGiftInputSchema, [
	'giftId',
	'quantity',
	'anonymousName',
	'anonymousEmail',
]);
const StrictUnreserveInputSchema = v.strictObject({ ...UnreserveInputSchema.entries });
const StrictSetReservationPurchasedInputSchema = v.strictObject({
	...SetReservationPurchasedInputSchema.entries,
});

/** 404 unless the gift and its wishlist are live and in scope; `lockWishlist` holds the wishlist (shared). */
async function loadReservationTarget(
	transaction: DatabaseTransaction,
	giftId: string,
	options: { lockWishlist: boolean },
): Promise<ReservationTarget> {
	const targetQuery = transaction
		.select({ gift, wishlist })
		.from(gift)
		.innerJoin(wishlist, eq(gift.wishlistId, wishlist.id))
		.where(
			and(
				eq(gift.id, giftId),
				isNull(gift.deletedAt),
				isNull(wishlist.deletedAt),
				wishlistScope(),
			),
		);
	const [target] = options.lockWishlist
		? await targetQuery.for('share', { of: wishlist })
		: await targetQuery.limit(1);
	if (target === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}
	return target;
}

/** The reservation's identity columns; rejects the recipient and a nameless anonymous visitor. */
function reserverColumns(participant: ReservingParticipant, wishlistRow: WishlistRow) {
	if (participant.kind === 'user') {
		// The recipient cannot reserve their own gifts (protects the surprise). Správci may.
		if (participant.actor.userId === wishlistRow.recipientUserId) {
			error(403, SERVER_ERROR.RECIPIENT_CANNOT_RESERVE_OWN_GIFTS);
		}
		return { userId: participant.actor.userId };
	}
	const anonymousName = participant.name?.trim() ?? '';
	if (anonymousName === '') {
		error(400, SERVER_ERROR.ANONYMOUS_NAME_REQUIRED);
	}
	return { userId: null, anonymousName, anonymousEmail: optionalEmail(participant.email) };
}

/**
 * Locks the gift row so concurrent reservations of one gift serialize, then recounts the active
 * reservations under the lock: capacity enforcement must be atomic to prevent overbooking.
 */
async function lockAvailableGift(
	transaction: DatabaseTransaction,
	giftId: string,
	requestedQuantity: number,
): Promise<string> {
	const [lockedGift] = await transaction
		.select({ quantity: gift.quantity, name: gift.name })
		.from(gift)
		.where(and(eq(gift.id, giftId), isNull(gift.deletedAt)))
		.for('update')
		.limit(1);
	if (lockedGift === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}
	const [reserved] = await transaction
		.select({ totalQuantity: sql<number>`COALESCE(SUM(${reservation.quantity}), 0)` })
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)));
	const available = (lockedGift.quantity ?? 1) - Number(reserved?.totalQuantity ?? 0);
	if (requestedQuantity > available) {
		error(400, encodeServerError(SERVER_ERROR.NOT_ENOUGH_AVAILABLE, { available }));
	}
	return lockedGift.name;
}

/**
 * Likers and followers learn the gift was reserved, never the recipient or the reserver. Reserver
 * identity is personal data (issue #198): only the server-side actor id travels, never a name.
 * The audience is read after commit so the gift lock is not held while it is gathered.
 */
function notifyReservationAfterCommit(
	context: AnonymousVisitorMutationContext,
	params: { target: ReservationTarget; giftName: string; reserverUserId: string | null },
): void {
	const { target, giftName, reserverUserId } = params;
	const giftId = target.gift.id;
	const wishlistId = target.wishlist.id;
	const recipientUserId = target.wishlist.recipientUserId;
	const reservedGift = {
		wishlistId,
		giftId,
		giftName,
		actorId: reserverUserId ?? undefined,
		wishlist: { title: target.wishlist.title, shortId: target.wishlist.shortId },
	};
	const notifiedUserIds = (userIds: readonly string[]) =>
		userIds.filter((userId) => userId !== reserverUserId && userId !== recipientUserId);
	context.deferEffect(async () => {
		const database = getDb();
		const likedRows = await database
			.select({ userId: giftLike.userId })
			.from(giftLike)
			.where(and(eq(giftLike.giftId, giftId), isNull(giftLike.deletedAt)));
		const followerUserIds = await activeFollowerUserIds(database, wishlistId);
		await dispatchNotification({
			type: NOTIFICATION_TYPE.LIKED_GIFT_RESERVED,
			targetUserIds: notifiedUserIds(likedRows.map((row) => row.userId)),
			...reservedGift,
		});
		await dispatchNotification({
			type: NOTIFICATION_TYPE.GIFT_RESERVED,
			targetUserIds: notifiedUserIds(followerUserIds),
			...reservedGift,
		});
	});
}

async function reserveGiftForParticipant(
	context: AnonymousVisitorMutationContext,
	participant: ReservingParticipant,
	input: { giftId: string; quantity: number },
): Promise<{ reservationId: string; wishlistShortId: string }> {
	// Wishlist before gift, the order reverting locks in; the shared lock keeps archiving and
	// reverting out while reservations of other gifts proceed in parallel. Single gift edits take
	// only a key share lock on the wishlist, so they never wait on this lock.
	const target = await loadReservationTarget(context.transaction, input.giftId, {
		lockWishlist: true,
	});
	if (target.wishlist.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_RESERVE_ON_ARCHIVED);
	}
	const reserver = reserverColumns(participant, target.wishlist);
	const giftName = await lockAvailableGift(context.transaction, input.giftId, input.quantity);
	const anonymousVisitorId =
		participant.kind === 'anonymousVisitor' ? participant.claimVisitorId() : null;
	const [created] = await context.transaction
		.insert(reservation)
		.values({ giftId: input.giftId, quantity: input.quantity, ...reserver, anonymousVisitorId })
		.returning();
	if (created === undefined) {
		error(500, SERVER_ERROR.RESERVATION_FAILED);
	}
	notifyReservationAfterCommit(context, {
		target,
		giftName,
		reserverUserId: reserver.userId,
	});
	return { reservationId: created.id, wishlistShortId: target.wishlist.shortId };
}

/** Reserves units of a gift for the actor; the recipient never may (surprise protection). */
export const reserveGiftOperation = defineOperation({
	name: 'reserveGift',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: SignedInReserveInputSchema,
	run: (context, input) =>
		reserveGiftForParticipant(context, { kind: 'user', actor: context.actor }, input),
});

/** The anonymous visitor's reservation: a display name is required, an email optional. */
export function reserveGiftAsAnonymousVisitor(
	rawInput: unknown,
	claimVisitorId: () => string | null,
): Promise<{ reservationId: string; wishlistShortId: string }> {
	return executeAnonymousVisitorMutation(
		{
			operationName: reserveGiftOperation.name,
			input: AnonymousReserveInputSchema,
			run: (context, input) =>
				reserveGiftForParticipant(
					context,
					{
						kind: 'anonymousVisitor',
						name: input.anonymousName,
						email: input.anonymousEmail,
						claimVisitorId,
					},
					input,
				),
		},
		rawInput,
	);
}

/**
 * Issue #213 release of someone else's reservation: a správce reaches guest reservations only, an
 * administrator any, the recipient none. A non-administrator is rejected on a signed-in gifter's
 * row before any further statement.
 */
async function authorizeRelease(
	transaction: DatabaseTransaction,
	actor: OperationActor,
	reservationRow: ReservationRow,
): Promise<ReservationTarget> {
	const reservationIsGuest = reservationRow.userId === null;
	if (!reservationIsGuest && !actor.isAppAdministrator) {
		error(403, SERVER_ERROR.RELEASE_REQUIRES_ADMIN);
	}
	const target = await loadReservationTarget(transaction, reservationRow.giftId, {
		lockWishlist: false,
	});
	const role = await resolveRoleOnWishlistRow(actor.userId, target.wishlist, {
		database: transaction,
	});
	const capability = resolveReservationReleaseCapability({
		role,
		isAdmin: actor.isAppAdministrator,
	});
	if (!canReleaseReservation(capability, reservationIsGuest)) {
		// A guest row keeps the „not a správce" code; on a signed-in gifter's row only the
		// recipient who is also an administrator reaches here.
		error(
			403,
			reservationIsGuest
				? SERVER_ERROR.CANNOT_CANCEL_ANONYMOUS_RESERVATION
				: SERVER_ERROR.ACCESS_DENIED,
		);
	}
	return target;
}

/** The release target for someone else's reservation, or null when the participant cancels their own. */
async function authorizeCancellation(
	transaction: DatabaseTransaction,
	participant: CancellingParticipant,
	reservationRow: ReservationRow,
	options: { allowRelease: boolean },
): Promise<ReservationTarget | null> {
	if (participant.kind === 'anonymousVisitor') {
		if (reservationRow.userId !== null) {
			error(403, SERVER_ERROR.CANNOT_CANCEL_OTHERS_RESERVATION);
		}
		// Only the original anonymous reserver may, proven by the matching capability cookie.
		if (
			participant.visitorId === null ||
			reservationRow.anonymousVisitorId === null ||
			reservationRow.anonymousVisitorId !== participant.visitorId
		) {
			error(403, SERVER_ERROR.ANONYMOUS_CANNOT_CANCEL_RESERVATIONS);
		}
		return null;
	}
	if (participant.actor.userId === reservationRow.userId) {
		return null;
	}
	if (!options.allowRelease) {
		error(403, SERVER_ERROR.CANNOT_CANCEL_OTHERS_RESERVATION);
	}
	return authorizeRelease(transaction, participant.actor, reservationRow);
}

/** The released gifter learns which gift; a guest is reachable only through a left address. */
function notifyReleasedGifterAfterCommit(
	context: AnonymousVisitorMutationContext,
	actor: OperationActor,
	reservationRow: ReservationRow,
	target: ReservationTarget,
): void {
	const targetUserIds = reservationRow.userId === null ? [] : [reservationRow.userId];
	const guestEmail = optionalEmail(reservationRow.anonymousEmail);
	const targetEmails = guestEmail === null ? [] : [guestEmail];
	if (targetUserIds.length === 0 && targetEmails.length === 0) {
		return;
	}
	context.deferEffect(() =>
		dispatchNotification({
			type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
			targetUserIds,
			targetEmails,
			wishlistId: target.wishlist.id,
			giftId: reservationRow.giftId,
			// Naming the gift separates this copy from the revert-to-draft sweep, which names none.
			giftName: target.gift.name,
			actorId: actor.userId,
			actorName: actor.userName,
			wishlist: { title: target.wishlist.title, shortId: target.wishlist.shortId },
		}),
	);
}

async function cancelReservationForParticipant(
	context: AnonymousVisitorMutationContext,
	participant: CancellingParticipant,
	reservationId: string,
	options: { allowRelease: boolean },
): Promise<{ wishlistShortId: string }> {
	const activeReservation = and(eq(reservation.id, reservationId), isNull(reservation.deletedAt));
	// Locked so a concurrent cancel or release of the same reservation waits, then finds it gone.
	const [reservationRow] = await context.transaction
		.select()
		.from(reservation)
		.where(activeReservation)
		.for('update')
		.limit(1);
	if (reservationRow === undefined) {
		error(404, SERVER_ERROR.RESERVATION_NOT_FOUND);
	}
	const releaseTarget = await authorizeCancellation(
		context.transaction,
		participant,
		reservationRow,
		options,
	);
	const target =
		releaseTarget ??
		(await loadReservationTarget(context.transaction, reservationRow.giftId, {
			lockWishlist: false,
		}));
	// `cancelledByUserId` records who cancelled on every path; it stays null only for a guest
	// self-cancel, which is what makes a release distinguishable.
	await context.transaction
		.update(reservation)
		.set({
			deletedAt: context.now,
			cancelledByUserId: participant.kind === 'user' ? participant.actor.userId : null,
		})
		.where(activeReservation);
	// Cancelling one's own reservation notifies nobody.
	if (releaseTarget !== null && participant.kind === 'user') {
		notifyReleasedGifterAfterCommit(context, participant.actor, reservationRow, releaseTarget);
	}
	return { wishlistShortId: target.wishlist.shortId };
}

/** Cancels one of the actor's own reservations. */
export const cancelOwnReservationOperation = defineOperation({
	name: 'cancelOwnReservation',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: StrictUnreserveInputSchema,
	run: (context, input) =>
		cancelReservationForParticipant(
			context,
			{ kind: 'user', actor: context.actor },
			input.reservationId,
			{ allowRelease: false },
		),
});

/** Cancels the actor's own reservation or releases someone else's (issue #213). */
export const unreserveGiftOperation = defineOperation({
	name: 'unreserveGift',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: UnreserveInputSchema,
	run: (context, input) =>
		cancelReservationForParticipant(
			context,
			{ kind: 'user', actor: context.actor },
			input.reservationId,
			{ allowRelease: true },
		),
});

/** The anonymous visitor cancels their own guest reservation, proven by `visitorId`. */
export function unreserveGiftAsAnonymousVisitor(
	rawInput: unknown,
	visitorId: string | null,
): Promise<{ wishlistShortId: string }> {
	return executeAnonymousVisitorMutation(
		{
			operationName: unreserveGiftOperation.name,
			input: UnreserveInputSchema,
			run: (context, input) =>
				cancelReservationForParticipant(
					context,
					{ kind: 'anonymousVisitor', visitorId },
					input.reservationId,
					{ allowRelease: false },
				),
		},
		rawInput,
	);
}

/** Toggles the gifter-private „bought" marker on the actor's own reservation; never shown to managers. */
export const setReservationPurchasedOperation = defineOperation({
	name: 'setReservationPurchased',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: StrictSetReservationPurchasedInputSchema,
	async run(context, input) {
		const [reservationRow] = await context.transaction
			.select({
				userId: reservation.userId,
				wishlistShortId: wishlist.shortId,
			})
			.from(reservation)
			.innerJoin(gift, eq(reservation.giftId, gift.id))
			.innerJoin(wishlist, eq(gift.wishlistId, wishlist.id))
			.where(
				and(
					eq(reservation.id, input.reservationId),
					isNull(reservation.deletedAt),
					wishlistScope(),
				),
			)
			.limit(1);
		if (reservationRow === undefined) {
			error(404, SERVER_ERROR.RESERVATION_NOT_FOUND);
		}
		if (reservationRow.userId !== context.actor.userId) {
			error(403, SERVER_ERROR.CANNOT_CANCEL_OTHERS_RESERVATION);
		}
		await context.transaction
			.update(reservation)
			.set({ purchasedAt: input.purchased ? context.now : null })
			.where(eq(reservation.id, input.reservationId));
		return { purchased: input.purchased, wishlistShortId: reservationRow.wishlistShortId };
	},
});
