import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
import type { GiftByRole } from '$lib/modules/gifts/types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

/**
 * Stands in for the wishlist page's context providers so the real `GiftCard`/`GiftListItem`
 * render on the public landing page (issue #218). Must be called during component init —
 * the contexts scope to the calling component's subtree, which is what lets the desktop
 * split view host a gifter pane and a recipient pane side by side.
 *
 * Every closure is local and deliberately shaped so that no tap inside the demo can reach a
 * remote function: an unauthenticated viewer sends `LikeButton` down its no-account branch
 * (here a no-op instead of a login prompt) and hides `PurchasedToggle` entirely, and the
 * empty release capability hides `ReleaseReservationButton`. Reserve and unreserve stay
 * live — they are plain callbacks the demo answers from local state.
 */
export function setLandingDemoGiftContexts(
	getGifts: () => GiftByRole[],
	getRole: () => WishlistRole,
) {
	setLikesContext(
		() => [],
		() => false,
		() => {},
	);
	setGiftsContext(
		getGifts,
		getRole,
		() => false,
		() => false,
		() => [],
	);
	setReservationsContext(
		() => RESERVATION_RELEASE_CAPABILITY.none,
		() => [],
		async () => false,
	);
}
