/** Shared query-param names for wishlist deep links, consumed by both the wishlist page
 *  (`/w/[id]`) and any surface that links into it (in-app notifications, legacy redirects). */

/** Opens the settings modal on a tab; used by the legacy `/w/<id>/settings` redirect. */
export const WISHLIST_SETTINGS_QUERY_PARAM = 'settings';

/** Deep-links to a gift's detail modal from an in-app notification (issue #204). */
export const WISHLIST_GIFT_QUERY_PARAM = 'gift';
