import * as m from '$lib/paraglide/messages.js';
import type { Wishlist } from './types.js';

/** Wishlist with owner name for moderated/followed views */
export interface WishlistWithOwner extends Wishlist {
	ownerName: string;
}

/** Moderated wishlist with reservation progress */
export interface ModeratedWishlist extends WishlistWithOwner {
	totalGifts: number;
	reservedGifts: number;
}

/** Followed wishlist with available gifts and own reservations */
export interface FollowedWishlist extends WishlistWithOwner {
	availableGifts: number;
	myReservations: number;
	unfollowedAt: Date | null;
}

/** Sort options for dashboard pages */
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

/** View mode for dashboard pages */
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
