/** Query param the legacy /w/<id>/settings redirect appends to open the settings modal on a tab. */
export const WISHLIST_SETTINGS_QUERY_PARAM = 'settings';

export const WISHLIST_SETTINGS_TABS = {
	details: 'details',
	appearance: 'appearance',
	image: 'image',
	danger: 'danger',
} as const;

export type WishlistSettingsTab =
	(typeof WISHLIST_SETTINGS_TABS)[keyof typeof WISHLIST_SETTINGS_TABS];

export function isWishlistSettingsTab(value: string): value is WishlistSettingsTab {
	return Object.values(WISHLIST_SETTINGS_TABS).includes(value as WishlistSettingsTab);
}
