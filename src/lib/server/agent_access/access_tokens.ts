import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import {
	personalAccessToken,
	personalAccessTokenWishlist,
} from '$lib/server/db/access_token.schema.js';
import { isReservedDemoEmail } from '$lib/server/auth.js';
import { runAfterResponse } from '$lib/server/background.js';
import { toBase64Url } from '$lib/server/crypto/hmac.js';
import { DAY_MS } from '$lib/server/operations/constants.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { listAccessibleWishlists } from '$lib/modules/wishlists/accessible_wishlists.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { AGENT_SCOPE, type AgentScope } from '$lib/modules/access_tokens/scopes.js';
import {
	ACCESS_TOKEN_EXPIRY_KIND,
	ACCESS_TOKEN_MAX_EXPIRY_DAYS,
	type AccessTokenExpiry,
	type AccessTokenSummary,
	type AccessTokenWishlistChoices,
	type CreateAccessTokenInput,
	type CreatedAccessToken,
	type RollAccessTokenInput,
} from '$lib/modules/access_tokens/types.js';
import type { AgentAccessGrant } from './agent_grant.js';
import { ACCESS_TOKEN_LAST_USED_INTERVAL_MS } from './limits.js';

const TOKEN_VALUE_PREFIX = 'pjs_';
const TOKEN_RANDOM_BYTES = 32;
/** Unpadded base64url carries 6 bits per character. */
const TOKEN_RANDOM_CHARACTERS = Math.ceil((TOKEN_RANDOM_BYTES * 8) / 6);
const TOKEN_VALUE_PATTERN = new RegExp(
	`^${TOKEN_VALUE_PREFIX}[A-Za-z0-9_-]{${TOKEN_RANDOM_CHARACTERS}}$`,
);
/** Shown random characters: enough to tell tokens apart, far too few to weaken the rest. */
const TOKEN_DISPLAY_RANDOM_CHARACTERS = 4;

type AccessTokenRow = typeof personalAccessToken.$inferSelect;

/** An authenticated token: its grant for the operation core plus what the API reports about it. */
export interface AuthenticatedAccessToken {
	tokenId: string;
	prefix: string;
	expiresAt: Date;
	fastForward: boolean;
	grant: AgentAccessGrant;
}

