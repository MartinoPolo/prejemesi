import { error } from '@sveltejs/kit';
import type { OperationActor, OperationChannel } from '$lib/server/operations/actor.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { AgentScope } from '$lib/modules/access_tokens/scopes.js';

/** What one personal access token or connected app lets its user's agent do. */
export interface AgentAccessGrant {
	userId: string;
	userName: string;
	/** The token's name, or the connected app's. */
	tokenName: string;
	/** Recorded on every change the grant makes. */
	channel: OperationChannel;
	scopes: readonly AgentScope[];
	/** The wishlists the grant is limited to; null when it reaches every wishlist its user may. */
	wishlistIds: readonly string[] | null;
}

export function hasAgentScope(grant: Pick<AgentAccessGrant, 'scopes'>, scope: AgentScope): boolean {
	return grant.scopes.includes(scope);
}

/** 403 naming the missing scope, so an app can ask its user for exactly that one. */
export function requireAgentScope(
	grant: Pick<AgentAccessGrant, 'scopes'>,
	scope: AgentScope,
): void {
	if (!hasAgentScope(grant, scope)) {
		error(403, JSON.stringify({ code: SERVER_ERROR.AGENT_SCOPE_MISSING, scope }));
	}
}

/** The grant's user acting through its channel; grants never carry administrator capabilities. */
export function tokenActor(
	grant: Pick<AgentAccessGrant, 'userId' | 'userName' | 'channel'>,
): OperationActor {
	return {
		userId: grant.userId,
		userName: grant.userName,
		channel: grant.channel,
		isAppAdministrator: false,
	};
}
