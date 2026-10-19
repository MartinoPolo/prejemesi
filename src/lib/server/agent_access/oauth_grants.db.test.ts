import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_ID,
	createWishlistFixture,
	expectRejection,
	fixtureId,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { oauthAccessToken, oauthConsent, oauthRefreshToken } from '$lib/server/db/auth.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { listOauthGrants, revokeOauthGrant, saveOauthGrant } from './oauth_grants.js';
import { createOauthClientFixture, removeOauthClientFixtures } from './oauth.db.test-setup.js';

const HOUR_MS = 60 * 60 * 1000;

/** What BetterAuth keeps for a user's authorization of a client. */
async function insertClientAuthorization(userId: string, clientId: string) {
	const now = new Date();
	const values = { clientId, userId, scopes: ['read'], createdAt: now };
	await getDb()
		.insert(oauthConsent)
		.values({ ...values, id: fixtureId('consent'), updatedAt: now });
	const refreshId = fixtureId('refresh');
	await getDb()
		.insert(oauthRefreshToken)
		.values({
			...values,
			id: refreshId,
			token: fixtureId('refresh-hash'),
			expiresAt: new Date(now.getTime() + HOUR_MS),
		});
	await getDb()
		.insert(oauthAccessToken)
		.values({
			...values,
			id: fixtureId('access'),
			token: fixtureId('access-hash'),
			refreshId,
			expiresAt: new Date(now.getTime() + HOUR_MS),
		});
}

async function clientAuthorizationRowCounts(userId: string, clientId: string) {
	const [consents, refreshTokens, accessTokens] = await Promise.all([
		getDb()
			.select({ id: oauthConsent.id })
			.from(oauthConsent)
			.where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId))),
		getDb()
			.select({ id: oauthRefreshToken.id })
			.from(oauthRefreshToken)
			.where(
				and(eq(oauthRefreshToken.userId, userId), eq(oauthRefreshToken.clientId, clientId)),
			),
		getDb()
			.select({ id: oauthAccessToken.id })
			.from(oauthAccessToken)
			.where(
				and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, clientId)),
			),
	]);
	return {
		consents: consents.length,
		refreshTokens: refreshTokens.length,
		accessTokens: accessTokens.length,
	};
}

describe.skipIf(!DB_READY)('OAuth grants', () => {
	beforeAll(seedFixtureUsers);

	afterAll(async () => {
		if (DB_READY) {
			await removeOauthClientFixtures();
		}
		await removeFixtureRows();
	});

	it('lists a saved grant to its user only, in the personal access token shape', async () => {
		const clientId = await createOauthClientFixture({ name: 'Claude' });

		const { grantId, created } = await saveOauthGrant(MANAGER_ID, clientId, {
			scopes: ['reservations:write', 'gifts:write'],
			wishlistIds: null,
		});

		expect(created).toBe(true);
		expect(await listOauthGrants(MANAGER_ID)).toEqual([
			expect.objectContaining({
				id: grantId,
				name: 'Claude',
				scopes: ['read', 'gifts:write', 'reservations:write'],
				wishlists: null,
				lastUsedAt: null,
			}),
		]);
		expect(await listOauthGrants(RESERVER_ID)).toEqual([]);
	});

	it('replaces the active grant’s scopes and wishlist restriction on a new consent', async () => {
		const fixture = await createWishlistFixture();
		const clientId = await createOauthClientFixture();
		const first = await saveOauthGrant(RECIPIENT_ID, clientId, {
			scopes: ['gifts:write'],
			wishlistIds: null,
		});

		const second = await saveOauthGrant(RECIPIENT_ID, clientId, {
			scopes: [],
			wishlistIds: [fixture.id],
		});

		expect(second).toEqual({ grantId: first.grantId, created: false });
		expect(await listOauthGrants(RECIPIENT_ID)).toEqual([
			expect.objectContaining({
				id: first.grantId,
				scopes: ['read'],
				wishlists: [{ id: fixture.id, title: 'Operation core wishlist' }],
			}),
		]);
	});

	it('limits a grant only to wishlists its user can reach, like a personal access token', async () => {
		const fixture = await createWishlistFixture();
		const clientId = await createOauthClientFixture();

		await expectRejection(
			saveOauthGrant(RESERVER_ID, clientId, { scopes: [], wishlistIds: [fixture.id] }),
			400,
			SERVER_ERROR.AGENT_TOKEN_WISHLIST_UNAVAILABLE,
		);
		expect(await listOauthGrants(RESERVER_ID)).toEqual([]);
	});

	it('revokes only the user’s own grant, with that user’s authorization of the client', async () => {
		const clientId = await createOauthClientFixture();
		const { grantId } = await saveOauthGrant(MANAGER_ID, clientId, {
			scopes: [],
			wishlistIds: null,
		});
		await saveOauthGrant(RESERVER_ID, clientId, { scopes: [], wishlistIds: null });
		await insertClientAuthorization(MANAGER_ID, clientId);
		await insertClientAuthorization(RESERVER_ID, clientId);

		await expectRejection(
			revokeOauthGrant(RESERVER_ID, grantId),
			404,
			SERVER_ERROR.AGENT_OAUTH_GRANT_NOT_FOUND,
		);
		expect((await listOauthGrants(MANAGER_ID)).map((grant) => grant.id)).toContain(grantId);

		await revokeOauthGrant(MANAGER_ID, grantId);

		expect((await listOauthGrants(MANAGER_ID)).map((grant) => grant.id)).not.toContain(grantId);
		expect(await clientAuthorizationRowCounts(MANAGER_ID, clientId)).toEqual({
			consents: 0,
			refreshTokens: 0,
			accessTokens: 0,
		});
		expect(await clientAuthorizationRowCounts(RESERVER_ID, clientId)).toEqual({
			consents: 1,
			refreshTokens: 1,
			accessTokens: 1,
		});
		expect(await listOauthGrants(RESERVER_ID)).toHaveLength(1);
		await expectRejection(
			revokeOauthGrant(MANAGER_ID, grantId),
			404,
			SERVER_ERROR.AGENT_OAUTH_GRANT_NOT_FOUND,
		);
	});

	it('creates a new grant when the user connects the app again after revoking it', async () => {
		const clientId = await createOauthClientFixture();
		const first = await saveOauthGrant(MANAGER_ID, clientId, { scopes: [], wishlistIds: null });
		await revokeOauthGrant(MANAGER_ID, first.grantId);

		const again = await saveOauthGrant(MANAGER_ID, clientId, {
			scopes: [],
			wishlistIds: null,
		});

		expect(again.created).toBe(true);
		expect(again.grantId).not.toBe(first.grantId);
	});
});
