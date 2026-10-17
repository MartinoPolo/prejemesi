import { DAY_MS, MAX_OPERATION_BATCH_STEPS } from '$lib/server/operations/constants.js';
import {
	DEFAULT_IMAGE_DOWNLOAD_TIMEOUT_MS,
	DEFAULT_IMAGE_MAX_REDIRECTS,
} from '$lib/server/images/image_download.js';

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

/**
 * How long an image an agent supplied by URL can be attached to a gift: a day to submit it in a
 * proposal, plus the proposal's own lifetime for the user to apply it.
 */
export const AGENT_IMAGE_REFERENCE_LIFETIME_MS = DAY_MS + CHANGE_PROPOSAL_LIFETIME_MS;
/**
 * An expired image is purged only this long after its expiry, so an apply that checked it just
 * before expiry has committed and the purge sees the gift referencing it.
 */
export const AGENT_IMAGE_PURGE_DELAY_MS = 60 * 60 * 1000;
/**
 * Images one user may supply by URL over a trailing window, across all their tokens: each costs
 * a server-side download and R2 storage until it is attached or purged.
 */
export const AGENT_DAILY_IMAGE_BUDGET = {
	images: 100,
	windowMs: DAY_MS,
} as const;
/** The shared image download limits, so ingestion and agents fetch alike. */
export const AGENT_IMAGE_FETCH_TIMEOUT_MS = DEFAULT_IMAGE_DOWNLOAD_TIMEOUT_MS;
export const AGENT_IMAGE_MAX_REDIRECTS = DEFAULT_IMAGE_MAX_REDIRECTS;

/** Per-isolate throttle for the opportunistic proposal and idempotency key purge. */
export const AGENT_ACCESS_PURGE_INTERVAL_MS = 60 * 60 * 1000;
/** Rows deleted per purge statement, and the most statements one purge run issues per table. */
export const AGENT_ACCESS_PURGE_CHUNK_SIZE = 500;
export const AGENT_ACCESS_PURGE_MAX_CHUNKS = 20;
