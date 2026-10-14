import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { gift } from '$lib/server/db/gift.schema.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	isPriceRangeValid,
	type DescriptionAppend,
	type UpdateGiftInput,
} from '$lib/modules/gifts/types.js';
import { normalizeGiftLinks } from '$lib/modules/gifts/gift_url.js';
import {
	computePostShareEditTransparency,
	computePreShareOwnerEdit,
	jsonChanged,
	toPreShareGiftSnapshot,
} from '$lib/modules/gifts/gift_post_share.js';
import {
	isOwnerSharedGiftDeleteGraceOpen,
	isPreShareOwnerFullEditGraceOpen,
} from '$lib/modules/gifts/gift_deletion_rules.js';
import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
import { assertActiveGiftCategoryAssignment } from '$lib/modules/gift-categories/gift_categories_service.js';
import type { MutationOperationContext } from './operation.js';
import type { ManagedWishlist, WishlistRow } from './wishlist_management.js';

export type GiftRow = typeof gift.$inferSelect;
export type GiftUpdateData = Partial<typeof gift.$inferInsert>;

/**
 * Root of the "Upraveno po sdílení" transparency tracking (issue #124): given a changed gift edit,
 * decides the next `editedAfterShareAt` / `preEditShareSnapshot` values and writes them onto
 * `updateData`, so a net-zero revert inside grace behaves identically on every write path.
 */
function applyPostShareEditTransparency(params: {
	giftRow: GiftRow;
	updateData: GiftUpdateData;
	now: Date;
	wishlistRow: WishlistRow;
}): void {
	const { giftRow, updateData, now, wishlistRow } = params;
	const graceOpen = isOwnerSharedGiftDeleteGraceOpen(
		{ wishlistSharedAt: wishlistRow.sharedAt, giftCreatedAt: giftRow.createdAt },
		now,
	);
	const outcome = computePostShareEditTransparency({
		existingSnapshot: giftRow.preEditShareSnapshot,
		graceOpen,
		beforeEdit: toPreShareGiftSnapshot(giftRow),
		afterEdit: toPreShareGiftSnapshot({ ...giftRow, ...updateData }),
		now,
	});
	updateData.editedAfterShareAt = outcome.editedAfterShareAt;
	updateData.preEditShareSnapshot = outcome.preEditShareSnapshot;
}

export function updateDataChangesGift(giftRow: GiftRow, updateData: GiftUpdateData): boolean {
	return Object.entries(updateData).some(([key, value]) =>
		jsonChanged(value, giftRow[key as keyof GiftRow]),
	);
}

/**
 * Plans a presentation edit (priority, category, image) shared by bulk and grouped-reorder
 * writes: only a value that actually changes counts, and on shared wishlists it follows the same
 * "Upraveno po sdílení" transparency rule as the gift editor.
 */
export function planPresentationUpdate(params: {
	giftRow: GiftRow;
	updateData: GiftUpdateData;
	now: Date;
	wishlistRow: WishlistRow;
}): { giftRow: GiftRow; updateData: GiftUpdateData; didChange: boolean } {
	const { giftRow, updateData, now, wishlistRow } = params;
	const didChange = updateDataChangesGift(giftRow, updateData);
	if (didChange && wishlistRow.sharedAt !== null) {
		applyPostShareEditTransparency({ giftRow, updateData, now, wishlistRow });
	}
	return { giftRow, updateData, didChange };
}

/** State an undo restores beyond the editable fields; never counts as a post-share edit itself. */
export interface RestoredGiftState {
	descriptionAppends?: DescriptionAppend[];
	received?: boolean;
	deletedAt?: null;
}

export interface GiftUpdateRequest {
	giftRow: GiftRow;
	managedWishlist: ManagedWishlist;
	input: UpdateGiftInput;
	/** Present when undo restores a previous state through the same rules as an edit. */
	restoring?: RestoredGiftState;
	/**
	 * Routes `input.description` through the append engine on a shared wishlist for every manager,
	 * so it becomes a new timestamped segment instead of replacing the description.
	 */
	appendsDescription?: boolean;
}

