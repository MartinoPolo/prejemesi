import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { getDb as getDbFunction } from './index.js';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => {
		throw new Error('No request event in this test');
	},
}));
vi.mock('postgres', () => ({ default: () => ({ unsafe: vi.fn() }) }));
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: () => ({}) }));

let getDb: typeof getDbFunction;

beforeAll(async () => {
	vi.stubEnv('DEV', false);
	({ getDb } = await import('./index.js'));
});
afterAll(() => vi.unstubAllEnvs());

function hyperdriveRequestEvent(): RequestEvent {
	return {
		locals: {},
		platform: { env: { HYPERDRIVE: { connectionString: 'postgres://hyperdrive/prejemesi' } } },
	} as unknown as RequestEvent;
}

describe('getDb on the Workers Hyperdrive path', () => {
	it('reuses one client across the event copies SvelteKit hands to hooks, loads and remote functions', () => {
		const event = hyperdriveRequestEvent();
		const eventCopy = { ...event };

		expect(getDb(eventCopy)).toBe(getDb(event));
	});

	it('gives each request its own client', () => {
		expect(getDb(hyperdriveRequestEvent())).not.toBe(getDb(hyperdriveRequestEvent()));
	});
});
