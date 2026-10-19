import { and, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import {
	oauthAccessToken,
	oauthClient,
	oauthConsent,
	oauthRefreshToken,
} from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import {
	agentAccessOauthGrant,
	agentAccessOauthGrantWishlist,
} from '$lib/server/db/access_token.schema.js';
import { runAfterResponse } from '$lib/server/background.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { AgentScope } from '$lib/modules/access_tokens/scopes.js';
import type { ConnectedAppSummary } from '$lib/modules/access_tokens/types.js';
import { grantedScopes, restrictionWishlistIds } from './access_tokens.js';
import { ACCESS_TOKEN_LAST_USED_INTERVAL_MS } from './limits.js';
import type { LookupDatabase } from './policy_lookups.js';

/** The `clientDiscoveryId` the CIMD plugin stores on clients it registered from a metadata URL. */
const CIMD_CLIENT_DISCOVERY_ID = 'cimd';

type OauthGrantRow = typeof agentAccessOauthGrant.$inferSelect;

/** How an OAuth client is shown to its user, from the columns every surface selects. */
export function oauthClientDisplay(client: {
	clientId: string;
	name: string | null;
	clientDiscoveryId: string | null;
}): { name: string; verifiedHost: string | null } {
	// A CIMD client's id is the HTTPS URL its metadata was fetched from, which proves the host.
	const verifiedHost =
		client.clientDiscoveryId === CIMD_CLIENT_DISCOVERY_ID
			? (URL.parse(client.clientId)?.host ?? null)
			: null;
	const declaredName = client.name?.trim() ?? '';
	return {
		name: declaredName !== '' ? declaredName : (verifiedHost ?? client.clientId),
		verifiedHost,
	};
}

export const OAUTH_CLIENT_DISPLAY_COLUMNS = {
	clientId: oauthClient.clientId,
	name: oauthClient.name,
	clientDiscoveryId: oauthClient.clientDiscoveryId,
};

/**
 * Records what the user consents to let the client do, in the personal access token shape:
 * replaces the active grant's scopes and restriction, or creates the grant. `created` tells a
 * caller whose consent then fails which grant it may delete again.
 */
export async function saveOauthGrant(
	userId: string,
	clientId: string,
	input: { scopes: readonly AgentScope[]; wishlistIds: readonly string[] | null },
	now = new Date(),
): Promise<{ grantId: string; created: boolean }> {
	const wishlistIds = await restrictionWishlistIds(userId, input.wishlistIds);
	const values = {
		scopes: grantedScopes(input.scopes),
		restrictedToWishlists: wishlistIds !== null,
	};
	return getDb().transaction(async (transaction) => {
		const [saved] = await transaction
			.insert(agentAccessOauthGrant)
			.values({ userId, clientId, ...values, createdAt: now })
			.onConflictDoUpdate({
				target: [agentAccessOauthGrant.userId, agentAccessOauthGrant.clientId],
				targetWhere: isNull(agentAccessOauthGrant.revokedAt),
				set: values,
			})
			.returning({
				id: agentAccessOauthGrant.id,
				createdAt: agentAccessOauthGrant.createdAt,
			});
		if (saved === undefined) {
			throw new Error('Saving the OAuth grant returned no row');
		}
		await transaction
			.delete(agentAccessOauthGrantWishlist)
			.where(eq(agentAccessOauthGrantWishlist.grantId, saved.id));
		if (wishlistIds !== null) {
			await transaction
				.insert(agentAccessOauthGrantWishlist)
				.values(wishlistIds.map((wishlistId) => ({ grantId: saved.id, wishlistId })));
		}
		return { grantId: saved.id, created: saved.createdAt.getTime() === now.getTime() };
	});
}

/** Removes a grant `saveOauthGrant` just created for a consent that then failed. */
export async function deleteOauthGrant(grantId: string): Promise<void> {
	await getDb().delete(agentAccessOauthGrant).where(eq(agentAccessOauthGrant.id, grantId));
}

/**
 * Deletes what BetterAuth keeps for the user and client: the consent, so the next authorization
 * asks again, and the access and refresh tokens, so no refresh outlives the grant.
 */
export async function deleteClientAuthorization(
	database: LookupDatabase,
	userId: string,
	clientId: string,
): Promise<void> {
	await database
		.delete(oauthAccessToken)
		.where(and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, clientId)));
	await database
		.delete(oauthRefreshToken)
		.where(and(eq(oauthRefreshToken.userId, userId), eq(oauthRefreshToken.clientId, clientId)));
	await database
		.delete(oauthConsent)
		.where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)));
}

/**
 * Revokes the user's grant and the client's authorization with it. The grant is read on every
 * MCP call, so the client's still-valid access tokens stop at once. Others' grants get 404.
 */
