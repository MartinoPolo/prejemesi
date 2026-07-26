import { getLocale } from '$lib/paraglide/runtime.js';
import * as m from '$lib/paraglide/messages.js';
import type { ReservationForModerator } from './types.js';

/**
 * When a reservation was made, as a short locale date + time. The release picker (issue #213
 * REQ-4) needs the time as well as the date: several reservations on one gift are often made
 * the same day, and the timestamp is what tells two same-named guests apart.
 */
export function formatReservationTimestamp(createdAt: Date): string {
	return new Intl.DateTimeFormat(getLocale(), {
		day: 'numeric',
		month: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(createdAt);
}

/**
 * The gifter name to show for a ledger row. `displayName` is null only when the gifter's
 * account was deleted, leaving the row with no identity — the placeholder is localized here
 * rather than server-side so it follows the viewer's language.
 */
export function reservationGifterName(reservation: ReservationForModerator): string {
	return reservation.displayName ?? m.reserve_release_deleted_account();
}
