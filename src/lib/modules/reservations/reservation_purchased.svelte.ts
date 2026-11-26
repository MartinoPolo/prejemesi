import { SvelteMap } from 'svelte/reactivity';
import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import * as m from '$lib/paraglide/messages.js';
import { setReservationPurchased } from './reservations.remote.js';

type PurchasedGift = Pick<
	GiftForVisitor,
	'id' | 'myReservationId' | 'myReservationPurchasedAt' | 'myReservationOnLinkedCopy'
>;

/**
 * Optimistic "Koupeno" state shared by every entry point on a wishlist page (card toggle, viewer,
 * context menu). An override lives only while its command runs: the command's single-flight
 * refresh carries the server truth, so success and failure both drop it.
 */
export function createReservationPurchasedState() {
	const overrides = new SvelteMap<string, boolean>();

	function isPurchased(gift: PurchasedGift): boolean {
		return overrides.get(gift.id) ?? gift.myReservationPurchasedAt !== null;
	}

	function isPending(gift: Pick<GiftForVisitor, 'id'>): boolean {
		return overrides.has(gift.id);
	}

	async function toggle(gift: PurchasedGift): Promise<void> {
		if (gift.myReservationId === null || overrides.has(gift.id)) {
			return;
		}
		const purchased = !isPurchased(gift);
		overrides.set(gift.id, purchased);
		try {
			const command = setReservationPurchased({
				reservationId: gift.myReservationId,
				purchased,
			});
			// The server refreshes the reservation's own list; a reservation held on a linked copy
			// also shows on every other list of the group.
			await (gift.myReservationOnLinkedCopy
				? command.updates(getGiftsByWishlistShortId)
				: command);
			toastSuccess(purchased ? m.toast_marked_bought() : m.toast_unmarked_bought());
		} catch (thrown) {
			toastError(translateServerError(thrown, m.toast_bought_error()));
		} finally {
			overrides.delete(gift.id);
		}
	}

	return { isPurchased, isPending, toggle };
}
