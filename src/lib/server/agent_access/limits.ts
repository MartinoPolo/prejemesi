import { MAX_OPERATION_BATCH_STEPS } from '$lib/server/operations/constants.js';

/**
 * Every limit of the agent API. The request rate is enforced by the `AGENT_API_RATE_LIMIT`
 * Workers binding, whose `wrangler.jsonc` configuration must match.
 */
export const AGENT_API_RATE_LIMIT = {
	requestsPerToken: 120,
	periodSeconds: 60,
} as const;

/** Items in one agent batch; the operation core's own cap, so the two never diverge. */
export const AGENT_BATCH_MAX_ITEMS = MAX_OPERATION_BATCH_STEPS;

export const AGENT_API_MAX_BODY_BYTES = 1024 * 1024;

/** `last_used_at` is written at most this often per token. */
export const ACCESS_TOKEN_LAST_USED_INTERVAL_MS = 60 * 1000;
