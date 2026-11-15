import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const getRequestEvent = vi.hoisted(() => vi.fn<() => RequestEvent>());

vi.mock('$app/server', () => ({ getRequestEvent }));

const {
	exposesServerTiming,
	measureServerTiming,
	recordDatabaseQuery,
	serverTimingHeader,
	startServerTiming,
	stopServerTiming,
} = await import('./server_timing.js');

const timedEvents: RequestEvent[] = [];

function createEvent(): RequestEvent {
	return { locals: {} } as RequestEvent;
}

function createTimedEvent(): RequestEvent {
	const event = createEvent();
	startServerTiming(event);
	timedEvents.push(event);
	return event;
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
	for (const event of timedEvents.splice(0)) {
		stopServerTiming(event);
	}
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

describe('server timing exposure', () => {
	it('hides timings on the production origin', () => {
		expect(exposesServerTiming('https://prejemesi.cz')).toBe(false);
		expect(exposesServerTiming('https://prejemesi.cz/')).toBe(false);
	});

	it('hides timings when the origin is unset or invalid', () => {
		expect(exposesServerTiming(undefined)).toBe(false);
		expect(exposesServerTiming('')).toBe(false);
		expect(exposesServerTiming('not an origin')).toBe(false);
	});

	it('exposes timings on staging, preview and local origins', () => {
		expect(exposesServerTiming('https://staging.prejemesi.cz')).toBe(true);
		expect(exposesServerTiming('http://localhost:4173')).toBe(true);
		expect(exposesServerTiming('http://localhost:8300')).toBe(true);
	});
});

describe('server timing', () => {
	it('reports auth, database, app and total durations rounded to one decimal', async () => {
		const event = createTimedEvent();
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
		const event = createTimedEvent();
		getRequestEvent.mockReturnValue(event);
		recordDatabaseQuery(1.25);

		expect(serverTimingHeader(event, 2)).toBe('db;dur=1.3;desc="1 query", total;dur=2.0');
	});

	it('omits metrics the request did not record', () => {
		const event = createTimedEvent();

		expect(serverTimingHeader(event, 7.25)).toBe('total;dur=7.3');
	});

	it('returns the measured work result and still records failed work', async () => {
		const event = createTimedEvent();

		await expect(measureServerTiming(event, 'app', () => 'rendered')).resolves.toBe('rendered');
		await expect(
			measureServerTiming(event, 'auth', () => {
				clock += 4;
				throw new Error('session store down');
			}),
		).rejects.toThrow('session store down');

		expect(serverTimingHeader(event, 10)).toBe('auth;dur=4.0, app;dur=0.0, total;dur=10.0');
	});

	it('skips the request lookup for queries while no request is timed', () => {
		recordDatabaseQuery(3);

		expect(getRequestEvent).not.toHaveBeenCalled();
	});

	it('ignores database queries outside a request while another request is timed', () => {
		createTimedEvent();
		getRequestEvent.mockImplementation(() => {
			throw new Error('Can only read the current request event inside functions');
		});

		expect(() => recordDatabaseQuery(3)).not.toThrow();
	});

	it('ignores database queries of a request that is not being timed', () => {
		const timedEvent = createTimedEvent();
		getRequestEvent.mockReturnValue(createEvent());

		recordDatabaseQuery(3);

		expect(serverTimingHeader(timedEvent, 5)).toBe('total;dur=5.0');
	});

	it('builds no header and runs measured work untimed when timing was never started', async () => {
		const event = createEvent();

		await expect(measureServerTiming(event, 'auth', () => 'session')).resolves.toBe('session');
		expect(serverTimingHeader(event, 1)).toBeUndefined();
	});

	it('builds no header and records no queries once timing stopped', () => {
		const event = createEvent();
		startServerTiming(event);
		stopServerTiming(event);
		getRequestEvent.mockReturnValue(event);

		recordDatabaseQuery(3);

		expect(getRequestEvent).not.toHaveBeenCalled();
		expect(serverTimingHeader(event, 1)).toBeUndefined();
	});
});
