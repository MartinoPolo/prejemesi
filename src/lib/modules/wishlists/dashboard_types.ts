import * as m from '$lib/paraglide/messages.js';
import type { Wishlist } from './types.js';

/**
 * Wishlist with the recipient's display name for moderated/followed views.
 * `recipientDisplayName` resolves the linked recipient's account name or the free-text recipient
 * name — i.e. "who the list is for" — replacing the old owner-name projection (issue #99).
 */
export interface WishlistWithRecipient extends Wishlist {
	recipientDisplayName: string;
}

/** Recipient's own wishlist with gift count (no reservation data – recipient invariant) */
export interface MyWishlist extends Wishlist {
	totalGifts: number;
}

/** Moderated wishlist with reservation progress */
export interface ModeratedWishlist extends WishlistWithRecipient {
	totalGifts: number;
	reservedGifts: number;
}

/** Followed wishlist with available gifts and own reservation/purchase progress */
export interface FollowedWishlist extends WishlistWithRecipient {
	availableGifts: number;
	myReservations: number;
	myPurchased: number;
	unfollowedAt: Date | null;
}

/**
 * Gifter-relative resolution state of a followed list:
 * - `open` – nothing reserved yet; the gifter still owes a gift (action needed)
 * - `reserved` – gift(s) claimed; covered, though not all marked bought
 * - `bought` – every reservation marked bought; fully done
 *
 * "Bought" is an optional self-tracking signal – most users rest at `reserved`, which is
 * treated as resolved for sorting/dimming. We never nag non-buyers.
 */
export const FOLLOWED_LIST_STATE = {
	open: 'open',
	reserved: 'reserved',
	bought: 'bought',
} as const;

export type FollowedListState = (typeof FOLLOWED_LIST_STATE)[keyof typeof FOLLOWED_LIST_STATE];

export function followedListState(wishlist: FollowedWishlist): FollowedListState {
	if (wishlist.myReservations === 0) {
		return FOLLOWED_LIST_STATE.open;
	}
	if (wishlist.myPurchased >= wishlist.myReservations) {
		return FOLLOWED_LIST_STATE.bought;
	}
	return FOLLOWED_LIST_STATE.reserved;
}

/** @public Sort options for dashboard pages */
export const SORT_OPTIONS = {
	lastActivity: 'lastActivity',
	alphabetical: 'alphabetical',
	dateCreated: 'dateCreated',
	eventDate: 'eventDate',
} as const;

export type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

export const SORT_LABELS = {
	lastActivity: () => m.dashboard_sort_last_activity(),
	alphabetical: () => m.dashboard_sort_alphabetical(),
	dateCreated: () => m.dashboard_sort_date_created(),
	eventDate: () => m.dashboard_sort_event_date(),
} satisfies Record<SortOption, () => string>;

/** @public View mode for dashboard pages */
export const VIEW_MODES = {
	grid: 'grid',
	list: 'list',
} as const;

export type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];

/** Wishlist status display mapping */
export const WISHLIST_STATUS_LABELS = {
	draft: () => m.dashboard_status_draft(),
	active: () => m.dashboard_status_shared(),
	archived: () => m.dashboard_status_archived(),
} satisfies Record<Wishlist['status'], () => string>;

export const WISHLIST_STATUS_BADGE_MAP = {
	draft: 'info',
	active: 'success',
	archived: 'warning',
} as const satisfies Record<Wishlist['status'], string>;
