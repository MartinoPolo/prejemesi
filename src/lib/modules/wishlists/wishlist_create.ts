import { error } from '@sveltejs/kit';
import type { getDb } from '$lib/server/db/index.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { DEFAULT_PRIORITY_LEVELS, DEFAULT_WISHLIST_THEME, type WishlistTheme } from './types.js';

/** Drizzle transaction handle, inferred from {@link getDb}'s `transaction` callback. */
type Transaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

/** Fields needed to seed a new wishlist; shared by direct create and import flows. */
export interface NewWishlistInput {
	title: string;
	eventDate?: Date | null;
	theme?: WishlistTheme;
}

/**
 * Insert a new wishlist owned by `ownerId` and seed its default priority levels,
 * inside the given transaction. Returns the created wishlist row. Throws 500 if
 * the insert yields no row. Shared by `createWishlist` and `createWishlistFromImport`.
 */
export async function seedNewWishlist(
	tx: Transaction,
	ownerId: string,
	input: NewWishlistInput,
): Promise<typeof wishlist.$inferSelect> {
	const [created] = await tx
		.insert(wishlist)
		.values({
			ownerId,
			title: input.title,
			eventDate: input.eventDate ?? null,
			theme: input.theme ?? DEFAULT_WISHLIST_THEME,
		})
		.returning();

	if (created === undefined) {
		error(500, SERVER_ERROR.FAILED_TO_CREATE_WISHLIST);
	}

	await tx.insert(priorityLevel).values(
		DEFAULT_PRIORITY_LEVELS.map((level) => ({
			wishlistId: created.id,
			label: level.label,
			sortOrder: level.sortOrder,
		})),
	);

	return created;
}
