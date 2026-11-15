import { getRequestEvent } from '$app/server';
import type { RequestEvent } from '@sveltejs/kit';

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

export function startServerTiming(event: RequestEvent): void {
	recordsByRequest.set(event.locals, {
		measuredMilliseconds: new Map(),
		databaseMilliseconds: 0,
		databaseQueryCount: 0,
	});
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

/** Builds the `Server-Timing` value, listing only the metrics this request recorded. */
export function serverTimingHeader(event: RequestEvent, totalMilliseconds: number): string {
	const record = recordsByRequest.get(event.locals);
	const metrics: string[] = [];
	const authMilliseconds = record?.measuredMilliseconds.get('auth');
	if (authMilliseconds !== undefined) {
		metrics.push(`auth;dur=${formatDuration(authMilliseconds)}`);
	}
	if (record !== undefined && record.databaseQueryCount > 0) {
		const queryLabel = record.databaseQueryCount === 1 ? 'query' : 'queries';
		metrics.push(
			`db;dur=${formatDuration(record.databaseMilliseconds)};desc="${record.databaseQueryCount} ${queryLabel}"`,
		);
	}
	const appMilliseconds = record?.measuredMilliseconds.get('app');
	if (appMilliseconds !== undefined) {
		metrics.push(`app;dur=${formatDuration(appMilliseconds)}`);
	}
	metrics.push(`total;dur=${formatDuration(totalMilliseconds)}`);
	return metrics.join(', ');
}
