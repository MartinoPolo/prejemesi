import type { AgentAccessGrant } from './agent_grant.js';

export const AGENT_CREDENTIAL_KIND = {
	personalAccessToken: 'personalAccessToken',
	/** An app the user connected through OAuth consent. */
	oauthGrant: 'oauthGrant',
	/** The in-app AI assistant, acting in one of the user's chats. */
	chatSession: 'chatSession',
} as const;

/** The credential an agent request authenticated with. */
export type AgentCredential =
	| {
			kind: typeof AGENT_CREDENTIAL_KIND.personalAccessToken;
			id: string;
			prefix: string;
			expiresAt: Date;
	  }
	| { kind: typeof AGENT_CREDENTIAL_KIND.oauthGrant; id: string }
	| { kind: typeof AGENT_CREDENTIAL_KIND.chatSession; id: string };

/** An authenticated agent request: the user it acts for, within its grant, by its credential. */
export interface AgentCaller {
	credential: AgentCredential;
	/** A personal access token or a chat may fast-forward; an app's changes always wait for review. */
	fastForward: boolean;
	grant: AgentAccessGrant;
}

/** The credential columns of a row an agent creates: at most one names the credential. */
export function credentialReference(credential: AgentCredential): {
	tokenId: string | null;
	oauthGrantId: string | null;
} {
	switch (credential.kind) {
		case AGENT_CREDENTIAL_KIND.personalAccessToken:
			return { tokenId: credential.id, oauthGrantId: null };
		case AGENT_CREDENTIAL_KIND.oauthGrant:
			return { tokenId: null, oauthGrantId: credential.id };
		case AGENT_CREDENTIAL_KIND.chatSession:
			return { tokenId: null, oauthGrantId: null };
	}
}

/** The request limit's key: every credential has its own, and no two kinds share one. */
export function credentialRateLimitKey(credential: AgentCredential): string {
	switch (credential.kind) {
		case AGENT_CREDENTIAL_KIND.personalAccessToken:
			return credential.id;
		case AGENT_CREDENTIAL_KIND.oauthGrant:
			return `oauth:${credential.id}`;
		case AGENT_CREDENTIAL_KIND.chatSession:
			return `chat:${credential.id}`;
	}
}

/** The credentials that keep `Idempotency-Key`s; a chat submits each change once. */
export type IdempotentCredential = Exclude<
	AgentCredential,
	{ kind: typeof AGENT_CREDENTIAL_KIND.chatSession }
>;

export function keepsIdempotencyKeys(
	credential: AgentCredential,
): credential is IdempotentCredential {
	return credential.kind !== AGENT_CREDENTIAL_KIND.chatSession;
}
