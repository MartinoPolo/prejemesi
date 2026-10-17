import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import type { AccessTokenSummary } from '$lib/modules/access_tokens/index.js';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

export function accessTokenSummary(
	overrides: Partial<AccessTokenSummary> = {},
): AccessTokenSummary {
	const now = Date.now();
	return {
		id: 'token-claude',
		name: 'Claude – vánoční dárky',
		prefix: 'pjs_7Kq2',
		scopes: [AGENT_SCOPE.read, AGENT_SCOPE.giftsWrite],
		wishlists: null,
		fastForward: false,
		expiresAt: new Date(now + 300 * DAY_MILLISECONDS),
		expiryPresetDays: 365,
		expired: false,
		lastUsedAt: null,
		createdAt: new Date(now - 65 * DAY_MILLISECONDS),
		rolledAt: null,
		...overrides,
	};
}

export function daysFromNow(days: number): Date {
	return new Date(Date.now() + days * DAY_MILLISECONDS);
}
