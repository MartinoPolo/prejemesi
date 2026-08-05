import * as v from 'valibot';
import { LANDING_DEMO_GIFT_SLUGS, type LandingDemoGiftSlug } from './landing_demo_gift_slugs.js';

/**
 * The allowlist IS the validation: `picklist` rejects any slug the landing page does not
 * render, so the endpoint can do exactly one thing — flip one row for one known gift.
 */
export const ToggleLandingDemoLikeInputSchema = v.object({
	giftSlug: v.picklist(LANDING_DEMO_GIFT_SLUGS),
});

/** Result of toggling a landing-demo like */
export interface ToggleLandingDemoLikeResult {
	liked: boolean;
	likeCount: number;
}

/** Live like state for the whole demo wishlist. */
export interface LandingDemoLikes {
	/** Every demo slug → its current shared like count (0 when nobody liked it yet). */
	counts: Record<LandingDemoGiftSlug, number>;
	/** Slugs this browser's anonymous visitor cookie has liked. */
	likedSlugs: LandingDemoGiftSlug[];
}
