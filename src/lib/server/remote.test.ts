import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { User, Session } from 'better-auth';

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(),
	query: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
	command: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

import { getRequestEvent } from '$app/server';
import {
	guardedQuery,
	guardedQueryWithArgs,
	publicQuery,
	guardedCommand,
	guardedCommandNoArgs,
	publicCommand,
} from './remote.js';

const mockGetRequestEvent = vi.mocked(getRequestEvent);

const fakeUser = { id: 'user-1', email: 'test@example.com' } as unknown as User;
const fakeSession = { id: 'session-1', userId: 'user-1' } as unknown as Session;

function setupAuthenticatedEvent(): void {
	mockGetRequestEvent.mockReturnValue({
		locals: { user: fakeUser, session: fakeSession },
	} as ReturnType<typeof getRequestEvent>);
}

function setupUnauthenticatedEvent(): void {
	mockGetRequestEvent.mockReturnValue({
		locals: { user: undefined, session: undefined },
	} as unknown as ReturnType<typeof getRequestEvent>);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('guardedQuery', () => {
	it('calls handler with auth context and returns result when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'query-result');
		const wrappedQuery = guardedQuery(handler) as () => unknown;

		const result = wrappedQuery();

		expect(handler).toHaveBeenCalledWith({ user: fakeUser, session: fakeSession });
		expect(result).toBe('query-result');
	});

	it('throws 401 when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn();
		const wrappedQuery = guardedQuery(handler) as () => unknown;

		expect(() => wrappedQuery()).toThrow();
		expect(() => {
			setupUnauthenticatedEvent();
			wrappedQuery();
		}).toThrowError(expect.objectContaining({ status: 401 }));
	});
});

describe('guardedQueryWithArgs', () => {
	it('passes auth context and arg to handler when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'result-with-args');
		const wrappedQuery = guardedQueryWithArgs(handler) as (arg: unknown) => unknown;

		const result = wrappedQuery({ page: 1 });

		expect(handler).toHaveBeenCalledWith({ user: fakeUser, session: fakeSession }, { page: 1 });
		expect(result).toBe('result-with-args');
	});

	it('throws 401 when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn();
		const wrappedQuery = guardedQueryWithArgs(handler) as (arg: unknown) => unknown;

		expect(() => wrappedQuery({ page: 1 })).toThrowError(
			expect.objectContaining({ status: 401 }),
		);
		expect(handler).not.toHaveBeenCalled();
	});
});

describe('publicQuery', () => {
	it('passes AuthContext to handler when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'public-auth-result');
		const wrappedQuery = publicQuery(handler) as (arg: unknown) => unknown;

		const result = wrappedQuery('some-arg');

		expect(handler).toHaveBeenCalledWith({ user: fakeUser, session: fakeSession }, 'some-arg');
		expect(result).toBe('public-auth-result');
	});

	it('passes null as authContext when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn(() => 'public-anon-result');
		const wrappedQuery = publicQuery(handler) as (arg: unknown) => unknown;

		const result = wrappedQuery('some-arg');

		expect(handler).toHaveBeenCalledWith(null, 'some-arg');
		expect(result).toBe('public-anon-result');
	});
});

describe('guardedCommand', () => {
	it('calls handler with auth context and arg when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'command-result');
		const wrappedCommand = guardedCommand(handler) as (arg: unknown) => unknown;

		const result = wrappedCommand({ action: 'create' });

		expect(handler).toHaveBeenCalledWith(
			{ user: fakeUser, session: fakeSession },
			{ action: 'create' },
		);
		expect(result).toBe('command-result');
	});

	it('throws 401 when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn();
		const wrappedCommand = guardedCommand(handler) as (arg: unknown) => unknown;

		expect(() => wrappedCommand({ action: 'create' })).toThrowError(
			expect.objectContaining({ status: 401 }),
		);
		expect(handler).not.toHaveBeenCalled();
	});
});

describe('guardedCommandNoArgs', () => {
	it('calls handler with auth context when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'no-args-result');
		const wrappedCommand = guardedCommandNoArgs(handler) as () => unknown;

		const result = wrappedCommand();

		expect(handler).toHaveBeenCalledWith({ user: fakeUser, session: fakeSession });
		expect(result).toBe('no-args-result');
	});

	it('throws 401 when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn();
		const wrappedCommand = guardedCommandNoArgs(handler) as () => unknown;

		expect(() => wrappedCommand()).toThrowError(expect.objectContaining({ status: 401 }));
		expect(handler).not.toHaveBeenCalled();
	});
});

describe('publicCommand', () => {
	it('passes AuthContext to handler when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'public-cmd-auth-result');
		const wrappedCommand = publicCommand(handler) as (arg: unknown) => unknown;

		const result = wrappedCommand({ data: 'value' });

		expect(handler).toHaveBeenCalledWith(
			{ user: fakeUser, session: fakeSession },
			{ data: 'value' },
		);
		expect(result).toBe('public-cmd-auth-result');
	});

	it('passes null as authContext when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn(() => 'public-cmd-anon-result');
		const wrappedCommand = publicCommand(handler) as (arg: unknown) => unknown;

		const result = wrappedCommand({ data: 'value' });

		expect(handler).toHaveBeenCalledWith(null, { data: 'value' });
		expect(result).toBe('public-cmd-anon-result');
	});
});
