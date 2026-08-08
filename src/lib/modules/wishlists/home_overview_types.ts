import type { MyWishlist, ModeratedWishlist, FollowedWishlist } from './dashboard_types.js';

/** Category-row caps for the Přehled overview (issue #225, DECISIONS 2026-08-07). */
export const HOME_CATEGORY_CAP = 10;
export const HOME_RECENT_CAP = 6;

/** Roles a Nedávné card can carry — drives which WishlistCard props render. */
export const HOME_ROLE = {
	own: 'own',
	moderated: 'moderated',
	followed: 'followed',
} as const;

/** Own list on /home: gift count only — recipient invariant, never reservation data. */
export interface OwnHomeItem extends MyWishlist {
	lastVisitedAt: Date | null;
}

export interface ModeratedHomeItem extends ModeratedWishlist {
	lastVisitedAt: Date | null;
}

export interface FollowedHomeItem extends FollowedWishlist {
	lastVisitedAt: Date | null;
	/** Follow date — cold-start recency fallback before any visit is recorded. */
	followDate: Date | null;
}

/** A Nedávné card, tagged with its role so the UI picks the right WishlistCard props. */
export type RecentHomeItem =
	| ({ role: typeof HOME_ROLE.own } & OwnHomeItem)
	| ({ role: typeof HOME_ROLE.moderated } & ModeratedHomeItem)
	| ({ role: typeof HOME_ROLE.followed } & FollowedHomeItem);

/** One category row: the capped slice plus the true (uncapped, non-archived) total. */
export interface HomeCategoryRow<T> {
	items: T[];
	total: number;
}

export interface HomeOverview {
	recent: RecentHomeItem[];
	followed: HomeCategoryRow<FollowedHomeItem>;
	moderated: HomeCategoryRow<ModeratedHomeItem>;
	own: HomeCategoryRow<OwnHomeItem>;
}
