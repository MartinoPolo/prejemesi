import { DAY_MS, MAX_OPERATION_BATCH_STEPS } from '$lib/server/operations/constants.js';

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

/**
 * Proposal rows one user may submit over a trailing window, across all their tokens: generous
 * for a family's wishlists, yet a bound on a runaway agent.
 */
export const AGENT_DAILY_CHANGE_BUDGET = {
	rows: 1000,
	windowMs: DAY_MS,
} as const;

export const AGENT_API_MAX_BODY_BYTES = 1024 * 1024;

/** `last_used_at` is written at most this often per token. */
export const ACCESS_TOKEN_LAST_USED_INTERVAL_MS = 60 * 1000;

/** How long a pending proposal can be applied after submission. */
export const CHANGE_PROPOSAL_LIFETIME_MS = 7 * DAY_MS;
/** An expired proposal stays readable this long, so a late review link shows it as expired. */
export const CHANGE_PROPOSAL_EXPIRED_RETENTION_MS = 7 * DAY_MS;

/** A stored `Idempotency-Key` response is replayed for this long. */
export const IDEMPOTENCY_KEY_RETENTION_MS = DAY_MS;
/** A key still in progress after this long belongs to a request that died; a retry takes it over. */
export const IDEMPOTENCY_KEY_ABANDONED_AFTER_MS = 5 * 60 * 1000;

/** Per-isolate throttle for the opportunistic proposal and idempotency key purge. */
export const AGENT_ACCESS_PURGE_INTERVAL_MS = 60 * 60 * 1000;
/** Rows deleted per purge statement, and the most statements one purge run issues per table. */
export const AGENT_ACCESS_PURGE_CHUNK_SIZE = 500;
export const AGENT_ACCESS_PURGE_MAX_CHUNKS = 20;
