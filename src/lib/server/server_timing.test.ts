import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const getRequestEvent = vi.hoisted(() => vi.fn<() => RequestEvent>());

vi.mock('$app/server', () => ({ getRequestEvent }));

const { measureServerTiming, recordDatabaseQuery, serverTimingHeader, startServerTiming } =
	await import('./server_timing.js');

function createEvent(): RequestEvent {
	return { locals: {} } as RequestEvent;
}

/** SvelteKit hands each hook and load function its own event copy sharing one `locals`. */
function copyOf(event: RequestEvent): RequestEvent {
	return { ...event };
}

let clock = 0;

beforeEach(() => {
	clock = 0;
	vi.spyOn(performance, 'now').mockImplementation(() => clock);
	getRequestEvent.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function measureFor(
	event: RequestEvent,
	metric: 'auth' | 'app',
	milliseconds: number,
): Promise<void> {
	await measureServerTiming(event, metric, () => {
		clock += milliseconds;
	});
}

describe('server timing', () => {
	it('reports auth, database, app and total durations rounded to one decimal', async () => {
		const event = createEvent();
		startServerTiming(event);
		await measureFor(copyOf(event), 'auth', 12.34);
		await measureFor(copyOf(event), 'app', 40.25);
		getRequestEvent.mockReturnValue(copyOf(event));
		recordDatabaseQuery(3.04);
		recordDatabaseQuery(5.06);

		expect(serverTimingHeader(event, 55)).toBe(
			'auth;dur=12.3, db;dur=8.1;desc="2 queries", app;dur=40.3, total;dur=55.0',
		);
	});

	it('names a single database query in the singular', () => {
		const event = createEvent();
		startServerTiming(event);
		getRequestEvent.mockReturnValue(event);
		recordDatabaseQuery(1.25);

		expect(serverTimingHeader(event, 2)).toBe('db;dur=1.3;desc="1 query", total;dur=2.0');
	});

	it('omits metrics the request did not record', () => {
		const event = createEvent();
		startServerTiming(event);

		expect(serverTimingHeader(event, 7.25)).toBe('total;dur=7.3');
	});

	it('returns the measured work result and still records failed work', async () => {
		const event = createEvent();
		startServerTiming(event);

		await expect(measureServerTiming(event, 'app', () => 'rendered')).resolves.toBe('rendered');
		await expect(
			measureServerTiming(event, 'auth', () => {
				clock += 4;
				throw new Error('session store down');
			}),
		).rejects.toThrow('session store down');

		expect(serverTimingHeader(event, 10)).toBe('auth;dur=4.0, app;dur=0.0, total;dur=10.0');
	});

	it('ignores database queries outside a request', () => {
		getRequestEvent.mockImplementation(() => {
			throw new Error('Can only read the current request event inside functions');
		});

		expect(() => recordDatabaseQuery(3)).not.toThrow();
	});

	it('ignores database queries of a request that is not being timed', () => {
		const timedEvent = createEvent();
		startServerTiming(timedEvent);
		getRequestEvent.mockReturnValue(createEvent());

		recordDatabaseQuery(3);

		expect(serverTimingHeader(timedEvent, 5)).toBe('total;dur=5.0');
	});

	it('runs measured work untimed when the request is not being timed', async () => {
		const event = createEvent();

		await expect(measureServerTiming(event, 'auth', () => 'session')).resolves.toBe('session');
		expect(serverTimingHeader(event, 1)).toBe('total;dur=1.0');
	});
});