export interface GiftUpdateResult {
	updated: GiftRow | undefined;
	didCategoryChange: boolean;
}

/** Restoring removed or rewritten appends is allowed only while each touched segment is in its own grace. */
function assertDescriptionAppendsRestorable(
	current: readonly DescriptionAppend[],
	restored: readonly DescriptionAppend[],
	now: Date,
): void {
	const touchedSegments = current.filter((segment, index) =>
		jsonChanged(segment, restored[index]),
	);
	if (
		restored.length > current.length ||
		touchedSegments.some((segment) => !isWithinGraceWindow(segment.addedAt, now))
	) {
		error(403, SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING);
	}
}

function fullWriteUpdateData(giftRow: GiftRow, input: UpdateGiftInput): GiftUpdateData {
	const updateData: GiftUpdateData = {};
	if (input.name !== undefined && input.name !== giftRow.name) {
		updateData.name = input.name;
	}
	if (input.description !== undefined && input.description !== giftRow.description) {
		updateData.description = input.description;
	}
	if (input.links !== undefined) {
		const normalized = normalizeGiftLinks(input.links);
		if (jsonChanged(normalized, giftRow.links)) {
			updateData.links = normalized;
		}
	}
	if (input.price !== undefined && input.price !== giftRow.price) {
		updateData.price = input.price;
	}
	if (input.priceMax !== undefined && input.priceMax !== giftRow.priceMax) {
		updateData.priceMax = input.priceMax;
	}
	if (input.currency !== undefined && input.currency !== giftRow.currency) {
		updateData.currency = input.currency;
	}
	if (input.imageUrl !== undefined && input.imageUrl !== giftRow.imageUrl) {
		updateData.imageUrl = input.imageUrl;
	}
	if (input.imageKey !== undefined && input.imageKey !== giftRow.imageKey) {
		updateData.imageKey = input.imageKey;
	}
	if (input.imageMeta !== undefined && jsonChanged(input.imageMeta, giftRow.imageMeta)) {
		updateData.imageMeta = input.imageMeta;
	}
	if (input.quantity !== undefined && input.quantity !== giftRow.quantity) {
		updateData.quantity = input.quantity;
	}
	if (input.priorityLevelId !== undefined && input.priorityLevelId !== giftRow.priorityLevelId) {
		updateData.priorityLevelId = input.priorityLevelId;
	}
	if (input.categoryId !== undefined && input.categoryId !== giftRow.categoryId) {
		updateData.categoryId = input.categoryId;
	}
	return updateData;
}

/**
 * The single gift-edit engine: price-range merge guard, the recipient's per-field post-share
 * rules (name freeze, raise-only quantity, append-only description), category validation,
 * transparency, revision, storage cleanup and the správce reserver notification.
 */
