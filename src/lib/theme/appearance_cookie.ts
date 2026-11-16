/** One year for every appearance cookie mirror (palette, depth, dark wishlist background), re-extended on each change. */
const APPEARANCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Not httpOnly: the client reads the mirrors for instant theming. */
export const APPEARANCE_COOKIE_OPTIONS = {
	path: '/',
	maxAge: APPEARANCE_COOKIE_MAX_AGE_SECONDS,
	httpOnly: false,
	sameSite: 'lax',
} as const;
