import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import type { GiftCreationTransaction } from '$lib/modules/gifts/gift_creation_service.js';
import { saveGiftCategorySettings } from '$lib/modules/gift-categories/gift_categories_service.js';
import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { Wishlist } from './types.js';
import type { SaveWishlistSettingsInput } from './wishlist_settings_types.js';

/** Persists a validated settings draft using the caller's transaction. */
export async function persistWishlistSettings(
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
