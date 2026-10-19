import type { AgentAccessGrant } from './agent_grant.js';

export const AGENT_CREDENTIAL_KIND = {
	personalAccessToken: 'personalAccessToken',
	/** An app the user connected through OAuth consent. */
	oauthGrant: 'oauthGrant',
} as const;

/** The credential an agent request authenticated with. */
export type AgentCredential =
	| {
			kind: typeof AGENT_CREDENTIAL_KIND.personalAccessToken;
			id: string;
			prefix: string;
			expiresAt: Date;
	  }
	| { kind: typeof AGENT_CREDENTIAL_KIND.oauthGrant; id: string };

/** An authenticated agent request: the user it acts for, within its grant, by its credential. */
export interface AgentCaller {
	credential: AgentCredential;
	/** Only a personal access token fast-forwards; an app's changes always wait for review. */
	fastForward: boolean;
	grant: AgentAccessGrant;
}

/** The credential columns of a row an agent creates: one names the credential, the other is null. */
export function credentialReference(credential: AgentCredential): {
	tokenId: string | null;
	oauthGrantId: string | null;
} {
	return credential.kind === AGENT_CREDENTIAL_KIND.personalAccessToken
		? { tokenId: credential.id, oauthGrantId: null }
		: { tokenId: null, oauthGrantId: credential.id };
}

/** The request limit's key: every credential has its own, and tokens and grants never share one. */
export function credentialRateLimitKey(credential: AgentCredential): string {
	return credential.kind === AGENT_CREDENTIAL_KIND.personalAccessToken
		? credential.id
		: `oauth:${credential.id}`;
}
