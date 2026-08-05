/**
 * The demo gifts the landing page actually renders (issue #218).
 *
 * This is the hard allowlist the like command validates against: the demo gifts are
 * hand-written fixtures with no database row, so the slug is the only key a visitor's
 * like can hang on, and nothing outside this list may ever reach the table.
 *
 * Deliberately dependency-free (no Paraglide, no `$app/*`) so both the fixture builder
 * and the server-side remote module can import it.
 */

/** Slugs of the six gifts on the demo wishlist, in render order. */
export const LANDING_DEMO_GIFT_SLUGS = [
	'teapot',
	'headphones',
	'plant-book',
	'candle',
	'backpack',
	'watercolours',
] as const;

export type LandingDemoGiftSlug = (typeof LANDING_DEMO_GIFT_SLUGS)[number];

/**
 * The mobile hook renders the first gift a second time under its own id, so the two
 * copies stay independently addressable in the gift contexts. Both copies are the same
 * wish, so they share one slug — and therefore one counter. Must stay the slug of the
 * FIRST seed in landing_demo_fixtures.ts, or the pair's counter detaches from its list row.
 */
export const LANDING_DEMO_PAIR_GIFT_ID = 'pair-gift';

const LANDING_DEMO_PAIR_GIFT_SLUG: LandingDemoGiftSlug = 'teapot';

export function isLandingDemoGiftSlug(value: string): value is LandingDemoGiftSlug {
	return (LANDING_DEMO_GIFT_SLUGS as readonly string[]).includes(value);
}

/** Rendered gift id → the slug its likes are counted under, or null for an unknown id. */
export function landingDemoGiftSlugForId(giftId: string): LandingDemoGiftSlug | null {
	if (giftId === LANDING_DEMO_PAIR_GIFT_ID) {
		return LANDING_DEMO_PAIR_GIFT_SLUG;
	}
	return isLandingDemoGiftSlug(giftId) ? giftId : null;
}

/** Slug → every rendered gift id showing it, so one like lights up both copies. */
export function landingDemoGiftIdsForSlug(slug: LandingDemoGiftSlug): string[] {
	return slug === LANDING_DEMO_PAIR_GIFT_SLUG ? [slug, LANDING_DEMO_PAIR_GIFT_ID] : [slug];
}
