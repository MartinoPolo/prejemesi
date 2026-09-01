import {
	setLikesContext,
	type ToggleLikeOverride,
} from '$lib/modules/likes/likes.context.svelte.js';
import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
import type { GiftByRole } from '$lib/modules/gifts/types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

/** Live like state the demo threads into the shared likes context. */
export interface LandingDemoLikeControls {
	/** Ids of the rendered demo gifts this browser has liked. */
	getLikedGiftIds: () => string[];
	/** Persists one like against the landing-demo counter; see `landing_demo_likes.remote.ts`. */
	toggleLike: ToggleLikeOverride;
}

/**
 * Stands in for the wishlist page's context providers so the real `GiftCard`/`GiftListItem`
 * render on the public landing page (issue #218). Must be called during component init —
 * the contexts scope to the calling component's subtree, which is what lets the desktop
 * split view host a gifter pane and a recipient pane side by side.
 *
 * The invariant these closures enforce: **a reservation never leaves the browser**. Reserve
 * and unreserve are plain callbacks the demo answers from local state, `PurchasedToggle` is
 * hidden (no account), and the empty release capability hides `ReleaseReservationButton`.
 *
 * The heart is the one deliberate exception. `isAuthenticated` reports true so `LikeButton`
 * skips its log-in prompt, and the toggle override sends the click to the demo's own
 * slug-keyed endpoint instead of the real `toggleLike`: the counter is shared with every
 * other visitor and survives a reload via the anonymous visitor cookie. Likes are not part
 * of the surprise — only reservations are — so showing them on both panes is honest.
 */
export function setLandingDemoGiftContexts(
	getGifts: () => GiftByRole[],
	getRole: () => WishlistRole,
	likeControls: LandingDemoLikeControls,
) {
	setLikesContext(
		likeControls.getLikedGiftIds,
		() => true,
		() => {},
		likeControls.toggleLike,
	);
	setGiftsContext(
		() => 'landing-demo',
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
