import { tokenChannel, type OperationActor } from '$lib/server/operations/actor.js';
import type { AgentScope } from '$lib/modules/access_tokens/scopes.js';

/** What one personal access token lets its user's agent do. */
export interface AgentAccessGrant {
	userId: string;
	userName: string;
	tokenName: string;
	scopes: readonly AgentScope[];
	/** The wishlists the token is limited to; null when it reaches every wishlist its user may. */
	wishlistIds: readonly string[] | null;
}

export function hasAgentScope(grant: Pick<AgentAccessGrant, 'scopes'>, scope: AgentScope): boolean {
	return grant.scopes.includes(scope);
}

/** The token's user acting through the token; tokens never carry administrator capabilities. */
export function tokenActor(
	grant: Pick<AgentAccessGrant, 'userId' | 'userName' | 'tokenName'>,
): OperationActor {
	return {
		userId: grant.userId,
		userName: grant.userName,
		channel: tokenChannel(grant.tokenName),
		isAppAdministrator: false,
	};
}
