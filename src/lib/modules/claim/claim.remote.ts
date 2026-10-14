import * as v from 'valibot';
import { guardedCommand, guardedQueryWithArgs, singleFlightRefresh } from '$lib/server/remote.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import {
	acceptClaimInviteOperation,
	generateClaimInviteLinkOperation,
	readClaimInvitesOperation,
	revokeClaimInviteOperation,
} from '$lib/server/operations/claim_invite_operations.js';
import {
	getMyWishlists,
	getModeratedWishlists,
	getFollowedWishlists,
	getWishlistByShortId,
} from '$lib/modules/wishlists/wishlists.remote.js';
import {
	GenerateClaimInviteInputSchema,
	AcceptClaimInviteInputSchema,
	RevokeClaimInviteInputSchema,
	type ClaimInvitesData,
} from './types.js';

// Thin adapters over the operation core, which owns claim rights and the spoiler guards.

export const getClaimInvitesForWishlist = guardedQueryWithArgs(
	v.string(),
	({ user }, wishlistId): Promise<ClaimInvitesData> =>
		executeOperation(userInterfaceActor(user), readClaimInvitesOperation, { wishlistId }),
);

export const generateClaimInviteLink = guardedCommand(
	GenerateClaimInviteInputSchema,
	({ user }, input) =>
		executeOperation(userInterfaceActor(user), generateClaimInviteLinkOperation, input),
);

export const acceptClaimInvite = guardedCommand(
	AcceptClaimInviteInputSchema,
	async ({ user }, input) => {
		const result = await executeOperation(
			userInterfaceActor(user),
			acceptClaimInviteOperation,
			input,
		);
		// Single-flight refresh (issue #108, REQ-3/4): the claimed list appears in the
		// claimer's "Moje seznamy" (and, if they held a správce assignment, disappears from
		// "Spravované") without a reload. Untracked queries are a no-op.
		singleFlightRefresh(getWishlistByShortId, result.wishlistShortId);
		singleFlightRefresh(getMyWishlists);
		singleFlightRefresh(getModeratedWishlists);
		singleFlightRefresh(getFollowedWishlists);
		return result;
	},
);

export const revokeClaimInvite = guardedCommand(RevokeClaimInviteInputSchema, ({ user }, input) =>
	executeOperation(userInterfaceActor(user), revokeClaimInviteOperation, input),
);