export async function revokeOauthGrant(
	userId: string,
	grantId: string,
	now = new Date(),
): Promise<void> {
	await getDb().transaction(async (transaction) => {
		const [revoked] = await transaction
			.update(agentAccessOauthGrant)
			.set({ revokedAt: now })
			.where(
				and(
					eq(agentAccessOauthGrant.id, grantId),
					eq(agentAccessOauthGrant.userId, userId),
					isNull(agentAccessOauthGrant.revokedAt),
				),
			)
			.returning({ clientId: agentAccessOauthGrant.clientId });
		if (revoked === undefined) {
			error(404, SERVER_ERROR.AGENT_OAUTH_GRANT_NOT_FOUND);
		}
		await deleteClientAuthorization(transaction, userId, revoked.clientId);
	});
}

async function grantWishlists(
	grantIds: readonly string[],
): Promise<Map<string, { id: string; title: string }[]>> {
	const rows =
		grantIds.length === 0
			? []
			: await getDb()
					.select({
						grantId: agentAccessOauthGrantWishlist.grantId,
						id: wishlist.id,
						title: wishlist.title,
					})
					.from(agentAccessOauthGrantWishlist)
					.innerJoin(wishlist, eq(wishlist.id, agentAccessOauthGrantWishlist.wishlistId))
					.where(
						and(
							inArray(agentAccessOauthGrantWishlist.grantId, [...grantIds]),
							isNull(wishlist.deletedAt),
						),
					)
					.orderBy(wishlist.title);
	const byGrant = new Map<string, { id: string; title: string }[]>();
	for (const { grantId, id, title } of rows) {
		byGrant.set(grantId, [...(byGrant.get(grantId) ?? []), { id, title }]);
	}
	return byGrant;
}

/** The user's active grants, most recently used first, then never-used ones by creation. */
export async function listOauthGrants(userId: string): Promise<ConnectedAppSummary[]> {
	const rows = await getDb()
		.select({ grant: agentAccessOauthGrant, client: OAUTH_CLIENT_DISPLAY_COLUMNS })
		.from(agentAccessOauthGrant)
		.innerJoin(oauthClient, eq(oauthClient.clientId, agentAccessOauthGrant.clientId))
		.where(
			and(eq(agentAccessOauthGrant.userId, userId), isNull(agentAccessOauthGrant.revokedAt)),
		)
		.orderBy(
			sql`${agentAccessOauthGrant.lastUsedAt} desc nulls last`,
			desc(agentAccessOauthGrant.createdAt),
		);
	const wishlists = await grantWishlists(
		rows.filter((row) => row.grant.restrictedToWishlists).map((row) => row.grant.id),
	);
	return rows.map(({ grant, client }) => ({
		id: grant.id,
		...oauthClientDisplay(client),
		scopes: grant.scopes,
		wishlists: grant.restrictedToWishlists ? (wishlists.get(grant.id) ?? []) : null,
		lastUsedAt: grant.lastUsedAt,
		createdAt: grant.createdAt,
	}));
}

/** The user's active grant for the client with its restriction, as a consent page pre-fills it. */
export async function findActiveOauthGrant(
	userId: string,
	clientId: string,
): Promise<{ row: OauthGrantRow; wishlistIds: string[] | null } | null> {
	const [row] = await getDb()
		.select()
		.from(agentAccessOauthGrant)
		.where(
			and(
				eq(agentAccessOauthGrant.userId, userId),
				eq(agentAccessOauthGrant.clientId, clientId),
				isNull(agentAccessOauthGrant.revokedAt),
			),
		)
		.limit(1);
	return row === undefined ? null : { row, wishlistIds: await oauthGrantWishlistIds(row) };
}

/** The wishlists a restricted grant is limited to; null for an unrestricted grant. */
export async function oauthGrantWishlistIds(
	grant: Pick<OauthGrantRow, 'id' | 'restrictedToWishlists'>,
): Promise<string[] | null> {
	if (!grant.restrictedToWishlists) {
		return null;
	}
	const rows = await getDb()
		.select({ wishlistId: agentAccessOauthGrantWishlist.wishlistId })
		.from(agentAccessOauthGrantWishlist)
		.where(eq(agentAccessOauthGrantWishlist.grantId, grant.id));
	return rows.map((restriction) => restriction.wishlistId);
}

/** Records the use off the response path, at most once per interval per grant. */
export function recordOauthGrantUse(
	grant: Pick<OauthGrantRow, 'id' | 'lastUsedAt'>,
	now: Date,
): void {
	const staleBefore = new Date(now.getTime() - ACCESS_TOKEN_LAST_USED_INTERVAL_MS);
	if (grant.lastUsedAt !== null && grant.lastUsedAt > staleBefore) {
		return;
	}
	runAfterResponse(async () => {
		await getDb()
			.update(agentAccessOauthGrant)
			.set({ lastUsedAt: now })
			.where(
				and(
					eq(agentAccessOauthGrant.id, grant.id),
					or(
						isNull(agentAccessOauthGrant.lastUsedAt),
						lte(agentAccessOauthGrant.lastUsedAt, staleBefore),
					),
				),
			);
	});
}