async function hashTokenValue(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A fresh token value with what is stored about it: its hash and short display prefix. */
async function issueTokenSecret() {
	const value = `${TOKEN_VALUE_PREFIX}${toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_RANDOM_BYTES)))}`;
	return {
		value,
		tokenHash: await hashTokenValue(value),
		tokenPrefix: value.slice(0, TOKEN_VALUE_PREFIX.length + TOKEN_DISPLAY_RANDOM_CHARACTERS),
	};
}

/** `read` is always granted; scopes are stored once each, in their canonical order. */
function grantedScopes(requestedScopes: readonly AgentScope[]): AgentScope[] {
	const requested = new Set<AgentScope>([AGENT_SCOPE.read, ...requestedScopes]);
	return Object.values(AGENT_SCOPE).filter((scope) => requested.has(scope));
}

function expiryDate(expiry: AccessTokenExpiry, now: Date): Date {
	if (expiry.kind === ACCESS_TOKEN_EXPIRY_KIND.preset) {
		return new Date(now.getTime() + expiry.days * DAY_MS);
	}
	const latestExpiry = now.getTime() + ACCESS_TOKEN_MAX_EXPIRY_DAYS * DAY_MS;
	if (expiry.expiresAt.getTime() <= now.getTime() || expiry.expiresAt.getTime() > latestExpiry) {
		error(400, SERVER_ERROR.AGENT_TOKEN_EXPIRY_OUT_OF_RANGE);
	}
	return expiry.expiresAt;
}

/** A token may be limited only to wishlists its user currently receives, manages or follows. */
async function restrictionWishlistIds(
	userId: string,
	wishlistIds: readonly string[] | null,
): Promise<string[] | null> {
	if (wishlistIds === null) {
		return null;
	}
	const accessibleIds = new Set(
		(await listAccessibleWishlists(userId)).map((accessible) => accessible.id),
	);
	if (!wishlistIds.every((wishlistId) => accessibleIds.has(wishlistId))) {
		error(400, SERVER_ERROR.AGENT_TOKEN_WISHLIST_UNAVAILABLE);
	}
	return [...new Set(wishlistIds)];
}

function summarize(
	row: AccessTokenRow,
	wishlists: AccessTokenSummary['wishlists'],
	now: Date,
): AccessTokenSummary {
	return {
		id: row.id,
		name: row.name,
		prefix: row.tokenPrefix,
		scopes: row.scopes,
		wishlists,
		fastForward: row.fastForward,
		expiresAt: row.expiresAt,
		expired: row.expiresAt.getTime() <= now.getTime(),
		lastUsedAt: row.lastUsedAt,
		createdAt: row.createdAt,
		rolledAt: row.rolledAt,
	};
}

async function summarizeToken(row: AccessTokenRow, now: Date): Promise<AccessTokenSummary> {
	const [token] = await summarizeTokens([row], now);
	if (token === undefined) {
		throw new Error('Summarizing an access token returned nothing');
	}
	return token;
}

export async function createAccessToken(
	userId: string,
	input: CreateAccessTokenInput,
	now = new Date(),
): Promise<CreatedAccessToken> {
	const expiresAt = expiryDate(input.expiry, now);
	const wishlistIds = await restrictionWishlistIds(userId, input.wishlistIds);
	const { value, tokenHash, tokenPrefix } = await issueTokenSecret();
	const row = await getDb().transaction(async (transaction) => {
		const [inserted] = await transaction
			.insert(personalAccessToken)
			.values({
				userId,
				name: input.name,
				tokenPrefix,
				tokenHash,
				scopes: grantedScopes(input.scopes),
				restrictedToWishlists: wishlistIds !== null,
				fastForward: input.fastForward,
				expiresAt,
				createdAt: now,
			})
			.returning();
		if (inserted === undefined) {
			throw new Error('Inserting the access token returned no row');
		}
		if (wishlistIds !== null) {
			await transaction
				.insert(personalAccessTokenWishlist)
				.values(wishlistIds.map((wishlistId) => ({ tokenId: inserted.id, wishlistId })));
		}
		return inserted;
	});
	return { token: await summarizeToken(row, now), value };
}

async function summarizeTokens(
	rows: readonly AccessTokenRow[],
	now: Date,
): Promise<AccessTokenSummary[]> {
	const restrictedTokenIds = rows.filter((row) => row.restrictedToWishlists).map((row) => row.id);
	const restrictionRows =
		restrictedTokenIds.length === 0
			? []
			: await getDb()
					.select({
						tokenId: personalAccessTokenWishlist.tokenId,
						id: wishlist.id,
						title: wishlist.title,
					})
					.from(personalAccessTokenWishlist)
					.innerJoin(wishlist, eq(wishlist.id, personalAccessTokenWishlist.wishlistId))
					.where(
						and(
							inArray(personalAccessTokenWishlist.tokenId, restrictedTokenIds),
							isNull(wishlist.deletedAt),
						),
					)
					.orderBy(wishlist.title);
	return rows.map((row) =>
		summarize(
			row,
			row.restrictedToWishlists
				? restrictionRows
						.filter((restriction) => restriction.tokenId === row.id)
						.map(({ id, title }) => ({ id, title }))
				: null,
			now,
		),
	);
}

const LIST_GROUP = { recentlyUsed: 0, neverUsed: 1, expired: 2 } as const;

function listGroup(token: AccessTokenSummary): number {
	if (token.expired) {
		return LIST_GROUP.expired;
	}
	return token.lastUsedAt === null ? LIST_GROUP.neverUsed : LIST_GROUP.recentlyUsed;
}

function listedTime(token: AccessTokenSummary): number {
	if (token.expired) {
		return token.expiresAt.getTime();
	}
	return (token.lastUsedAt ?? token.rolledAt ?? token.createdAt).getTime();
}

/** Active tokens by last use, newest first, then never-used ones, then expired ones. */
function compareListedAccessTokens(first: AccessTokenSummary, second: AccessTokenSummary): number {
	return listGroup(first) - listGroup(second) || listedTime(second) - listedTime(first);
}

/** The user's tokens that are not revoked, expired ones included and marked. */
export async function listAccessTokens(
	userId: string,
	now = new Date(),
): Promise<AccessTokenSummary[]> {
	const rows = await getDb()
		.select()
		.from(personalAccessToken)
		.where(and(eq(personalAccessToken.userId, userId), isNull(personalAccessToken.revokedAt)));
	return (await summarizeTokens(rows, now)).sort(compareListedAccessTokens);
}

/** Revokes or, once expired, removes the token; only its owner sees it, others get 404. */
export async function revokeAccessToken(
	userId: string,
	tokenId: string,
	now = new Date(),
): Promise<void> {
	const revoked = await getDb()
		.update(personalAccessToken)
		.set({ revokedAt: now })
		.where(
			and(
				eq(personalAccessToken.id, tokenId),
				eq(personalAccessToken.userId, userId),
				isNull(personalAccessToken.revokedAt),
			),
		)
		.returning({ id: personalAccessToken.id });
	if (revoked.length === 0) {
		error(404, SERVER_ERROR.AGENT_TOKEN_NOT_FOUND);
	}
}

/**
 * Regenerates an active or expired token's value, keeping everything else: the old value stops
 * working at once and the new one is returned this once. Without a chosen expiry the token keeps
 * its current lifetime, counted from now. Revoked and other users' tokens get the revoke 404.
 */
export async function rollAccessToken(
	userId: string,
	input: RollAccessTokenInput,
	now = new Date(),
): Promise<CreatedAccessToken> {
	const { value, tokenHash, tokenPrefix } = await issueTokenSecret();
	// Whole seconds, not a calendar interval, so a daylight-saving change cannot shift the lifetime.
	const currentLifetimeFromNow = sql`${now.toISOString()}::timestamptz + make_interval(secs => extract(epoch from (${personalAccessToken.expiresAt} - coalesce(${personalAccessToken.rolledAt}, ${personalAccessToken.createdAt})))::double precision)`;
	const [rolled] = await getDb()
		.update(personalAccessToken)
		.set({
			tokenHash,
			tokenPrefix,
			expiresAt:
				input.expiry === undefined ? currentLifetimeFromNow : expiryDate(input.expiry, now),
			rolledAt: now,
			lastUsedAt: null,
		})
		.where(
			and(
				eq(personalAccessToken.id, input.tokenId),
				eq(personalAccessToken.userId, userId),
				isNull(personalAccessToken.revokedAt),
			),
		)
		.returning();
	if (rolled === undefined) {
		error(404, SERVER_ERROR.AGENT_TOKEN_NOT_FOUND);
	}
	return { token: await summarizeToken(rolled, now), value };
}

export async function listAccessTokenWishlistChoices(
	userId: string,
): Promise<AccessTokenWishlistChoices> {
	const choices: AccessTokenWishlistChoices = { own: [], managed: [], followed: [] };
	const groups = {
		[WISHLIST_ROLES.recipient]: choices.own,
		[WISHLIST_ROLES.moderator]: choices.managed,
		[WISHLIST_ROLES.visitor]: choices.followed,
	};
	for (const accessible of await listAccessibleWishlists(userId)) {
		groups[accessible.role].push({
			id: accessible.id,
			title: accessible.title,
			recipientDisplayName: accessible.recipientDisplayName,
		});
	}
	return choices;
}

function bearerValue(authorization: string | null): string | null {
	const match = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() ?? '');
	return match?.[1] ?? null;
}

