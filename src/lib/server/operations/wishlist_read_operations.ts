import * as v from 'valibot';
import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { WISHLIST_NOT_FOUND_MESSAGE } from '$lib/modules/errors/server_error_codes.js';
import { resolveUserImageUrl } from '$lib/modules/images/public_url.js';
import { resolveWishlistRole } from '$lib/modules/wishlists/wishlist_access.js';
import { resolveReservationReleaseCapability } from '$lib/modules/wishlists/wishlist_capabilities.js';
import { recipientDisplayNameSql } from '$lib/modules/wishlists/wishlist_role_query_primitives.js';
import { OPERATION_EXPOSURE, OPERATION_KIND, defineOperation } from './operation.js';
import { resolveRevertAccess } from './wishlist_revert.js';
import type { WishlistRow } from './wishlist_management.js';

async function loadWishlistWithRecipient(
	database: ReturnType<typeof getDb>,
	wishlistShortId: string,
) {
	const [row] = await database
		.select({
			wishlist,
			recipientDisplayName: recipientDisplayNameSql(),
			// Raw persisted value (Google profile picture URL or uploaded object key, issue #158),
			// null for a free-text recipient, like recipientDisplayName's account name.
			recipientImage: user.image,
		})
		.from(wishlist)
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
		.where(
			and(eq(wishlist.shortId, wishlistShortId), isNull(wishlist.deletedAt), wishlistScope()),
		)
		.limit(1);
	if (row === undefined) {
		error(404, WISHLIST_NOT_FOUND_MESSAGE);
	}
	return row;
}

/**
 * Names for the header „Spravuje/Spravují" line on every list, self lists included. A
 * self-promoted linked recipient counts as a správce here without an assignment row.
 */
async function loadManagerNames(
	database: ReturnType<typeof getDb>,
	wishlistRow: WishlistRow,
	recipientDisplayName: string,
): Promise<string[]> {
	const managerRows = await database
		.select({ name: user.name })
		.from(moderatorAssignment)
		.innerJoin(user, eq(moderatorAssignment.userId, user.id))
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistRow.id),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.orderBy(moderatorAssignment.assignedAt);
	const managerNames = managerRows.map((manager) => manager.name);
	if (wishlistRow.recipientUserId !== null && wishlistRow.recipientIsModerator) {
		managerNames.unshift(recipientDisplayName);
	}
	return managerNames;
}

/**
 * A wishlist with the viewer's role and server-computed capabilities, so no client renders
 * administrator logic of its own. Anyone holding the link may read it, anonymous visitors
 * included; reservation existence is consulted only for a viewer who could revert, so the
 * recipient learns nothing about reservations.
 */
export const readWishlistOperation = defineOperation({
	name: 'readWishlist',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ wishlistShortId: v.string() }),
	async run({ actor }, { wishlistShortId }) {
		const database = getDb();
		const row = await loadWishlistWithRecipient(database, wishlistShortId);
		const role = await resolveWishlistRole(
			actor === null ? null : { user: { id: actor.userId } },
			row.wishlist,
		);
		const managerNames = await loadManagerNames(
			database,
			row.wishlist,
			row.recipientDisplayName,
		);
		const isAppAdministrator = actor?.isAppAdministrator ?? false;
		const { capability: revertCapability } = await resolveRevertAccess(database, {
			role,
			wishlistRow: row.wishlist,
			isAppAdministrator,
		});
		return {
			...row.wishlist,
			recipientDisplayName: row.recipientDisplayName,
			// The header already shows this recipient's name to every viewer, so their avatar
			// exposes no new personal data (issue #158).
			recipientImage: resolveUserImageUrl(row.recipientImage),
			managerNames,
			role,
			revertCapability,
			reservationReleaseCapability: resolveReservationReleaseCapability({
				role,
				isAdmin: isAppAdministrator,
			}),
		} as const;
	},
});
