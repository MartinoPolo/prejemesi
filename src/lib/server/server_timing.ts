import { getRequestEvent } from '$app/server';
import type { RequestEvent } from '@sveltejs/kit';
import { SITE_URL } from '$lib/config/site.js';

type MeasuredMetric = 'auth' | 'app';

interface ServerTimingRecord {
	measuredMilliseconds: Map<MeasuredMetric, number>;
	databaseMilliseconds: number;
	databaseQueryCount: number;
}

/**
 * Keyed by `locals` because SvelteKit hands every hook, load function and `getRequestEvent()` a
 * fresh copy of the request event, while all copies share the request's one `locals` object.
 */
const recordsByRequest = new WeakMap<App.Locals, ServerTimingRecord>();

/** Lets queries outside any timed request, such as seeds and migrations, skip the event lookup. */
let timedRequestsInFlight = 0;

/**
 * Auth and database timings of production data would be a timing side channel, so only a Worker
 * configured with an application origin other than the production site exposes them. Keyed by the
 * configured origin rather than the request host because a preview URL of a production version
 * still serves production data. An unset or invalid origin counts as production.
 */
export function exposesServerTiming(applicationOrigin: string | undefined): boolean {
	if (applicationOrigin === undefined || !URL.canParse(applicationOrigin)) {
		return false;
	}
	return new URL(applicationOrigin).origin !== SITE_URL;
}

export function startServerTiming(event: RequestEvent): void {
	if (!recordsByRequest.has(event.locals)) {
		timedRequestsInFlight += 1;
	}
	recordsByRequest.set(event.locals, {
		measuredMilliseconds: new Map(),
		databaseMilliseconds: 0,
		databaseQueryCount: 0,
	});
}

export function stopServerTiming(event: RequestEvent): void {
	if (recordsByRequest.delete(event.locals)) {
		timedRequestsInFlight -= 1;
	}
}

/** Times `work` as `metric` when the request is being timed; otherwise only runs it. */
export async function measureServerTiming<T>(
	event: RequestEvent,
	metric: MeasuredMetric,
	work: () => T | Promise<T>,
): Promise<T> {
	const record = recordsByRequest.get(event.locals);
	if (record === undefined) {
		return work();
	}
	const startedAt = performance.now();
	try {
		return await work();
	} finally {
		const elapsedMilliseconds = performance.now() - startedAt;
		record.measuredMilliseconds.set(
			metric,
			(record.measuredMilliseconds.get(metric) ?? 0) + elapsedMilliseconds,
		);
	}
}

/**
 * Adds one finished query to the current request's timing; a no-op outside a timed request.
 * Durations are summed, so pipelined queries that overlap can add up to more than wall time.
 */
export function recordDatabaseQuery(milliseconds: number): void {
	if (timedRequestsInFlight === 0) {
		return;
	}
	let event: RequestEvent;
	try {
		event = getRequestEvent();
	} catch {
		return;
	}
	const record = recordsByRequest.get(event.locals);
	if (record === undefined) {
		return;
	}
	record.databaseMilliseconds += milliseconds;
	record.databaseQueryCount += 1;
}

function formatDuration(milliseconds: number): string {
	return (Math.round(milliseconds * 10) / 10).toFixed(1);
}

/**
 * Builds the `Server-Timing` value from the metrics this request recorded, or `undefined` when the
 * request is not being timed.
 */
export function serverTimingHeader(
	event: RequestEvent,
	totalMilliseconds: number,
): string | undefined {
	const record = recordsByRequest.get(event.locals);
	if (record === undefined) {
		return undefined;
	}
	const metrics: string[] = [];
	const authMilliseconds = record.measuredMilliseconds.get('auth');
	if (authMilliseconds !== undefined) {
		metrics.push(`auth;dur=${formatDuration(authMilliseconds)}`);
	}
	if (record.databaseQueryCount > 0) {
		const queryLabel = record.databaseQueryCount === 1 ? 'query' : 'queries';
		metrics.push(
			`db;dur=${formatDuration(record.databaseMilliseconds)};desc="${record.databaseQueryCount} ${queryLabel}"`,
		);
	}
	const appMilliseconds = record.measuredMilliseconds.get('app');
	if (appMilliseconds !== undefined) {
		metrics.push(`app;dur=${formatDuration(appMilliseconds)}`);
	}
	metrics.push(`total;dur=${formatDuration(totalMilliseconds)}`);
	return metrics.join(', ');
}
