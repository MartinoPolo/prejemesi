/**
 * What a personal access token may do. A token never exceeds its user's current rights: the
 * operation core still checks the user's role on every call.
 */
export const AGENT_SCOPE = {
	read: 'read',
	giftsWrite: 'gifts:write',
	reservationsWrite: 'reservations:write',
	managersInvite: 'managers:invite',
	/** Reserver names in reads; agent reads flow to third-party AI providers. */
	reservationsIdentities: 'reservations:identities',
} as const;

export type AgentScope = (typeof AGENT_SCOPE)[keyof typeof AGENT_SCOPE];

const AGENT_SCOPES = new Set<string>(Object.values(AGENT_SCOPE));

export function isAgentScope(value: string): value is AgentScope {
	return AGENT_SCOPES.has(value);
}
