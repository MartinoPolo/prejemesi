/**
 * Production-like load scenarios (REQ-3): anonymous viewing, authenticated
 * viewing, gift creation, distinct-gift reservation, and single-gift
 * contention. Each virtual user talks to the app exactly like a browser —
 * SSR page loads and remote-function calls with cookies.
 */

import { REMOTE_ENDPOINT_ID } from './remote-endpoints.js';
import { ARENA_SHORT_ID, virtualUserWishlistId } from './fixtures.js';
import type { VirtualUserClient } from './http-client.js';

export interface VirtualUser {
	index: number;
	client: VirtualUserClient;
	/** Authed VUs act with their loadtest account; the rest act anonymously. */
	authenticated: boolean;
}

const RESERVATION_CONFLICT = (errorStatus: number, errorMessage: string): boolean =>
	errorStatus === 400 && errorMessage.includes('NOT_ENOUGH_AVAILABLE');

export async function viewArenaWishlist(vu: VirtualUser): Promise<void> {
	const operation = vu.authenticated ? 'page:authed-view' : 'page:anonymous-view';
	await vu.client.viewPage(operation, `/w/${ARENA_SHORT_ID}`);
}

/** Creates a gift on the VU's own draft wishlist (authenticated VUs only). */
export async function createGiftOnOwnWishlist(vu: VirtualUser, iteration: number): Promise<void> {
	await vu.client.remoteCommand(
		REMOTE_ENDPOINT_ID.createGift,
		{
			wishlistId: virtualUserWishlistId(vu.index),
			name: `Loadtest created gift vu${String(vu.index)}-${String(iteration)}`,
			quantity: 1,
		},
		{ operation: 'command:createGift' },
	);
}

interface ReservationSuccess {
	reservationId: string;
}

async function reserveGift(
	vu: VirtualUser,
	giftId: string,
	operation: string,
	expectConflicts: boolean,
): Promise<ReservationSuccess | null> {
	const result = await vu.client.remoteCommand(
		REMOTE_ENDPOINT_ID.reserveGift,
		{
			giftId,
			quantity: 1,
			...(vu.authenticated ? {} : { anonymousName: `Loadtest anonym ${String(vu.index)}` }),
		},
		{
			operation,
			isExpectedConflict: expectConflicts ? RESERVATION_CONFLICT : undefined,
		},
	);

	if (!result.ok) {
		return null;
	}
	const reservationId = (result.result as { id?: string } | null)?.id;
	return typeof reservationId === 'string' ? { reservationId } : null;
}

export async function unreserveGift(
	vu: VirtualUser,
	reservationId: string,
	operation = 'command:unreserveGift',
): Promise<void> {
	await vu.client.remoteCommand(
		REMOTE_ENDPOINT_ID.unreserveGift,
		{ reservationId },
		{ operation },
	);
}

/**
 * Reserve the VU's dedicated single-unit gift, then release it. Distinct gifts
 * mean zero expected conflicts — any failure is a real error (REQ-3).
 */
export async function reserveAndReleaseDistinctGift(
	vu: VirtualUser,
	giftId: string,
): Promise<void> {
	const success = await reserveGift(vu, giftId, 'command:reserveGift-distinct', false);
	if (success !== null) {
		await unreserveGift(vu, success.reservationId);
	}
}

export interface ContentionOutcome {
	successes: { vuIndex: number; reservationId: string }[];
	conflicts: number;
	unexpectedFailures: number;
}

/**
 * All VUs race for the final unit of one gift (REQ-3/AC-6): exactly one must
 * win; everyone else must receive the controlled NOT_ENOUGH_AVAILABLE conflict.
 */
export async function contendForGift(
	vus: readonly VirtualUser[],
	giftId: string,
): Promise<ContentionOutcome> {
	const outcome: ContentionOutcome = { successes: [], conflicts: 0, unexpectedFailures: 0 };

	await Promise.all(
		vus.map(async (vu) => {
			const result = await vu.client.remoteCommand(
				REMOTE_ENDPOINT_ID.reserveGift,
				{
					giftId,
					quantity: 1,
					...(vu.authenticated
						? {}
						: { anonymousName: `Loadtest anonym ${String(vu.index)}` }),
				},
				{
					operation: 'command:reserveGift-contention',
					isExpectedConflict: RESERVATION_CONFLICT,
				},
			);

			if (result.ok) {
				const reservationId = (result.result as { id?: string } | null)?.id;
				if (typeof reservationId === 'string') {
					outcome.successes.push({ vuIndex: vu.index, reservationId });
				} else {
					outcome.unexpectedFailures++;
				}
			} else if (
				result.errorStatus !== null &&
				RESERVATION_CONFLICT(result.errorStatus, result.errorMessage ?? '')
			) {
				outcome.conflicts++;
			} else {
				outcome.unexpectedFailures++;
			}
		}),
	);

	return outcome;
}
