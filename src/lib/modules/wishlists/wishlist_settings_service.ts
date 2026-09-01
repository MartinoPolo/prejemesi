import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import type { GiftCreationTransaction } from '$lib/modules/gifts/gift_creation_service.js';
import { saveGiftCategorySettings } from '$lib/modules/gift-categories/gift_categories_service.js';
import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { Wishlist } from './types.js';
import type { SaveWishlistSettingsInput } from './wishlist_settings_types.js';
import { assertWishlistBannerAssignment } from './wishlist_image_assignment.js';

/**
 * Locks and revalidates the mutable wishlist inside the write transaction. Returns the
 * image key this transaction actually replaced so cleanup cannot race a later save.
 */
export async function saveLockedWishlistSettings(
	tx: GiftCreationTransaction,
	userId: string,
	input: SaveWishlistSettingsInput,
): Promise<{ replacedImageKey: string | null; shortId: string }> {
	const rows = await tx
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, input.wishlistId), isNull(wishlist.deletedAt)))
		.limit(1)
		.for('update');
	const row = rows[0];
	if (row === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}
	const moderatorRows =
		row.recipientUserId === userId
			? [{ id: 'recipient' }]
			: await tx
					.select({ id: moderatorAssignment.id })
					.from(moderatorAssignment)
					.where(
						and(
							eq(moderatorAssignment.wishlistId, row.id),
							eq(moderatorAssignment.userId, userId),
							isNull(moderatorAssignment.deletedAt),
						),
					)
					.limit(1);
	if (moderatorRows[0] === undefined) {
		error(403, SERVER_ERROR.ACCESS_DENIED);
	}
	if (row.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
	}
	if (
		input.image?.imageKey !== null &&
		input.image?.imageKey !== undefined &&
		input.image.imageKey !== row.imageKey
	) {
		await assertWishlistBannerAssignment(
			userId,
			input.image.imageKey,
			input.image.assignmentToken,
		);
	}
	await persistWishlistSettings(tx, row as Wishlist, input);
	return {
		replacedImageKey:
			input.image !== undefined && row.imageKey !== input.image.imageKey
				? row.imageKey
				: null,
		shortId: row.shortId,
	};
}

/** Persists a validated settings draft using the caller's transaction. */
async function persistWishlistSettings(
	tx: GiftCreationTransaction,
	row: Wishlist,
	input: SaveWishlistSettingsInput,
): Promise<void> {
	const now = new Date();
	const updateData: Record<string, unknown> = {};

	if (input.details !== undefined) {
		updateData['title'] = input.details.title;
		updateData['description'] = input.details.description;
		if (input.details.eventDate !== undefined) {
			const canEditEventDate =
				row.sharedAt === null ||
				isWithinGraceWindow(row.eventDateEditedAt ?? row.sharedAt, now);
			if (canEditEventDate) {
				updateData['eventDate'] = input.details.eventDate;
				if (row.sharedAt !== null) {
					updateData['eventDateEditedAt'] = now;
				}
			}
		}
		if (input.details.recipientName !== undefined) {
			if (row.recipientUserId !== null) {
				error(400, SERVER_ERROR.RECIPIENT_RENAME_NOT_ALLOWED);
			}
			updateData['recipientName'] = input.details.recipientName;
		}
	}
	if (input.palette !== undefined) {
		updateData['palette'] = input.palette;
	}
	if (input.image !== undefined) {
		updateData['imageKey'] = input.image.imageKey;
		updateData['imageSlots'] = input.image.imageSlots;
	}
	if (Object.keys(updateData).length > 0) {
		updateData['updatedAt'] = now;
		await tx.update(wishlist).set(updateData).where(eq(wishlist.id, row.id));
	}
	if (input.categories !== undefined) {
		await saveGiftCategorySettings({ wishlistId: row.id, ...input.categories }, tx);
	}
}
