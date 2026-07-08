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
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
	guardedCommandNoArgs: vi.fn((handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) => {
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
		appBackgroundTheme: 'u.appBackgroundTheme',
		preferredLocale: 'u.preferredLocale',
		updatedAt: 'u.updatedAt',
	},
	account: { userId: 'a.userId', providerId: 'a.providerId' },
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...a: unknown[]) => a),
}));

import {
	getUserProfile,
	updateAppBackgroundTheme,
	updatePreferredLocale,
} from './settings.remote.js';
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
	it('returns DB-sourced name/image (source of truth, not the stale session)', async () => {
		// getUserProfile reads name/image from the user table because the better-auth
		// session is cached and goes stale after a profile update. The DB values (here
		// deliberately different from the session) must win so edits persist on reload.
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ providerId: 'credential' }, { providerId: 'credential' }],
				[
					{
						name: 'Fresh Name',
						image: 'https://example.com/fresh.jpg',
						appBackgroundTheme: 'default',
						preferredLocale: null,
					},
				],
			]),
		);

		const result = await (getUserProfile as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		);

		expect(result).toEqual({
			id: testUser.id,
			name: 'Fresh Name',
			email: testUser.email,
			image: 'https://example.com/fresh.jpg',
			isOAuthUser: false,
			appBackgroundTheme: 'default',
			preferredLocale: null,
		});
	});

	it('returns profile with isOAuthUser=true when has Google account', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ providerId: 'credential' }, { providerId: 'google' }],
				[
					{
						name: testUser.name,
						image: testUser.image,
						appBackgroundTheme: 'twilight',
						preferredLocale: null,
					},
				],
			]),
		);

		const result = await (getUserProfile as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		);

		expect(result).toEqual({
			id: testUser.id,
			name: testUser.name,
			email: testUser.email,
			image: testUser.image,
			isOAuthUser: true,
			appBackgroundTheme: 'twilight',
			preferredLocale: null,
		});
	});

	it('falls back to the default background theme when no user row is returned', async () => {
		mockGetDb.mockReturnValue(createMockDb([[{ providerId: 'credential' }], []]));

		const result = (await (getUserProfile as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		)) as { appBackgroundTheme: string };

		expect(result.appBackgroundTheme).toBe('default');
	});
});

describe('updateAppBackgroundTheme', () => {
	it('persists the chosen background theme', async () => {
		const mockDb = createMockDb([[]]);
		mockGetDb.mockReturnValue(mockDb);

		await (updateAppBackgroundTheme as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
			{ appBackgroundTheme: 'golden-hour' },
		);

		expect(mockDb.update).toHaveBeenCalledTimes(1);
	});
});

describe('updatePreferredLocale', () => {
	it('persists the chosen locale', async () => {
		const mockDb = createMockDb([[]]);
		mockGetDb.mockReturnValue(mockDb);

		await (updatePreferredLocale as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
			{
				preferredLocale: 'en',
			},
		);

		expect(mockDb.update).toHaveBeenCalledTimes(1);
	});
});
