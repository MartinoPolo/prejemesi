import { createContext } from 'svelte';
import type { ReservationReleaseCapability } from '$lib/modules/wishlists/wishlist_capabilities.js';
import type { ReservationForModerator } from './types.js';

/**
 * Reservation-release wiring for the gift surfaces (issue #213). Carries three things the
 * release control cannot derive on its own: the SERVER-computed capability (REQ-7 — the
 * administrator identity never reaches the client), the per-gift release ledger, and the
 * page's release command.
 *
 * Context rather than props: `ReleaseReservationButton` mounts on four surfaces
 * (`GiftCard`, `GiftListItem`, `GiftCompactRow`, `GiftDetailActionBar`), each reached
 * through a different parent chain, so drilling the capability would touch every one of them.
 *
 * Every host must provide it — `useReservations()` throws when no provider is set, so a
 * forgotten `setReservationsContext` fails loudly instead of silently hiding the control.
 */
type ReservationsContext = ReturnType<typeof createReservationsContext>;

const [useReservations, setReservationsInternal] = createContext<ReservationsContext>();
export { useReservations };

export function setReservationsContext(
	getCapability: () => ReservationReleaseCapability,
	getReservationsForGift: (giftId: string) => ReservationForModerator[],
	release: (giftId: string, reservationId: string) => Promise<boolean>,
) {
	const context = createReservationsContext(getCapability, getReservationsForGift, release);
	setReservationsInternal(context);
	return context;
}

function createReservationsContext(
	getCapability: () => ReservationReleaseCapability,
	getReservationsForGift: (giftId: string) => ReservationForModerator[],
	release: (giftId: string, reservationId: string) => Promise<boolean>,
) {
	return {
		/**
		 * How far this viewer's release reach extends on the wishlist being viewed.
		 * A getter, not a `Derived`: consumers read it inside their own `$derived`, which
		 * tracks the page state this closure reaches through.
		 */
		get capability() {
			return getCapability();
		},
		/**
		 * The release ledger for one gift: every active reservation EXCEPT the viewer's own
		 * (the server strips those — one's own reservation is cancelled from the reserve
		 * control). Empty while the ledger is still loading, or when there is nothing to show.
		 */
		reservationsForGift: getReservationsForGift,
		/** Releases one reservation. Resolves true when the server accepted it. */
		release,
	};
}
