import { vi, describe, it, expect, beforeEach } from 'vitest';

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

vi.mock('$lib/server/remote.js', () => ({
	guardedCommand: vi.fn((handler: Function) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
	guardedCommandNoArgs: vi.fn((handler: Function) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
	guardedQuery: vi.fn((handler: Function) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'query' };
		return wrapped;
	}),
}));

vi.mock('$lib/server/db/index.js', () => ({ getDb: vi.fn() }));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: {
		id: 'u.id',
		name: 'u.name',
		email: 'u.email',
		image: 'u.image',
		updatedAt: 'u.updatedAt',
	},
	account: { userId: 'a.userId', providerId: 'a.providerId' },
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...a: unknown[]) => a),
}));

import { getUserProfile, updateProfile, deleteAccount } from './settings.remote.js';
import { getDb } from '$lib/server/db/index.js';

const mockGetDb = vi.mocked(getDb);

function createMockDb(queryResults: unknown[][]): ReturnType<typeof getDb> {
	let queryIndex = 0;

	const createChain = (): unknown =>
		new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (prop === 'then') {
						const result = queryResults[queryIndex] ?? [];
						queryIndex++;
						return (resolve: (value: unknown) => void) => resolve(result);
					}
					return vi.fn(() => createChain());
				},
			},
		);

	return {
		select: vi.fn(() => createChain()),
		insert: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
		delete: vi.fn(() => createChain()),
	} as unknown as ReturnType<typeof getDb>;
}

const testUser = {
	id: 'user-1',
	name: 'Test User',
	email: 'test@example.com',
	image: 'https://example.com/avatar.jpg',
};
const testAuthContext = { user: testUser };

beforeEach(() => {
	vi.clearAllMocks();
});

describe('getUserProfile', () => {
	it('returns profile with isOAuthUser=false when only credential accounts', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([[{ providerId: 'credential' }, { providerId: 'credential' }]]),
		);

		const result = await (getUserProfile as unknown as Function)(testAuthContext);

		expect(result).toEqual({
			id: testUser.id,
			name: testUser.name,
			email: testUser.email,
			image: testUser.image,
			isOAuthUser: false,
		});
	});

	it('returns profile with isOAuthUser=true when has Google account', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([[{ providerId: 'credential' }, { providerId: 'google' }]]),
		);

		const result = await (getUserProfile as unknown as Function)(testAuthContext);

		expect(result).toEqual({
			id: testUser.id,
			name: testUser.name,
			email: testUser.email,
			image: testUser.image,
			isOAuthUser: true,
		});
	});
});

describe('updateProfile', () => {
	it('updates name and image', async () => {
		const mockDb = createMockDb([[]]);
		mockGetDb.mockReturnValue(mockDb);

		await (updateProfile as unknown as Function)(testAuthContext, {
			name: 'New Name',
			image: 'https://example.com/new-avatar.jpg',
		});

		expect(mockDb.update).toHaveBeenCalledTimes(1);
	});
});

describe('deleteAccount', () => {
	it('hard-deletes the user record', async () => {
		const mockDb = createMockDb([[]]);
		mockGetDb.mockReturnValue(mockDb);

		await (deleteAccount as unknown as Function)(testAuthContext);

		expect(mockDb.delete).toHaveBeenCalledTimes(1);
	});
});
