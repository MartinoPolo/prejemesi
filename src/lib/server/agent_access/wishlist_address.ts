import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { AgentAccessGrant } from './agent_grant.js';
import { AgentApiFailure } from './api.js';

/** A request naming a wishlist by its short id or its id; the caller rejects naming both. */
export interface WishlistAddress {
	wishlistShortId?: string;
	wishlistId?: string;
}

/**
 * The live wishlist the address names, or null when it names none. A restricted token gets 403
 * for an unknown wishlist too, so it cannot probe which ids exist.
 */
export async function resolveAddressedWishlist(
	grant: Pick<AgentAccessGrant, 'wishlistIds'>,
	{ wishlistShortId, wishlistId }: WishlistAddress,
): Promise<{ id: string; shortId: string } | null> {
	if (wishlistShortId === undefined && wishlistId === undefined) {
		return null;
	}
	const [wishlistRow] = await getDb()
		.select({ id: wishlist.id, shortId: wishlist.shortId })
		.from(wishlist)
		.where(
			and(
				wishlistShortId === undefined
					? eq(wishlist.id, wishlistId ?? '')
					: eq(wishlist.shortId, wishlistShortId),
				isNull(wishlist.deletedAt),
				wishlistScope(),
			),
		)
		.limit(1);
	const allowedWishlistIds = grant.wishlistIds;
	if (
		allowedWishlistIds !== null &&
		(wishlistRow === undefined || !allowedWishlistIds.includes(wishlistRow.id))
	) {
		throw new AgentApiFailure(403, SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED);
	}
	if (wishlistRow === undefined) {
		throw new AgentApiFailure(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}
	return wishlistRow;
}
