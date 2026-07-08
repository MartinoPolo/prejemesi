import { graceWindowExpiresAt, isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';

interface OwnerSharedGiftDeleteGraceInput {
	wishlistSharedAt: Date | string | null | undefined;
	giftCreatedAt: Date | string;
}

function isPostShareGift(input: OwnerSharedGiftDeleteGraceInput): boolean {
	if (input.wishlistSharedAt === null || input.wishlistSharedAt === undefined) {
		return false;
	}
	return new Date(input.giftCreatedAt).getTime() > new Date(input.wishlistSharedAt).getTime();
}

/**
 * Owner delete grace on a shared wishlist:
 * - pre-share gifts: 2 minutes after sharing;
 * - gifts added after sharing: 2 minutes after creation.
 *
 * Later edits deliberately do not reopen this window.
 */
function ownerSharedGiftDeleteGraceOpenedAt(
	input: OwnerSharedGiftDeleteGraceInput,
): Date | string | null {
	if (input.wishlistSharedAt === null || input.wishlistSharedAt === undefined) {
		return null;
	}
	return isPostShareGift(input) ? input.giftCreatedAt : input.wishlistSharedAt;
}

export function ownerSharedGiftDeleteGraceExpiresAt(
	input: OwnerSharedGiftDeleteGraceInput,
): Date | null {
	return graceWindowExpiresAt(ownerSharedGiftDeleteGraceOpenedAt(input));
}

export function isOwnerSharedGiftDeleteGraceOpen(
	input: OwnerSharedGiftDeleteGraceInput,
	now: Date,
): boolean {
	return isWithinGraceWindow(ownerSharedGiftDeleteGraceOpenedAt(input), now);
}

export function preShareOwnerFullEditGraceExpiresAt(
	input: OwnerSharedGiftDeleteGraceInput,
): Date | null {
	if (
		input.wishlistSharedAt === null ||
		input.wishlistSharedAt === undefined ||
		isPostShareGift(input)
	) {
		return null;
	}
	return graceWindowExpiresAt(input.wishlistSharedAt);
}

export function isPreShareOwnerFullEditGraceOpen(
	input: OwnerSharedGiftDeleteGraceInput,
	now: Date,
): boolean {
	if (
		input.wishlistSharedAt === null ||
		input.wishlistSharedAt === undefined ||
		isPostShareGift(input)
	) {
		return false;
	}
	return isWithinGraceWindow(input.wishlistSharedAt, now);
}