/** Records the use off the response path, at most once per interval per token. */
function recordTokenUse(row: Pick<AccessTokenRow, 'tokenHash' | 'lastUsedAt'>, now: Date): void {
	const staleBefore = new Date(now.getTime() - ACCESS_TOKEN_LAST_USED_INTERVAL_MS);
	if (row.lastUsedAt !== null && row.lastUsedAt > staleBefore) {
		return;
	}
	runAfterResponse(async () => {
		await getDb()
			.update(personalAccessToken)
			.set({ lastUsedAt: now })
			.where(
				and(
					// By value hash, so a use of a value rolled away meanwhile never marks the new one used.
					eq(personalAccessToken.tokenHash, row.tokenHash),
					or(
						isNull(personalAccessToken.lastUsedAt),
						lte(personalAccessToken.lastUsedAt, staleBefore),
					),
				),
			);
	});
}

/**
 * Resolves an `Authorization: Bearer` header to its token: 401 with a distinct code for an
 * unknown or malformed, a revoked and an expired token. Only the value's hash is looked up.
 */
export async function authenticateAccessToken(
	authorization: string | null,
	now = new Date(),
): Promise<AuthenticatedAccessToken> {
	const value = bearerValue(authorization);
	if (value === null || !TOKEN_VALUE_PATTERN.test(value)) {
		error(401, SERVER_ERROR.AGENT_TOKEN_INVALID);
	}
	const [found] = await getDb()
		.select({
			token: personalAccessToken,
			userName: user.name,
			userEmail: user.email,
			userDemoSessionId: user.demoSessionId,
		})
		.from(personalAccessToken)
		.innerJoin(user, eq(user.id, personalAccessToken.userId))
		.where(eq(personalAccessToken.tokenHash, await hashTokenValue(value)))
		.limit(1);
	if (found === undefined) {
		error(401, SERVER_ERROR.AGENT_TOKEN_INVALID);
	}
	const { token } = found;
	if (token.revokedAt !== null) {
		error(401, SERVER_ERROR.AGENT_TOKEN_REVOKED);
	}
	if (token.expiresAt.getTime() <= now.getTime()) {
		error(401, SERVER_ERROR.AGENT_TOKEN_EXPIRED);
	}
	if (found.userDemoSessionId !== null || isReservedDemoEmail(found.userEmail)) {
		error(403, SERVER_ERROR.AGENT_DEMO_NOT_ALLOWED);
	}
	const wishlistIds = token.restrictedToWishlists
		? (
				await getDb()
					.select({ wishlistId: personalAccessTokenWishlist.wishlistId })
					.from(personalAccessTokenWishlist)
					.where(eq(personalAccessTokenWishlist.tokenId, token.id))
			).map((restriction) => restriction.wishlistId)
		: null;
	recordTokenUse(token, now);
	return {
		tokenId: token.id,
		prefix: token.tokenPrefix,
		expiresAt: token.expiresAt,
		fastForward: token.fastForward,
		grant: {
			userId: token.userId,
			userName: found.userName,
			tokenName: token.name,
			scopes: token.scopes,
			wishlistIds,
		},
	};
}
