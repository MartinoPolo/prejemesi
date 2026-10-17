import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_ID,
	SECOND_RESERVER_ID,
	createWishlistFixture,
	expectRejection,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { personalAccessToken } from '$lib/server/db/access_token.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { runAfterResponse } from '$lib/server/background.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CreateAccessTokenInputSchema,
	type AccessTokenSummary,
} from '$lib/modules/access_tokens/types.js';
import {
	authenticateAccessToken,
	createAccessToken,
	listAccessTokens,
	listAccessTokenWishlistChoices,
	revokeAccessToken,
	rollAccessToken,
} from './access_tokens.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function createTokenFor(
	userId: string,
	input: Record<string, unknown> = {},
	now: Date = new Date(),
) {
	return createAccessToken(
		userId,
		v.parse(CreateAccessTokenInputSchema, {
			name: 'Claude',
			scopes: [],
			wishlistIds: null,
			...input,
		}),
		now,
	);
}

async function storedToken(tokenId: string) {
	const [row] = await getDb()
		.select()
		.from(personalAccessToken)
		.where(eq(personalAccessToken.id, tokenId));
	if (row === undefined) {
		throw new Error(`Missing token ${tokenId}`);
	}
	return row;
}

/** Runs the after-response work scheduled since the given count, as the platform would. */
async function runScheduledWork(scheduledBefore: number): Promise<void> {
	const tasks = vi.mocked(runAfterResponse).mock.calls.slice(scheduledBefore);
	for (const [task] of tasks) {
		await task();
	}
}

function scheduledCount(): number {
	return vi.mocked(runAfterResponse).mock.calls.length;
}

function namesOf(tokens: readonly AccessTokenSummary[]): string[] {
	return tokens.map((token) => token.name);
}

