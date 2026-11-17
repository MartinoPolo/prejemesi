import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const privateEnvironment = vi.hoisted(() => ({}) as Record<string, string | undefined>);

vi.mock('$env/dynamic/private', () => ({ env: privateEnvironment }));

const { createRequestTelemetryHandle } = await import('./request_telemetry.js');
const { measureServerTiming, serverTimingHeader } = await import('./server_timing.js');

function createEvent(): RequestEvent {
	return {
		request: new Request('https://prejemesi.cz/en/w/private?token=secret', {
			method: 'POST',
			headers: { authorization: 'Bearer private' },
			body: 'email=private@example.com',
		}),
		route: { id: '/[[lang=locale]]/w/[id]' },
		platform: { env: { CF_VERSION_METADATA: { id: 'version-123' } } },
		locals: {},
	} as unknown as RequestEvent;
}

/** A clock that only moves when a test advances it, so durations do not depend on call order. */
function createClock(startMilliseconds: number) {
	let currentMilliseconds = startMilliseconds;
	return {
		now: () => currentMilliseconds,
		advance: (milliseconds: number) => {
			currentMilliseconds += milliseconds;
		},
	};
}

function resolveAfter(
	clock: ReturnType<typeof createClock>,
	milliseconds: number,
	response: Response,
) {
	return async () => {
		clock.advance(milliseconds);
		return response;
	};
}

beforeEach(() => {
	delete privateEnvironment.ORIGIN;
});

describe('request telemetry', () => {
	it('sets a Server-Timing header with the total request duration', async () => {
		const clock = createClock(100);
		const handle = createRequestTelemetryHandle({
			write: vi.fn(),
			now: clock.now,
			exposeServerTiming: () => true,
		});

		const response = await handle({
			event: createEvent(),
			resolve: resolveAfter(clock, 12.64, new Response('ok')),
		});

		expect(response.headers.get('Server-Timing')).toBe('total;dur=12.6');
	});

	it('includes timings recorded while resolving the request', async () => {
		const clock = createClock(0);
		const handle = createRequestTelemetryHandle({
			write: vi.fn(),
			now: clock.now,
			exposeServerTiming: () => true,
		});

		const response = await handle({
			event: createEvent(),
			resolve: (event) =>
				measureServerTiming({ ...event }, 'app', () => {
					clock.advance(30);
					return new Response('rendered');
				}),
		});

		expect(response.headers.get('Server-Timing')).toMatch(/^app;dur=\d+\.\d, total;dur=30\.0$/);
	});

	it('sets no header when server timing is not exposed', async () => {
		const clock = createClock(0);
		const handle = createRequestTelemetryHandle({
			write: vi.fn(),
			now: clock.now,
			exposeServerTiming: () => false,
		});

		const response = await handle({
			event: createEvent(),
			resolve: (event) =>
				measureServerTiming({ ...event }, 'auth', () => new Response('rendered')),
		});

		expect(response.headers.get('Server-Timing')).toBeNull();
	});

	it.each([
		['the production origin', 'https://prejemesi.cz', false],
		['the staging origin', 'https://staging.prejemesi.cz', true],
		['a local origin', 'http://localhost:8300', true],
	])('decides exposure from the configured ORIGIN for %s', async (_label, origin, exposed) => {
		privateEnvironment.ORIGIN = origin;
		const handle = createRequestTelemetryHandle({ write: vi.fn() });

		const response = await handle({
			event: createEvent(),
			resolve: async () => new Response('ok'),
		});

		expect(response.headers.has('Server-Timing')).toBe(exposed);
	});

	it('returns a response with immutable headers unchanged', async () => {
		const clock = createClock(0);
		const handle = createRequestTelemetryHandle({
			write: vi.fn(),
			now: clock.now,
			exposeServerTiming: () => true,
		});
		const immutableResponse = Response.redirect('https://prejemesi.cz/home', 303);

		const response = await handle({
			event: createEvent(),
			resolve: resolveAfter(clock, 1, immutableResponse),
		});

		expect(response).toBe(immutableResponse);
		expect(response.headers.get('Server-Timing')).toBeNull();
	});

	it('writes privacy-safe start and completion records', async () => {
		const write = vi.fn();
		const clock = createClock(100);
		const handle = createRequestTelemetryHandle({ write, now: clock.now });

		await handle({
			event: createEvent(),
			resolve: resolveAfter(clock, 12.6, new Response(null, { status: 204 })),
		});

		expect(write).toHaveBeenNthCalledWith(1, {
			phase: 'start',
			routeId: '/[[lang=locale]]/w/[id]',
			method: 'POST',
			deploymentVersionId: 'version-123',
		});
		expect(write).toHaveBeenNthCalledWith(2, {
			phase: 'complete',
			routeId: '/[[lang=locale]]/w/[id]',
			method: 'POST',
			status: 204,
			outcome: 'success',
			durationMilliseconds: 13,
			deploymentVersionId: 'version-123',
		});

		const serializedRecords = JSON.stringify(write.mock.calls);
		expect(serializedRecords).not.toContain('private');
		expect(serializedRecords).not.toContain('secret');
		expect(serializedRecords).not.toContain('authorization');
		expect(serializedRecords).not.toContain('email');
	});

	it('logs the same duration it reports in the header', async () => {
		const write = vi.fn();
		const clock = createClock(0);
		const handle = createRequestTelemetryHandle({
			write,
			now: clock.now,
			exposeServerTiming: () => true,
		});

		const response = await handle({
			event: createEvent(),
			resolve: resolveAfter(clock, 41.56, new Response('ok')),
		});

		expect(write).toHaveBeenLastCalledWith(
			expect.objectContaining({ phase: 'complete', durationMilliseconds: 42 }),
		);
		expect(response.headers.get('Server-Timing')).toBe('total;dur=41.6');
	});

	it('records a safe failure outcome and rethrows hook failures', async () => {
		const write = vi.fn();
		const clock = createClock(20);
		const handle = createRequestTelemetryHandle({
			write,
			now: clock.now,
			exposeServerTiming: () => true,
		});
		const failure = new Error('private@example.com token=secret');

		await expect(
			handle({
				event: createEvent(),
				resolve: async () => {
					clock.advance(5);
					throw failure;
				},
			}),
		).rejects.toBe(failure);

		expect(write).toHaveBeenLastCalledWith({
			phase: 'complete',
			routeId: '/[[lang=locale]]/w/[id]',
			method: 'POST',
			status: 500,
			outcome: 'unhandled_error',
			durationMilliseconds: 5,
			deploymentVersionId: 'version-123',
		});
	});

	it('stops timing a request whose hooks throw', async () => {
		const handle = createRequestTelemetryHandle({
			write: vi.fn(),
			exposeServerTiming: () => true,
		});
		const event = createEvent();

		await expect(
			handle({
				event,
				resolve: async () => {
					throw new Error('render failed');
				},
			}),
		).rejects.toThrow('render failed');

		expect(serverTimingHeader(event, 1)).toBeUndefined();
	});

	it.each([
		[399, 'success'],
		[400, 'client_error'],
		[499, 'client_error'],
		[500, 'server_error'],
	] as const)('classifies response status %s as %s', async (status, outcome) => {
		const write = vi.fn();
		const handle = createRequestTelemetryHandle({ write });

		await handle({
			event: createEvent(),
			resolve: async () => new Response(null, { status }),
		});

		expect(write).toHaveBeenLastCalledWith(
			expect.objectContaining({ phase: 'complete', status, outcome }),
		);
	});
});
