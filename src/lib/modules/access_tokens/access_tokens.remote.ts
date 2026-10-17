import { guardedCommand, guardedQuery, singleFlightRefresh } from '$lib/server/remote.js';
import { rejectDemoOperation } from '$lib/server/demo/scope.js';
import {
	createAccessToken as createUserAccessToken,
	listAccessTokens,
	listAccessTokenWishlistChoices,
	revokeAccessToken as revokeUserAccessToken,
	rollAccessToken as rollUserAccessToken,
} from '$lib/server/agent_access/access_tokens.js';
import {
	CreateAccessTokenInputSchema,
	RevokeAccessTokenInputSchema,
	RollAccessTokenInputSchema,
} from './types.js';

export const getAccessTokens = guardedQuery(({ user }) => listAccessTokens(user.id));

export const getAccessTokenWishlistChoices = guardedQuery(({ user }) =>
	listAccessTokenWishlistChoices(user.id),
);

/** Returns the token value this once; only its hash is stored. */
export const createAccessToken = guardedCommand(
	CreateAccessTokenInputSchema,
	async ({ user }, input) => {
		rejectDemoOperation();
		const created = await createUserAccessToken(user.id, input);
		await singleFlightRefresh(getAccessTokens);
		return created;
	},
);

export const revokeAccessToken = guardedCommand(
	RevokeAccessTokenInputSchema,
	async ({ user }, { tokenId }) => {
		rejectDemoOperation();
		await revokeUserAccessToken(user.id, tokenId);
		await singleFlightRefresh(getAccessTokens);
	},
);

/** Returns the new token value this once; the old value stops working immediately. */
export const rollAccessToken = guardedCommand(
	RollAccessTokenInputSchema,
	async ({ user }, input) => {
		rejectDemoOperation();
		const rolled = await rollUserAccessToken(user.id, input);
		await singleFlightRefresh(getAccessTokens);
		return rolled;
	},
);
