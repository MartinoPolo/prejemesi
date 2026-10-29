export const DAY_MS = 24 * 60 * 60 * 1000;

export const GIFT_REVISION_RETENTION_DAYS = 90;
export const GIFT_REVISION_RETENTION_MS = GIFT_REVISION_RETENTION_DAYS * DAY_MS;
/** Per-isolate throttle for the opportunistic revision purge. */
export const GIFT_REVISION_PURGE_INTERVAL_MS = 60 * 60 * 1000;
/** Rows deleted per purge statement, and the most statements one purge run issues. */
export const GIFT_REVISION_PURGE_CHUNK_SIZE = 1000;
export const GIFT_REVISION_PURGE_MAX_CHUNKS = 100;
export const MAX_OPERATION_BATCH_STEPS = 200;
/** Parallel reserver notifications per committed batch. */
export const RESERVER_NOTIFICATION_CONCURRENCY = 4;
