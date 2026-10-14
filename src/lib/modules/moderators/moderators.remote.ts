import * as v from 'valibot';
import { guardedCommand, guardedQueryWithArgs, singleFlightRefresh } from '$lib/server/remote.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import {
	acceptModeratorInviteOperation,
	generateModeratorInviteLinkOperation,
	readWishlistModeratorsOperation,
	removeModeratorOperation,
	revokeModeratorInviteOperation,
	selfPromoteToModeratorOperation,
} from '$lib/server/operations/manager_invitation_operations.js';
import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import {
	GenerateInviteInputSchema,
	AcceptInviteInputSchema,
	RevokeInviteInputSchema,
	RemoveModeratorInputSchema,
	SelfPromoteInputSchema,
	type ModeratorsData,
} from './types.js';

// Thin adapters over the operation core, which owns správce invitation rights.

export const getModeratorsForWishlist = guardedQueryWithArgs(
	v.string(),
	({ user }, wishlistId): Promise<ModeratorsData> =>
		executeOperation(userInterfaceActor(user), readWishlistModeratorsOperation, { wishlistId }),
);

export const generateModeratorInviteLink = guardedCommand(
	GenerateInviteInputSchema,
	async ({ user }, input) => {
		const invite = await executeOperation(
			userInterfaceActor(user),
			generateModeratorInviteLinkOperation,
			input,
		);
		if (invite.link === null) {
			throw new Error('A UI invite always returns its link');
		}
		return {
			token: invite.link.token,
			invitePath: invite.link.invitePath,
			unregisteredInvitee: invite.unregisteredInvitee,
		};
	},
);

export const acceptModeratorInvite = guardedCommand(AcceptInviteInputSchema, ({ user }, input) =>
	executeOperation(userInterfaceActor(user), acceptModeratorInviteOperation, input),
);

export const revokeModeratorInvite = guardedCommand(RevokeInviteInputSchema, ({ user }, input) =>
	executeOperation(userInterfaceActor(user), revokeModeratorInviteOperation, input),
);

export const removeModerator = guardedCommand(RemoveModeratorInputSchema, ({ user }, input) =>
	executeOperation(userInterfaceActor(user), removeModeratorOperation, input),
);

export const selfPromoteToModerator = guardedCommand(
	SelfPromoteInputSchema,
	async ({ user }, input) => {
		const { wishlistShortId } = await executeOperation(
			userInterfaceActor(user),
			selfPromoteToModeratorOperation,
			input,
		);
		// Single-flight refresh (issue #108, REQ-3/4): self-promotion changes both the
		// header flag and the gift shaping (counts become visible) on the open page.
		singleFlightRefresh(getWishlistByShortId, wishlistShortId);
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
		return { success: true };
	},
);