export async function applyGiftUpdate(
	context: MutationOperationContext,
	request: GiftUpdateRequest,
): Promise<GiftUpdateResult> {
	const { giftRow, input, restoring } = request;
	const { role, wishlistRow } = request.managedWishlist;
	const { transaction, now } = context;
	const didCategoryChange =
		input.categoryId !== undefined && input.categoryId !== giftRow.categoryId;

	// Cross-field guard on the MERGED row (issue #155): the wire schema only validates bounds present
	// in the same payload, so a partial update carrying one bound must not invert the persisted range.
	const mergedPrice = input.price !== undefined ? input.price : giftRow.price;
	const mergedPriceMax = input.priceMax !== undefined ? input.priceMax : giftRow.priceMax;
	if (!isPriceRangeValid({ price: mergedPrice, priceMax: mergedPriceMax })) {
		error(400, SERVER_ERROR.INVALID_PRICE_RANGE);
	}

	const isShared = wishlistRow.sharedAt !== null;
	const isPreShareGift =
		wishlistRow.sharedAt !== null && giftRow.createdAt <= wishlistRow.sharedAt;
	// Within the initial 2-minute share grace window the recipient regains full edit. Later edits
	// deliberately do not reopen name or delete grace.
	const shareGraceOpen = isPreShareOwnerFullEditGraceOpen(
		{ wishlistSharedAt: wishlistRow.sharedAt, giftCreatedAt: giftRow.createdAt },
		now,
	);
	// The recipient editing a pre-share gift after grace follows the per-field rules: these protect
	// gifters from the surprise-blind recipient. A targeted segment edit is always routed through the
	// engine, which carries its own per-segment window check.
	const isPreShareRecipientEdit =
		role === WISHLIST_ROLES.recipient &&
		isPreShareGift &&
		(!shareGraceOpen || input.descriptionAppendEdit !== undefined);
	const usesAppendEngine =
		isPreShareRecipientEdit || (request.appendsDescription === true && isShared);

	let updateData: GiftUpdateData;
	let didChange: boolean;
	if (usesAppendEngine) {
		if (restoring !== undefined && input.description !== undefined) {
			// The engine would append the restored text; the frozen original cannot be rewritten.
			error(403, SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING);
		}
		const outcome = computePreShareOwnerEdit(giftRow, input, now);
		if (outcome.rejection !== null) {
			error(outcome.rejection.status, outcome.rejection.code);
		}
		updateData = { ...outcome.updateData };
		didChange = outcome.changed;
		if (restoring?.descriptionAppends !== undefined) {
			assertDescriptionAppendsRestorable(
				giftRow.descriptionAppends,
				restoring.descriptionAppends,
				now,
			);
		}
	} else {
		updateData = fullWriteUpdateData(giftRow, input);
		didChange = Object.keys(updateData).length > 0;
	}
	if (
		restoring?.descriptionAppends !== undefined &&
		jsonChanged(restoring.descriptionAppends, giftRow.descriptionAppends)
	) {
		updateData.descriptionAppends = restoring.descriptionAppends;
		didChange = true;
	}

	// Transparency: any post-share edit that actually changes a field flags the gift as edited
	// after sharing, unless it nets out to a byte-identical revert within the grace window.
	if (isShared && didChange) {
		applyPostShareEditTransparency({ giftRow, updateData, now, wishlistRow });
	}
	if (restoring !== undefined) {
		const { received, deletedAt } = restoring;
		Object.assign(
			updateData,
			received === undefined ? {} : { received },
			deletedAt === undefined ? {} : { deletedAt },
		);
	}
	updateData.updatedAt = now;

	if (usesAppendEngine) {
		if (input.categoryId !== undefined && updateData.categoryId !== undefined) {
			updateData.categoryId = await assertActiveGiftCategoryAssignment(
				transaction,
				giftRow.wishlistId,
				input.categoryId,
			);
		}
	} else if (didCategoryChange) {
		updateData.categoryId = await assertActiveGiftCategoryAssignment(
			transaction,
			giftRow.wishlistId,
			input.categoryId,
		);
	}

	const [updated] = await transaction
		.update(gift)
		.set(updateData)
		.where(eq(gift.id, giftRow.id))
		.returning();
	if (updated === undefined) {
		return { updated, didCategoryChange };
	}
	context.recordGiftRevisions([
		{ giftId: giftRow.id, wishlistId: giftRow.wishlistId, before: giftRow, after: updated },
	]);

	// Storage cleanup (issue #107): replacing or removing an uploaded image leaves no unreferenced
	// R2 object behind. Undo never deletes storage here (only undoing a creation does, through the
	// ordinary delete path); it drops uploads it cannot restore instead.
	const replacedImageKey = giftRow.imageKey;
	if (
		!usesAppendEngine &&
		restoring === undefined &&
		updateData.imageKey !== undefined &&
		replacedImageKey !== null &&
		replacedImageKey !== updateData.imageKey
	) {
		context.deferEffect(() => deleteObjectsBestEffort([replacedImageKey]));
	}
	if (role === WISHLIST_ROLES.moderator && didChange) {
		context.noteReservedGiftEdits([
			{
				giftId: giftRow.id,
				giftName: updated.name ?? giftRow.name,
				wishlistId: giftRow.wishlistId,
				wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
			},
		]);
	}
	return { updated, didCategoryChange };
}
