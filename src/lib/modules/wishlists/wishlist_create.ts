import { error } from '@sveltejs/kit';
import type { getDb } from '$lib/server/db/index.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	DEFAULT_PRIORITY_LEVELS,
	DEFAULT_WISHLIST_THEME,
	RECIPIENT_KIND,
	type WishlistTheme,
} from './types.js';

/** Drizzle transaction handle, inferred from {@link getDb}'s `transaction` callback. */
type Transaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

/**
 * Fields needed to seed a new wishlist; shared by direct create and import flows.
 * Discriminated on `recipientKind` (issue #99):
 * - `self`: the creator is the linked recipient.
 * - `other`: a free-text recipient; the creator becomes the first správce.
 */
export type NewWishlistInput = {
	title: string;
	eventDate?: Date | null;
	theme?: WishlistTheme;
} & ({ recipientKind: 'self' } | { recipientKind: 'other'; recipientName: string });

/**
 * Insert a new wishlist and seed its default priority levels, inside the given
 * transaction. For a `self` list the creator is the linked recipient; for an `other`
 * list the creator gets a normal moderator-assignment row (creator = first správce) and
 * the recipient is stored as free text. Returns the created wishlist row. Throws 500 if
 * the insert yields no row. Shared by `createWishlist` and `createWishlistFromImport`.
 */
export async function seedNewWishlist(
	tx: Transaction,
	creatorUserId: string,
	input: NewWishlistInput,
): Promise<typeof wishlist.$inferSelect> {
	const forSelf = input.recipientKind === RECIPIENT_KIND.self;

	const [created] = await tx
		.insert(wishlist)
		.values({
			recipientUserId: forSelf ? creatorUserId : null,
			recipientName: forSelf ? null : input.recipientName,
			title: input.title,
			eventDate: input.eventDate ?? null,
			theme: input.theme ?? DEFAULT_WISHLIST_THEME,
		})
		.returning();

	if (created === undefined) {
		error(500, SERVER_ERROR.FAILED_TO_CREATE_WISHLIST);
	}

	// For-someone lists have no linked recipient to manage them: the creator becomes the
	// first správce so the list has an owner of its management (the orphan guard keeps ≥1).
	if (!forSelf) {
		await tx.insert(moderatorAssignment).values({
			wishlistId: created.id,
			userId: creatorUserId,
		});
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
