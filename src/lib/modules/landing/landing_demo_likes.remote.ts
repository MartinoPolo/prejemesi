import { query } from '$app/server';
import { and, eq, isNull, count as drizzleCount } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { landingDemoLike } from '$lib/server/db/landing.schema.js';
import { getAnonVisitorId, getOrCreateAnonVisitorId } from '$lib/server/anonymous_visitor.js';
import { error } from '@sveltejs/kit';
import { publicCommand, singleFlightRefresh } from '$lib/server/remote.js';
import {
	LANDING_DEMO_GIFT_SLUGS,
	isLandingDemoGiftSlug,
	type LandingDemoGiftSlug,
} from './landing_demo_gift_slugs.js';
import {
	ToggleLandingDemoLikeInputSchema,
	type LandingDemoLikes,
	type ToggleLandingDemoLikeResult,
} from './types.js';

/**
 * The landing demo's one real, shared counter (issue #218).
 *
 * Everything else in the demo is fixture-only — a reservation never leaves the browser
 * and a reload starts the visitor over. The heart is the deliberate exception: any
 * anonymous visitor may like a demo gift, the count is global, and their own likes come
 * back on the next visit via the `prejemesi_anon_id` cookie.
 *
 * Abuse posture: no account and no rate limiter (the codebase has none), so the defence
 * is that there is nothing to abuse — the slug is validated against a hard allowlist and
 * the command can only ever flip a single soft-delete flag for one (slug, visitor) pair.
 * Clearing cookies buys one extra vote per gift; that is the accepted cost of a landing
 * page counter.
 */

function emptyCounts(): Record<LandingDemoGiftSlug, number> {
	return Object.fromEntries(LANDING_DEMO_GIFT_SLUGS.map((slug) => [slug, 0])) as Record<
		LandingDemoGiftSlug,
		number
	>;
}

/**
 * Hard ceiling on rows per slug, counting soft-deleted ones. A cookie-less script gets a
 * fresh visitor id per request, so without a cap the table would grow without bound; with
 * it, the counter merely saturates. Two orders of magnitude above any organic traffic.
 */
const LANDING_DEMO_LIKE_ROWS_PER_SLUG_CAP = 10_000;

/**
 * Counts for every demo gift plus this browser's own likes.
 *
 * A plain `query` rather than one of the auth wrappers: the demo counter has no notion
 * of an account at all, and identity comes exclusively from the anonymous visitor cookie.
 * The cookie can only be *read* here — minting it needs a `Set-Cookie`, which SvelteKit
 * allows in commands only, so a first-time visitor gets their id on their first like.
 */
export const getLandingDemoLikes = query(async (): Promise<LandingDemoLikes> => {
	const database = getDb();

	const countRows = await database
		.select({ giftSlug: landingDemoLike.giftSlug, likeCount: drizzleCount() })
		.from(landingDemoLike)
		.where(isNull(landingDemoLike.deletedAt))
		.groupBy(landingDemoLike.giftSlug);

	const counts = emptyCounts();
	for (const row of countRows) {
		if (isLandingDemoGiftSlug(row.giftSlug)) {
			counts[row.giftSlug] = Number(row.likeCount);
		}
	}

	const anonVisitorId = getAnonVisitorId();
	if (anonVisitorId === null) {
		return { counts, likedSlugs: [] };
	}

	const likedRows = await database
		.select({ giftSlug: landingDemoLike.giftSlug })
		.from(landingDemoLike)
		.where(
			and(
				eq(landingDemoLike.anonVisitorId, anonVisitorId),
				isNull(landingDemoLike.deletedAt),
			),
		);

	return {
		counts,
		likedSlugs: likedRows.map((row) => row.giftSlug).filter(isLandingDemoGiftSlug),
	};
});

/**
 * Likes or unlikes one demo gift for this browser. Soft-delete, never a hard delete, so
 * the (slug, visitor) row is reused forever and the partial unique index keeps a double
 * click from ever producing two active likes.
 */
export const toggleLandingDemoLike = publicCommand(
	ToggleLandingDemoLikeInputSchema,
	async (_authContext, input): Promise<ToggleLandingDemoLikeResult> => {
		const database = getDb();
		const anonVisitorId = getOrCreateAnonVisitorId();

		let liked = true;

		// No request context (unit tests) means no cookie to key on: report the current
		// count untouched rather than writing a row nobody could ever unlike.
		if (anonVisitorId !== null) {
			const existingLikes = await database
				.select({ id: landingDemoLike.id, deletedAt: landingDemoLike.deletedAt })
				.from(landingDemoLike)
				.where(
					and(
						eq(landingDemoLike.giftSlug, input.giftSlug),
						eq(landingDemoLike.anonVisitorId, anonVisitorId),
					),
				)
				.limit(1);

			const existingLike = existingLikes[0];

			if (existingLike === undefined) {
				const totalRows = await database
					.select({ total: drizzleCount() })
					.from(landingDemoLike)
					.where(eq(landingDemoLike.giftSlug, input.giftSlug));
				if (Number(totalRows[0]?.total ?? 0) >= LANDING_DEMO_LIKE_ROWS_PER_SLUG_CAP) {
					error(429, 'Demo like limit reached');
				}
				await database.insert(landingDemoLike).values({
					giftSlug: input.giftSlug,
					anonVisitorId,
				});
			} else {
				liked = existingLike.deletedAt !== null;
				await database
					.update(landingDemoLike)
					.set({ deletedAt: liked ? null : new Date() })
					.where(eq(landingDemoLike.id, existingLike.id));
			}
		}

		const countResult = await database
			.select({ likeCount: drizzleCount() })
			.from(landingDemoLike)
			.where(
				and(
					eq(landingDemoLike.giftSlug, input.giftSlug),
					isNull(landingDemoLike.deletedAt),
				),
			);

		// Keeps the mobile hook's second copy of the same wish in step with the list below
		// it, on the same response — no follow-up fetch.
		singleFlightRefresh(getLandingDemoLikes);

		return { liked, likeCount: Number(countResult[0]?.likeCount ?? 0) };
	},
);
