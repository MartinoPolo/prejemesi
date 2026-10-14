import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
import type { WishlistRow } from './wishlist_management.js';

type EventDateEdit = Partial<Pick<WishlistRow, 'eventDate' | 'eventDateEditedAt'>>;

/**
 * The event date is editable before sharing; after sharing only inside its own grace window, which
 * each accepted edit renews. A locked date is dropped silently because the client may be stale.
 */
function planEventDateEdit(
	wishlistRow: Pick<WishlistRow, 'sharedAt' | 'eventDateEditedAt'>,
	eventDate: Date | null | undefined,
	now: Date,
): EventDateEdit {
	if (eventDate === undefined) {
		return {};
	}
	if (wishlistRow.sharedAt === null) {
		return { eventDate };
	}
	return isWithinGraceWindow(wishlistRow.eventDateEditedAt ?? wishlistRow.sharedAt, now)
		? { eventDate, eventDateEditedAt: now }
		: {};
}

interface WishlistDetailEdit {
	title?: string;
	description?: string | null;
	eventDate?: Date | null;
	imageKey?: string | null;
	imageSlots?: WishlistRow['imageSlots'];
}

/** The detail columns an edit writes; omitted fields keep their stored values. */
export function planWishlistDetailEdit(
	wishlistRow: Pick<WishlistRow, 'sharedAt' | 'eventDateEditedAt'>,
	edit: WishlistDetailEdit,
	now: Date,
): Partial<WishlistRow> {
	return {
		...(edit.title === undefined ? {} : { title: edit.title }),
		...(edit.description === undefined ? {} : { description: edit.description }),
		...planEventDateEdit(wishlistRow, edit.eventDate, now),
		...(edit.imageKey === undefined ? {} : { imageKey: edit.imageKey }),
		...(edit.imageSlots === undefined ? {} : { imageSlots: edit.imageSlots }),
	};
}

/**
 * A newly assigned banner must carry the uploader's assignment proof, so nobody can plant a key
 * they did not upload and later get it deleted. Returns the stored key the edit replaces.
 */
export async function authorizeBannerReplacement(
	actorUserId: string,
	currentImageKey: string | null,
	requested: { imageKey?: string | null; assignmentToken?: string },
): Promise<string | null> {
	if (requested.imageKey === undefined || requested.imageKey === currentImageKey) {
		return null;
	}
	if (requested.imageKey !== null) {
		const { assertWishlistBannerAssignment } =
			await import('$lib/modules/wishlists/wishlist_image_assignment.js');
		await assertWishlistBannerAssignment(
			actorUserId,
			requested.imageKey,
			requested.assignmentToken,
		);
	}
	return currentImageKey;
}
