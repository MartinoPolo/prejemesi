import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestEvent, accessTokenService, oauthGrantService } = vi.hoisted(() => ({
	requestEvent: {
		locals: {} as Record<string, unknown>,
		isRemoteRequest: false,
	},
	accessTokenService: {
		createAccessToken: vi.fn(),
		revokeAccessToken: vi.fn(),
		rollAccessToken: vi.fn(),
		listAccessTokens: vi.fn(),
		listAccessTokenWishlistChoices: vi.fn(),
	},
	oauthGrantService: {
		listOauthGrants: vi.fn(),
		revokeOauthGrant: vi.fn(),
	},
}));

vi.mock('$app/server', () => {
	/**
	 * Runs the handler directly, marked as the remote function SvelteKit expects, and keeps the
	 * input schema SvelteKit would validate with.
	 */
	const remoteFunction =
		(type: string) =>
		(...args: unknown[]) => {
			const handler = args.at(-1) as (...handlerArgs: unknown[]) => unknown;
			return Object.assign((...callArgs: unknown[]) => handler(...callArgs), {
				__: { type },
				inputSchema: args.length > 1 ? args[0] : undefined,
			});
		};
	return {
		getRequestEvent: () => requestEvent,
		query: remoteFunction('query'),
		command: remoteFunction('command'),
	};
});

vi.mock('$lib/server/agent_access/access_tokens.js', () => accessTokenService);
vi.mock('$lib/server/agent_access/oauth_grants.js', () => oauthGrantService);

import {
	createAccessToken,
	getAccessTokens,
	getConnectedApps,
	getAccessTokenWishlistChoices,
	revokeAccessToken,
	revokeConnectedApp,
	rollAccessToken,
} from './access_tokens.remote.js';
import {
	CreateAccessTokenInputSchema,
	RevokeAccessTokenInputSchema,
	RevokeConnectedAppInputSchema,
	RollAccessTokenInputSchema,
} from './types.js';

const USER = { id: 'user-1', name: 'Martin', email: 'martin@test.cz' };
const createInput = {
	name: 'Claude',
	scopes: [],
	wishlistIds: null,
	expiryDays: 365,
	fastForward: false,
};
const rollInput = { tokenId: 'token-1', expiryDays: 90 };

type RemoteFunction = (arg?: unknown) => Promise<unknown>;

function call(remoteFunction: unknown, arg?: unknown): Promise<unknown> {
	return Promise.resolve().then(() => (remoteFunction as RemoteFunction)(arg));
}

function signIn() {
	requestEvent.locals = { user: USER, session: { id: 'session-1', userId: USER.id } };
}

function enterDemo() {
	signIn();
	requestEvent.locals.demoSession = { id: 'demo-1', expiresAt: new Date() };
}

describe('access token remote functions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requestEvent.locals = {};
	});

	it('validate create, revoke and roll input with their schemas', () => {
		const inputSchemaOf = (remoteFunction: unknown) =>
			(remoteFunction as { inputSchema: unknown }).inputSchema;

		expect(inputSchemaOf(createAccessToken)).toBe(CreateAccessTokenInputSchema);
		expect(inputSchemaOf(revokeAccessToken)).toBe(RevokeAccessTokenInputSchema);
		expect(inputSchemaOf(rollAccessToken)).toBe(RollAccessTokenInputSchema);
		expect(inputSchemaOf(revokeConnectedApp)).toBe(RevokeConnectedAppInputSchema);
	});

	it('require a signed-in user', async () => {
		for (const [remoteFunction, arg] of [
			[getAccessTokens, undefined],
			[getAccessTokenWishlistChoices, undefined],
			[createAccessToken, createInput],
			[revokeAccessToken, { tokenId: 'token-1' }],
			[rollAccessToken, rollInput],
			[getConnectedApps, undefined],
			[revokeConnectedApp, { grantId: 'grant-1' }],
		] as const) {
			await expect(call(remoteFunction, arg)).rejects.toMatchObject({ status: 401 });
		}
		expect(accessTokenService.createAccessToken).not.toHaveBeenCalled();
		expect(accessTokenService.revokeAccessToken).not.toHaveBeenCalled();
		expect(accessTokenService.rollAccessToken).not.toHaveBeenCalled();
		expect(oauthGrantService.listOauthGrants).not.toHaveBeenCalled();
		expect(oauthGrantService.revokeOauthGrant).not.toHaveBeenCalled();
	});

	it('list and disconnect connected apps as the signed-in user only', async () => {
		signIn();
		oauthGrantService.listOauthGrants.mockResolvedValue([]);

		await call(getConnectedApps);
		await call(revokeConnectedApp, { grantId: 'grant-1' });

		expect(oauthGrantService.listOauthGrants).toHaveBeenCalledWith(USER.id);
		expect(oauthGrantService.revokeOauthGrant).toHaveBeenCalledWith(USER.id, 'grant-1');
	});

	it('reject disconnecting apps in the demo', async () => {
		enterDemo();

		await expect(call(revokeConnectedApp, { grantId: 'grant-1' })).rejects.toMatchObject({
			status: 403,
		});
		expect(oauthGrantService.revokeOauthGrant).not.toHaveBeenCalled();
	});

	it('list and offer wishlists for the signed-in user only', async () => {
		signIn();
		accessTokenService.listAccessTokens.mockResolvedValue([]);
		accessTokenService.listAccessTokenWishlistChoices.mockResolvedValue({
			own: [],
			managed: [],
			followed: [],
		});

		await call(getAccessTokens);
		await call(getAccessTokenWishlistChoices);

		expect(accessTokenService.listAccessTokens).toHaveBeenCalledWith(USER.id);
		expect(accessTokenService.listAccessTokenWishlistChoices).toHaveBeenCalledWith(USER.id);
	});

	it('create a token for the signed-in user and return its value', async () => {
		signIn();
		accessTokenService.createAccessToken.mockResolvedValue({
			token: { id: 'token-1' },
			value: 'pjs_value',
		});

		await expect(call(createAccessToken, createInput)).resolves.toEqual({
			token: { id: 'token-1' },
			value: 'pjs_value',
		});
		expect(accessTokenService.createAccessToken).toHaveBeenCalledWith(USER.id, createInput);
	});

	it('revoke only as the signed-in user', async () => {
		signIn();

		await call(revokeAccessToken, { tokenId: 'token-1' });

		expect(accessTokenService.revokeAccessToken).toHaveBeenCalledWith(USER.id, 'token-1');
	});

	it('roll a token for the signed-in user and return its new value', async () => {
		signIn();
		accessTokenService.rollAccessToken.mockResolvedValue({
			token: { id: 'token-1' },
			value: 'pjs_new_value',
		});

		await expect(call(rollAccessToken, rollInput)).resolves.toEqual({
			token: { id: 'token-1' },
			value: 'pjs_new_value',
		});
		expect(accessTokenService.rollAccessToken).toHaveBeenCalledWith(USER.id, rollInput);
	});

	it('reject creating, revoking and rolling tokens in the demo', async () => {
		enterDemo();

		await expect(call(createAccessToken, createInput)).rejects.toMatchObject({ status: 403 });
		await expect(call(revokeAccessToken, { tokenId: 'token-1' })).rejects.toMatchObject({
			status: 403,
		});
		await expect(call(rollAccessToken, rollInput)).rejects.toMatchObject({ status: 403 });
		expect(accessTokenService.createAccessToken).not.toHaveBeenCalled();
		expect(accessTokenService.revokeAccessToken).not.toHaveBeenCalled();
		expect(accessTokenService.rollAccessToken).not.toHaveBeenCalled();
	});
});
