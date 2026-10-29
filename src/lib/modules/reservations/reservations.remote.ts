import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	publicQuery,
	publicCommand,
	guardedCommand,
	singleFlightRefresh,
} from '$lib/server/remote.js';
import { getAnonVisitorId, getOrCreateAnonVisitorId } from '$lib/server/anonymous_visitor.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import {
	reserveGiftAsAnonymousVisitor,
	reserveGiftOperation,
	setReservationPurchasedOperation,
	unreserveGiftAsAnonymousVisitor,
	unreserveGiftOperation,
} from '$lib/server/operations/reservation_operations.js';
import {
	readMyGiftReservationsOperation,
	readReservationLedgerOperation,
} from '$lib/server/operations/reservation_read_operations.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { verifyTurnstileToken } from '$lib/server/turnstile.js';
import {
	ReserveGiftInputSchema,
	UnreserveInputSchema,
	SetReservationPurchasedInputSchema,
} from './types.js';

// Thin adapters over the operation core, which owns reservation rights and surprise protection.
// The anonymous visitor's bot check and capability cookie are transport concerns and stay here.

async function verifyAnonymousReservationTurnstile(turnstileToken: string | undefined) {
	const result = await verifyTurnstileToken({ token: turnstileToken });
	if (result.success) {
		return;
	}

	switch (result.reason) {
		case 'missing':
			error(400, SERVER_ERROR.TURNSTILE_REQUIRED);
		case 'expired_or_replayed':
			error(403, SERVER_ERROR.TURNSTILE_EXPIRED_OR_REPLAYED);
		case 'invalid':
			error(403, SERVER_ERROR.TURNSTILE_INVALID);
		case 'configuration':
		case 'unavailable':
			// Fail open: the bot check could not run at all — the secret is unconfigured
			// (`configuration`) or Cloudflare Siteverify was unreachable (`unavailable`).
			// These are operational failures, not bot signals. Blocking here takes the core
			// guest-reservation flow fully offline whenever Turnstile is misconfigured or down
			// (as happened in production when the keys were never deployed). The action is
			// low-stakes (no money, no account) and other defenses remain in force: a required
			// display name, the per-browser cancel cookie, and Cloudflare WAF rate limiting.
			// Allow the reservation but log it so unverified traffic stays auditable.
			console.warn(
				`[Turnstile] unverified anonymous reservation allowed (fail-open): reason=${result.reason}`,
			);
			return;
	}
}

export const reserveGift = publicCommand(ReserveGiftInputSchema, async (authContext, input) => {
	let reserved: { reservationId: string; wishlistShortId: string };
	if (authContext === null) {
		await verifyAnonymousReservationTurnstile(input.turnstileToken);
		// The per-browser capability cookie lets the visitor later cancel their own reservation.
		reserved = await reserveGiftAsAnonymousVisitor(input, getOrCreateAnonVisitorId);
	} else {
		reserved = await executeOperation(
			userInterfaceActor(authContext.user),
			reserveGiftOperation,
			{ giftId: input.giftId, quantity: input.quantity },
		);
	}

	// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page tracks this
	// query, so the fresh reservation state rides back on the command response.
	singleFlightRefresh(getGiftsByWishlistShortId, reserved.wishlistShortId);

	return { id: reserved.reservationId };
});

export const unreserveGift = publicCommand(UnreserveInputSchema, async (authContext, input) => {
	const { wishlistShortId } =
		authContext === null
			? await unreserveGiftAsAnonymousVisitor(input, getAnonVisitorId())
			: await executeOperation(
					userInterfaceActor(authContext.user),
					unreserveGiftOperation,
					input,
				);

	// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page tracks this
	// query, so the fresh reservation state rides back on the command response.
	singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
	singleFlightRefresh(getReservationLedgerForWishlist, wishlistShortId);

	return { success: true };
});

/**
 * Toggle the gifter-private "I bought this" marker on the caller's own reservation. Optional
 * self-tracking only – never surfaced to the wishlist owner. Authenticated reservations only
 * (anonymous visitors have no persistent identity to track against).
 */
export const setReservationPurchased = guardedCommand(
	SetReservationPurchasedInputSchema,
	async ({ user }, input) => {
		const { purchased, wishlistShortId } = await executeOperation(
			userInterfaceActor(user),
			setReservationPurchasedOperation,
			input,
		);

		// Single-flight refresh (issue #108, REQ-3/4): syncs myReservationPurchasedAt on
		// the open wishlist page in the same round trip.
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);

		return { purchased };
	},
);

export const getReservationLedgerForWishlist = publicQuery(v.string(), (authContext, shortId) =>
	executeOperation(
		authContext === null ? null : userInterfaceActor(authContext.user),
		readReservationLedgerOperation,
		{ wishlistShortId: shortId },
	),
);

export const getMyReservationsForGift = publicQuery(v.string(), (authContext, giftId) =>
	executeOperation(
		authContext === null ? null : userInterfaceActor(authContext.user),
		readMyGiftReservationsOperation,
		{ giftId },
	),
);
