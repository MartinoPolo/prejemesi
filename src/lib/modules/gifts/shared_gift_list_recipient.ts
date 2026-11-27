import { getContext, hasContext, setContext } from 'svelte';

/** The recipient of the wishlist a shared gift is shown on, first among its recipients. */
export interface SharedGiftListRecipient {
	name: string;
	image: string | null;
}

const SHARED_GIFT_LIST_RECIPIENT_KEY = Symbol('shared-gift-list-recipient');

/** Names the shown wishlist's recipient for every shared gift badge and explanation on the page. */
export function provideSharedGiftListRecipient(
	getRecipient: () => SharedGiftListRecipient | null,
): void {
	setContext(SHARED_GIFT_LIST_RECIPIENT_KEY, getRecipient);
}

/** Reads the shown wishlist's recipient; the getter returns null outside a wishlist page. */
export function useSharedGiftListRecipient(): () => SharedGiftListRecipient | null {
	return hasContext(SHARED_GIFT_LIST_RECIPIENT_KEY)
		? getContext<() => SharedGiftListRecipient | null>(SHARED_GIFT_LIST_RECIPIENT_KEY)
		: () => null;
}
