import type { reservation } from '$lib/server/db/gift.schema.js';

/** Full reservation row from DB */
export type Reservation = typeof reservation.$inferSelect;

/** Reservation visible to moderator */
export interface ReservationForModerator {
	id: string;
	giftId: string;
	quantity: number;
	displayName: string;
	createdAt: Date;
}

/** Input for reserving a gift */
export interface ReserveGiftInput {
	giftId: string;
	quantity: number;
	anonymousName?: string;
	anonymousEmail?: string;
}

/** Input for unreserving a gift */
export interface UnreserveInput {
	reservationId: string;
}
