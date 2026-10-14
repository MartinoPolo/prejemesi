import * as v from 'valibot';
import { and, eq } from 'drizzle-orm';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { wishlistVisit } from '$lib/server/db/wishlist_visit.schema.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { resolveRoleOnWishlistRow } from '$lib/modules/wishlists/wishlist_access.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import { keyShareLockViewedWishlistRow } from './wishlist_management.js';

/** Following is the actor's own state; agents never follow on a user's behalf. */
const FollowInputSchema = v.strictObject({ wishlistId: v.string() });

function actorFollowerRow(context: MutationOperationContext, wishlistId: string) {
	return and(
		eq(wishlistFollower.wishlistId, wishlistId),
		eq(wishlistFollower.userId, context.actor.userId),
	);
}

type ActorFollowerRow = { created: true } | { created: false; unfollowedAt: Date | null };

/**
 * The actor's follower row, created when absent. A concurrent request may insert it between the
 * lookup and the insert; that fresh row is an active follow.
 */
async function ensureActorFollowerRow(
	context: MutationOperationContext,
	wishlistId: string,
): Promise<ActorFollowerRow> {
	const [existingFollower] = await context.transaction
		.select({ unfollowedAt: wishlistFollower.unfollowedAt })
		.from(wishlistFollower)
		.where(actorFollowerRow(context, wishlistId))
		.limit(1);
	if (existingFollower !== undefined) {
		return { created: false, unfollowedAt: existingFollower.unfollowedAt };
	}
	const insertedFollowers = await context.transaction
		.insert(wishlistFollower)
		.values({ wishlistId, userId: context.actor.userId, lastVisitedAt: context.now })
		.onConflictDoNothing()
		.returning({ userId: wishlistFollower.userId });
	return insertedFollowers.length > 0
		? { created: true }
		: { created: false, unfollowedAt: null };
}

/**
 * Follows a wishlist, or refreshes the visit time of an existing follower row. The linked
 * recipient never follows their own list: it lives in Moje seznamy.
 */
export const followWishlistOperation = defineOperation({
	name: 'followWishlist',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: FollowInputSchema,
	async run(context, { wishlistId }) {
		const wishlistRow = await keyShareLockViewedWishlistRow(context.transaction, wishlistId);
		if (wishlistRow.recipientUserId === context.actor.userId) {
			return { followed: false, alreadyFollowing: false };
		}
		const follower = await ensureActorFollowerRow(context, wishlistId);
		if (follower.created) {
			return { followed: true, alreadyFollowing: false };
		}
		await context.transaction
			.update(wishlistFollower)
			.set({ lastVisitedAt: context.now })
			.where(actorFollowerRow(context, wishlistId));
		return { followed: false, alreadyFollowing: follower.unfollowedAt === null };
	},
});

/** Sledované keeps an unfollowed list behind its toggle, so unfollowing only marks the row. */
export const unfollowWishlistOperation = defineOperation({
	name: 'unfollowWishlist',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: FollowInputSchema,
	async run(context, { wishlistId }): Promise<void> {
		await context.transaction
			.update(wishlistFollower)
			.set({ unfollowedAt: context.now })
			.where(actorFollowerRow(context, wishlistId));
	},
});

/** The Sledované „follow again" action on a previously unfollowed list. */
export const refollowWishlistOperation = defineOperation({
	name: 'refollowWishlist',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: FollowInputSchema,
	async run(context, { wishlistId }): Promise<void> {
		await context.transaction
			.update(wishlistFollower)
			.set({ unfollowedAt: null, lastVisitedAt: context.now })
			.where(actorFollowerRow(context, wishlistId));
	},
});

/**
 * Records a visit for Nedávné recency (every signed-in viewer) and auto-follows a first-time
 * visitor. Managers never become followers; an existing follower row, even an unfollowed one,
 * is left as it is.
 */
export const recordWishlistVisitOperation = defineOperation({
	name: 'recordWishlistVisit',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: FollowInputSchema,
	async run(context, { wishlistId }): Promise<void> {
		const wishlistRow = await keyShareLockViewedWishlistRow(context.transaction, wishlistId);
		await context.transaction
			.insert(wishlistVisit)
			.values({ userId: context.actor.userId, wishlistId, lastVisitedAt: context.now })
			.onConflictDoUpdate({
				target: [wishlistVisit.userId, wishlistVisit.wishlistId],
				set: { lastVisitedAt: context.now },
			});
		const role = await resolveRoleOnWishlistRow(context.actor.userId, wishlistRow, {
			database: context.transaction,
		});
		if (role !== WISHLIST_ROLES.visitor) {
			return;
		}
		await ensureActorFollowerRow(context, wishlistId);
	},
});
