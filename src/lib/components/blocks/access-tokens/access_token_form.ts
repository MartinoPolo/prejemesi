export const WISHLIST_RESTRICTION = { all: 'all', some: 'some' } as const;
export type WishlistRestriction = (typeof WISHLIST_RESTRICTION)[keyof typeof WISHLIST_RESTRICTION];