describe.skipIf(!DB_READY)('personal access tokens', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	describe('creation', () => {
		it('shows the value once, starting pjs_, and stores only its SHA-256 hash', async () => {
			const { token, value } = await createTokenFor(MANAGER_ID);

			expect(value).toMatch(/^pjs_[A-Za-z0-9_-]{43}$/);
			expect(token.prefix.startsWith('pjs_')).toBe(true);
			expect(value.startsWith(token.prefix)).toBe(true);
			expect(token.prefix.length).toBeLessThan(12);
			const stored = await storedToken(token.id);
			expect(stored.tokenHash).toBe(createHash('sha256').update(value).digest('hex'));
			expect(JSON.stringify(stored)).not.toContain(value);
			expect(JSON.stringify(await listAccessTokens(MANAGER_ID))).not.toContain(value);
		});

		it('always grants read, alongside the chosen scopes', async () => {
			const readOnly = await createTokenFor(MANAGER_ID, { scopes: [] });
			const writer = await createTokenFor(MANAGER_ID, {
				scopes: ['reservations:identities', 'gifts:write'],
			});

			expect(readOnly.token.scopes).toEqual(['read']);
			expect([...writer.token.scopes].sort()).toEqual(
				['gifts:write', 'read', 'reservations:identities'].sort(),
			);
		});

		it('expires after the chosen preset, 365 days by default', async () => {
			const now = new Date('2026-10-14T12:00:00Z');
			const byDefault = await createTokenFor(MANAGER_ID, {}, now);
			expect(byDefault.token.expiresAt.getTime()).toBe(now.getTime() + 365 * DAY_MS);
			for (const days of [30, 90, 1825, 3650]) {
				const preset = await createTokenFor(MANAGER_ID, { expiryDays: days }, now);
				expect(preset.token.expiresAt.getTime(), String(days)).toBe(
					now.getTime() + days * DAY_MS,
				);
			}
		});

		it('reports the preset it was created with, in the list too', async () => {
			const now = new Date('2026-10-14T12:00:00Z');
			const byDefault = await createTokenFor(MANAGER_ID, { name: 'Default' }, now);
			const shortLived = await createTokenFor(
				MANAGER_ID,
				{ name: 'Short', expiryDays: 30 },
				now,
			);

			expect(byDefault.token.expiryPresetDays).toBe(365);
			expect(shortLived.token.expiryPresetDays).toBe(30);
			const listed = await listAccessTokens(MANAGER_ID, now);
			expect(listed.find((token) => token.id === shortLived.token.id)?.expiryPresetDays).toBe(
				30,
			);
		});

		it('keeps fast-forward off unless chosen', async () => {
			expect((await createTokenFor(MANAGER_ID)).token.fastForward).toBe(false);
			expect(
				(await createTokenFor(MANAGER_ID, { fastForward: true })).token.fastForward,
			).toBe(true);
		});
	});

	describe('wishlist restriction', () => {
		it('limits a token only to wishlists its user receives, manages or follows', async () => {
			const fixture = await createWishlistFixture({ sharedAt: new Date() });
			await getDb()
				.insert(wishlistFollower)
				.values({ wishlistId: fixture.id, userId: RESERVER_ID });

			for (const userId of [RECIPIENT_ID, MANAGER_ID, RESERVER_ID]) {
				const { token } = await createTokenFor(userId, { wishlistIds: [fixture.id] });
				expect(token.wishlists, userId).toEqual([
					{ id: fixture.id, title: 'Operation core wishlist' },
				]);
			}
			await expectRejection(
				createTokenFor(SECOND_RESERVER_ID, { wishlistIds: [fixture.id] }),
				400,
				SERVER_ERROR.AGENT_TOKEN_WISHLIST_UNAVAILABLE,
			);
		});

		it('offers the user’s wishlists grouped as own, managed and followed', async () => {
			const fixture = await createWishlistFixture({ sharedAt: new Date() });
			await getDb()
				.insert(wishlistFollower)
				.values({ wishlistId: fixture.id, userId: SECOND_RESERVER_ID });
			const choice = expect.objectContaining({ id: fixture.id });

			expect((await listAccessTokenWishlistChoices(RECIPIENT_ID)).own).toContainEqual(choice);
			expect((await listAccessTokenWishlistChoices(MANAGER_ID)).managed).toContainEqual(
				choice,
			);
			expect(
				(await listAccessTokenWishlistChoices(SECOND_RESERVER_ID)).followed,
			).toContainEqual(choice);
		});

		it('stays restricted, to nothing, once its every wishlist is deleted', async () => {
			const fixture = await createWishlistFixture();
			const { token, value } = await createTokenFor(MANAGER_ID, {
				wishlistIds: [fixture.id],
			});
			await getDb().delete(wishlist).where(eq(wishlist.id, fixture.id));

			const authenticated = await authenticateAccessToken(`Bearer ${value}`);
			expect(authenticated.grant.wishlistIds).toEqual([]);
			const [listed] = (await listAccessTokens(MANAGER_ID)).filter(
				(candidate) => candidate.id === token.id,
			);
			expect(listed?.wishlists).toEqual([]);
		});
	});

	describe('listing and revocation', () => {
		it('lists active tokens by last use, then never-used, then expired; revoked ones disappear', async () => {
			const userId = SECOND_RESERVER_ID;
			const now = new Date();
			const longAgo = new Date(now.getTime() - 100 * DAY_MS);
			const expired = await createTokenFor(
				userId,
				{ name: 'Expired', expiryDays: 30 },
				longAgo,
			);
			const neverUsed = await createTokenFor(userId, { name: 'Never used' });
			const usedEarlier = await createTokenFor(userId, { name: 'Used earlier' });
			const usedLater = await createTokenFor(userId, { name: 'Used later' });
			const revoked = await createTokenFor(userId, { name: 'Revoked' });
			for (const [created, lastUsedAt] of [
				[usedEarlier, new Date(now.getTime() - DAY_MS)],
				[usedLater, new Date(now.getTime() - 60 * 1000)],
			] as const) {
				await getDb()
					.update(personalAccessToken)
					.set({ lastUsedAt })
					.where(eq(personalAccessToken.id, created.token.id));
			}
			await revokeAccessToken(userId, revoked.token.id);

			const listed = await listAccessTokens(userId);
			const ours = listed.filter((token) =>
				[expired, neverUsed, usedEarlier, usedLater, revoked].some(
					(created) => created.token.id === token.id,
				),
			);
			expect(namesOf(ours)).toEqual(['Used later', 'Used earlier', 'Never used', 'Expired']);
			expect(ours.map((token) => token.expired)).toEqual([false, false, false, true]);
		});

		it('lets only the owner revoke a token; others get 404', async () => {
			const { token } = await createTokenFor(MANAGER_ID);

			await expectRejection(
				revokeAccessToken(RECIPIENT_ID, token.id),
				404,
				SERVER_ERROR.AGENT_TOKEN_NOT_FOUND,
			);
			expect((await storedToken(token.id)).revokedAt).toBeNull();
			await revokeAccessToken(MANAGER_ID, token.id);
			expect((await listAccessTokens(MANAGER_ID)).map((listed) => listed.id)).not.toContain(
				token.id,
			);
			await expectRejection(
				revokeAccessToken(MANAGER_ID, token.id),
				404,
				SERVER_ERROR.AGENT_TOKEN_NOT_FOUND,
			);
		});

		it('removes an expired token from the list with the same call', async () => {
			const longAgo = new Date(Date.now() - 100 * DAY_MS);
			const { token } = await createTokenFor(
				MANAGER_ID,
				{ name: 'Old', expiryDays: 30 },
				longAgo,
			);
			const listedBefore = await listAccessTokens(MANAGER_ID);
			expect(listedBefore.find((listed) => listed.id === token.id)).toMatchObject({
				expired: true,
			});

			await revokeAccessToken(MANAGER_ID, token.id);

			const listedIds = (await listAccessTokens(MANAGER_ID)).map((listed) => listed.id);
			expect(listedIds).not.toContain(token.id);
		});
	});

	describe('rolling', () => {
		it('issues a new secret once, keeping the token, and invalidates the old one', async () => {
			const fixture = await createWishlistFixture();
			const created = await createTokenFor(MANAGER_ID, {
				name: 'Agent',
				scopes: ['gifts:write'],
				wishlistIds: [fixture.id],
				fastForward: true,
			});

			const rolled = await rollAccessToken(MANAGER_ID, { tokenId: created.token.id });

			expect(rolled.value).toMatch(/^pjs_[A-Za-z0-9_-]{43}$/);
			expect(rolled.value).not.toBe(created.value);
			expect(rolled.value.startsWith(rolled.token.prefix)).toBe(true);
			expect(rolled.token).toMatchObject({
				id: created.token.id,
				name: 'Agent',
				scopes: ['read', 'gifts:write'],
				wishlists: [{ id: fixture.id, title: 'Operation core wishlist' }],
				fastForward: true,
			});
			const stored = await storedToken(created.token.id);
			expect(stored.tokenHash).toBe(createHash('sha256').update(rolled.value).digest('hex'));
			expect(JSON.stringify(stored)).not.toContain(rolled.value);
			await expectRejection(
				authenticateAccessToken(`Bearer ${created.value}`),
				401,
				SERVER_ERROR.AGENT_TOKEN_INVALID,
			);
			const authenticated = await authenticateAccessToken(`Bearer ${rolled.value}`);
			expect(authenticated.grant.wishlistIds).toEqual([fixture.id]);
		});

		it('renews for the token’s current lifetime from now unless another expiry is chosen', async () => {
			const createdAt = new Date('2026-01-01T00:00:00Z');
			const { token } = await createTokenFor(MANAGER_ID, { expiryDays: 90 }, createdAt);

			const firstRoll = new Date('2026-02-01T00:00:00Z');
			const keptLifetime = await rollAccessToken(
				MANAGER_ID,
				{ tokenId: token.id },
				firstRoll,
			);
			expect(keptLifetime.token.expiresAt.getTime()).toBe(firstRoll.getTime() + 90 * DAY_MS);
			expect(keptLifetime.token.expiryPresetDays).toBe(90);

			const secondRoll = new Date('2026-03-01T00:00:00Z');
			const chosenPreset = await rollAccessToken(
				MANAGER_ID,
				{ tokenId: token.id, expiryDays: 1825 },
				secondRoll,
			);
			expect(chosenPreset.token.expiresAt.getTime()).toBe(
				secondRoll.getTime() + 1825 * DAY_MS,
			);
			expect(chosenPreset.token.expiryPresetDays).toBe(1825);

			const thirdRoll = new Date('2026-04-01T00:00:00Z');
			const keptNewLifetime = await rollAccessToken(
				MANAGER_ID,
				{ tokenId: token.id },
				thirdRoll,
			);
			expect(keptNewLifetime.token.expiresAt.getTime()).toBe(
				thirdRoll.getTime() + 1825 * DAY_MS,
			);
			expect(keptNewLifetime.token.expiryPresetDays).toBe(1825);
		});

		it('revives an expired token, unused under its new secret', async () => {
			const longAgo = new Date(Date.now() - 100 * DAY_MS);
			const { token } = await createTokenFor(MANAGER_ID, { expiryDays: 30 }, longAgo);
			await getDb()
				.update(personalAccessToken)
				.set({ lastUsedAt: new Date(longAgo.getTime() + DAY_MS) })
				.where(eq(personalAccessToken.id, token.id));
			const now = new Date();

			const rolled = await rollAccessToken(MANAGER_ID, { tokenId: token.id }, now);

			expect(rolled.token).toMatchObject({ expired: false, lastUsedAt: null, rolledAt: now });
			expect(rolled.token.expiresAt.getTime()).toBe(now.getTime() + 30 * DAY_MS);
			const authenticated = await authenticateAccessToken(`Bearer ${rolled.value}`);
			expect(authenticated.tokenId).toBe(token.id);
		});

		it('never counts a use of the old value as a use of the new one', async () => {
			const { token, value } = await createTokenFor(MANAGER_ID);
			const scheduled = scheduledCount();
			await authenticateAccessToken(`Bearer ${value}`);

			await rollAccessToken(MANAGER_ID, { tokenId: token.id });
			await runScheduledWork(scheduled);

			expect((await storedToken(token.id)).lastUsedAt).toBeNull();
		});

		it('answers a revoked, unknown or another user’s token with the same 404 as revoke', async () => {
			const revoked = await createTokenFor(MANAGER_ID);
			await revokeAccessToken(MANAGER_ID, revoked.token.id);
			const someoneElses = await createTokenFor(MANAGER_ID);

			for (const [userId, tokenId] of [
				[MANAGER_ID, revoked.token.id],
				[MANAGER_ID, 'no-such-token'],
				[RECIPIENT_ID, someoneElses.token.id],
			] as const) {
				await expectRejection(
					rollAccessToken(userId, { tokenId }),
					404,
					SERVER_ERROR.AGENT_TOKEN_NOT_FOUND,
				);
			}
			await expectRejection(
				authenticateAccessToken(`Bearer ${revoked.value}`),
				401,
				SERVER_ERROR.AGENT_TOKEN_REVOKED,
			);
			const stillValid = await authenticateAccessToken(`Bearer ${someoneElses.value}`);
			expect(stillValid.tokenId).toBe(someoneElses.token.id);
		});
	});

	describe('authentication', () => {
		it('records the last use at most once a minute, after the response', async () => {
			const { token, value } = await createTokenFor(MANAGER_ID);
			const firstUse = new Date();

			let scheduled = scheduledCount();
			await authenticateAccessToken(`Bearer ${value}`, firstUse);
			expect((await storedToken(token.id)).lastUsedAt).toBeNull();
			await runScheduledWork(scheduled);
			expect((await storedToken(token.id)).lastUsedAt).toEqual(firstUse);

			scheduled = scheduledCount();
			await authenticateAccessToken(`Bearer ${value}`, new Date(firstUse.getTime() + 30_000));
			await runScheduledWork(scheduled);
			expect((await storedToken(token.id)).lastUsedAt).toEqual(firstUse);

			const laterUse = new Date(firstUse.getTime() + 61_000);
			scheduled = scheduledCount();
			await authenticateAccessToken(`Bearer ${value}`, laterUse);
			await runScheduledWork(scheduled);
			expect((await storedToken(token.id)).lastUsedAt).toEqual(laterUse);
		});

		it('acts as the token user with its scopes, restriction and fast-forward flag', async () => {
			const fixture = await createWishlistFixture();
			const { token, value } = await createTokenFor(MANAGER_ID, {
				name: 'Agent',
				scopes: ['gifts:write'],
				wishlistIds: [fixture.id],
				fastForward: true,
			});

			const authenticated = await authenticateAccessToken(`bearer ${value}`);

			expect(authenticated).toMatchObject({
				tokenId: token.id,
				fastForward: true,
				grant: {
					userId: MANAGER_ID,
					userName: 'Manager',
					tokenName: 'Agent',
					scopes: ['read', 'gifts:write'],
					wishlistIds: [fixture.id],
				},
			});
		});
	});
});
