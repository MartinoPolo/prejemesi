import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
import { WISHLIST_KIND, type WishlistKind } from '$lib/modules/wishlists/types.js';
import type { WishlistRow } from './wishlist_management.js';
import { assertEventDateAllowed, planWishlistKindChange } from './wishlist_kind_rules.js';

type EventDateEdit = Partial<Pick<WishlistRow, 'eventDate' | 'eventDateEditedAt'>>;
type DetailEditedWishlist = Pick<WishlistRow, 'kind' | 'sharedAt' | 'eventDateEditedAt'>;

/**
 * The event date is editable before sharing; after sharing only inside its own grace window, which
 * each accepted edit renews. A locked date is dropped silently because the client may be stale. A
 * permanent wishlist never had a date gifters could rely on, so turning it into an occasion opens
 * a fresh window.
 */
function planEventDateEdit(
	wishlistRow: DetailEditedWishlist,
	eventDate: Date | null | undefined,
	now: Date,
): EventDateEdit {
	if (eventDate === undefined) {
		return {};
	}
	if (wishlistRow.sharedAt === null) {
		return { eventDate };
	}
	const eventDateLockOpen =
		wishlistRow.kind === WISHLIST_KIND.permanent ||
		isWithinGraceWindow(wishlistRow.eventDateEditedAt ?? wishlistRow.sharedAt, now);
	return eventDateLockOpen ? { eventDate, eventDateEditedAt: now } : {};
}

interface WishlistDetailEdit {
	title?: string;
	description?: string | null;
	eventDate?: Date | null;
	kind?: WishlistKind;
	imageKey?: string | null;
	imageSlots?: WishlistRow['imageSlots'];
}

/** The detail columns an edit writes; omitted fields keep their stored values. */
export function planWishlistDetailEdit(
	wishlistRow: DetailEditedWishlist,
	edit: WishlistDetailEdit,
	now: Date,
): Partial<WishlistRow> {
	const kindChange = planWishlistKindChange(wishlistRow, edit.kind, now);
	const nextKind = kindChange.kind ?? wishlistRow.kind;
	assertEventDateAllowed(nextKind, edit.eventDate);
	return {
		...(edit.title === undefined ? {} : { title: edit.title }),
		...(edit.description === undefined ? {} : { description: edit.description }),
		...(nextKind === WISHLIST_KIND.permanent
			? {}
			: planEventDateEdit(wishlistRow, edit.eventDate, now)),
		...kindChange,
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
