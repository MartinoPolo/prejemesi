import { createContext } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

type ReservationsContext = ReturnType<typeof createReservationsContext>;

const [useReservations, setReservationsInternal] = createContext<ReservationsContext>();
export { useReservations };

export function setReservationsContext() {
	const context = createReservationsContext();
	setReservationsInternal(context);
	return context;
}

function createReservationsContext() {
	/** Gift currently being reserved (modal target) */
	const reservingGift = new StateRaw<GiftForVisitor | null>(null);

	/** Whether the reserve modal is open */
	const isModalOpen = new Derived(() => reservingGift.current !== null);

	/** Loading state for reserve/unreserve operations */
	const isSubmitting = new StateRaw(false);

	function openReserveModal(giftItem: GiftForVisitor) {
		reservingGift.current = giftItem;
	}

	function closeReserveModal() {
		reservingGift.current = null;
	}

	return {
		reservingGift,
		isModalOpen,
		isSubmitting,
		openReserveModal,
		closeReserveModal,
	};
}
