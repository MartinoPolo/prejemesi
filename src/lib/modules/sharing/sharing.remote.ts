import * as v from 'valibot';
import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import {
	revertWishlistToDraftOperation,
	shareWishlistOperation,
} from '$lib/server/operations/wishlist_lifecycle_operations.js';
import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';

export const shareWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	// Any manager (linked recipient or správce) may share — full management rights (issue #99).
	const shared = await executeOperation(userInterfaceActor(user), shareWishlistOperation, {
		wishlistId,
	});
	if (!shared.alreadyShared) {
		// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page gets the
		// new shared status (and its grace-window anchor) in the same round trip.
		singleFlightRefresh(getWishlistByShortId, shared.shortId);
	}
	return shared;
});

/**
 * Revert a shared (active) list back to draft — the inverse of {@link shareWishlist} (issue #150,
 * decision 2026-07-14). Permission is resolved entirely through `resolveRevertCapability` so
 * the admin gate never scatters:
 *  - Zero reservations: any správce, silently (no notifications).
 *  - With reservations: app admin only — cancels every active reservation and notifies the
 *    reservers (email to registered + anonymous-with-email; in-app for registered; anonymous
 *    without an email is unreachable, accepted). A non-admin správce is rejected.
 *  - The recipient never reverts (a self list without a separate správce cannot be reverted at all).
 *  - An archived list must be unarchived first (rejected with a clear error).
 *
 * The revert clears `sharedAt` (full edit rights return, event-date lock released, re-share opens a
 * fresh grace window), resets each gift's post-share transparency state (discards description
 * appends — the frozen share-time `description` text is kept — and clears the „Upraveno po sdílení"
 * badge + its snapshot), and keeps likes and followers untouched. The open wishlist page refreshes
 * via single-flight (issue #108); the list stays in the same dashboard bucket, so no dashboard
 * query needs a refresh.
 */
export const revertWishlistToDraft = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	const reverted = await executeOperation(
		userInterfaceActor(user),
		revertWishlistToDraftOperation,
		{ wishlistId },
	);
	singleFlightRefresh(getWishlistByShortId, reverted.shortId);
	return reverted;
});
