import * as v from 'valibot';
import type { reservation } from '$lib/server/db/gift.schema.js';

/** Full reservation row from DB */
export type Reservation = typeof reservation.$inferSelect;

/**
 * One row of the release ledger for a gift (issue #213) — visible to a správce (guest rows
 * releasable) and to the app administrator (every row). Never to the obdarovaný.
 */
export interface ReservationForModerator {
	id: string;
	giftId: string;
	quantity: number;
	/** The guest's typed name, or a signed-in gifter's account name. Null only when the gifter's
	 *  account was deleted, leaving the row with no identity to show. */
	displayName: string | null;
	/** Whether THIS viewer may release THIS row. A správce sees a signed-in gifter's row but
	 *  cannot act on it, so the control renders disabled with a reason instead of vanishing. */
	releasable: boolean;
	createdAt: Date;
}

/** Input for reserving a gift */
export interface ReserveGiftInput {
	giftId: string;
	quantity: number;
	anonymousName?: string;
	anonymousEmail?: string;
	turnstileToken?: string;
}

export const ReserveGiftInputSchema = v.object({
	giftId: v.string(),
	quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
	anonymousName: v.optional(v.string()),
	anonymousEmail: v.optional(v.string()),
	turnstileToken: v.optional(v.string()),
});

/** Input for unreserving a gift */
export interface UnreserveInput {
	reservationId: string;
}

export const UnreserveInputSchema = v.object({
	reservationId: v.string(),
});

/** Input for toggling a reservation's gifter-private "bought" marker */
export interface SetReservationPurchasedInput {
	reservationId: string;
	purchased: boolean;
}

export const SetReservationPurchasedInputSchema = v.object({
	reservationId: v.string(),
	purchased: v.boolean(),
});
