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

/** An unrestricted edit writes every requested field whose value differs from the stored one. */
function fullWriteUpdateData(giftRow: GiftRow, input: UpdateGiftInput): GiftUpdateData {
	const requestedValues: GiftUpdateData = {
		name: input.name,
		description: input.description,
		links: input.links === undefined ? undefined : normalizeGiftLinks(input.links),
		price: input.price,
		priceMax: input.priceMax,
		currency: input.currency,
		imageUrl: input.imageUrl,
		imageKey: input.imageKey,
		imageMeta: input.imageMeta,
		quantity: input.quantity,
		priorityLevelId: input.priorityLevelId,
		categoryId: input.categoryId,
	};
	return Object.fromEntries(
		Object.entries(requestedValues).filter(
			([field, value]) =>
				value !== undefined && jsonChanged(value, giftRow[field as keyof GiftRow]),
		),
	);
}

/**
 * Cross-field guard on the MERGED row (issue #155): the wire schema only validates bounds present
 * in the same payload, so a partial update carrying one bound must not invert the persisted range.
 */
function assertMergedPriceRangeValid(giftRow: GiftRow, input: UpdateGiftInput): void {
	const mergedPrice = input.price !== undefined ? input.price : giftRow.price;
	const mergedPriceMax = input.priceMax !== undefined ? input.priceMax : giftRow.priceMax;
	if (!isPriceRangeValid({ price: mergedPrice, priceMax: mergedPriceMax })) {
		error(400, SERVER_ERROR.INVALID_PRICE_RANGE);
	}
}

/** Whether the edit runs through the post-share append engine instead of a full write. */
function usesAppendEngine(request: GiftUpdateRequest, now: Date): boolean {
	const { giftRow, input } = request;
	const { role, wishlistRow } = request.managedWishlist;
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
	return isPreShareRecipientEdit || (request.appendsDescription === true && isShared);
}

interface PlannedGiftEdit {
	updateData: GiftUpdateData;
	didChange: boolean;
}

function planAppendEngineEdit(request: GiftUpdateRequest, now: Date): PlannedGiftEdit {
	const { giftRow, input, restoring } = request;
	if (restoring !== undefined && input.description !== undefined) {
		// The engine would append the restored text; the frozen original cannot be rewritten.
		error(403, SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING);
	}
	const outcome = computePreShareOwnerEdit(giftRow, input, now);
	if (outcome.rejection !== null) {
		error(outcome.rejection.status, outcome.rejection.code);
	}
	if (restoring?.descriptionAppends !== undefined) {
		assertDescriptionAppendsRestorable(
			giftRow.descriptionAppends,
			restoring.descriptionAppends,
			now,
		);
	}
	return { updateData: { ...outcome.updateData }, didChange: outcome.changed };
}

function planFullWriteEdit(request: GiftUpdateRequest): PlannedGiftEdit {
	const updateData = fullWriteUpdateData(request.giftRow, request.input);
	return { updateData, didChange: Object.keys(updateData).length > 0 };
}

function planGiftEdit(
	request: GiftUpdateRequest,
	appendEngine: boolean,
	now: Date,
): PlannedGiftEdit {
	const { giftRow, restoring } = request;
	const plannedEdit = appendEngine
		? planAppendEngineEdit(request, now)
		: planFullWriteEdit(request);
	const restoredAppends = restoring?.descriptionAppends;
	if (restoredAppends !== undefined && jsonChanged(restoredAppends, giftRow.descriptionAppends)) {
		plannedEdit.updateData.descriptionAppends = restoredAppends;
		plannedEdit.didChange = true;
	}
	return plannedEdit;
}

/** State an undo restores is applied verbatim, after transparency has judged the edit itself. */
function restoredStateUpdateData(restoring: RestoredGiftState | undefined): GiftUpdateData {
	if (restoring === undefined) {
		return {};
	}
	const { received, deletedAt } = restoring;
	return {
		...(received === undefined ? {} : { received }),
		...(deletedAt === undefined ? {} : { deletedAt }),
	};
}

/**
 * Storage cleanup (issue #107): replacing or removing an uploaded image leaves no unreferenced R2
 * object behind.
 */
function deferReplacedImageCleanup(
	context: MutationOperationContext,
	replacedImageKey: string | null,
	nextImageKey: string | null | undefined,
): void {
	if (
		nextImageKey !== undefined &&
		replacedImageKey !== null &&
		replacedImageKey !== nextImageKey
	) {
		context.deferEffect(() => deleteObjectsBestEffort([replacedImageKey]));
	}
}

function noteModeratorEdit(
	context: MutationOperationContext,
	request: GiftUpdateRequest,
	updated: GiftRow,
): void {
	const { giftRow } = request;
	const { wishlistRow } = request.managedWishlist;
	context.noteReservedGiftEdits([
		{
			giftId: giftRow.id,
			giftName: updated.name ?? giftRow.name,
			wishlistId: giftRow.wishlistId,
			wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
		},
	]);
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

	assertMergedPriceRangeValid(giftRow, input);
	const appendEngine = usesAppendEngine(request, now);
	const { updateData, didChange } = planGiftEdit(request, appendEngine, now);

	// Transparency: any post-share edit that actually changes a field flags the gift as edited
	// after sharing, unless it nets out to a byte-identical revert within the grace window.
	if (wishlistRow.sharedAt !== null && didChange) {
		applyPostShareEditTransparency({ giftRow, updateData, now, wishlistRow });
	}
	Object.assign(updateData, restoredStateUpdateData(restoring), { updatedAt: now });

	if (input.categoryId !== undefined && updateData.categoryId !== undefined) {
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

	// Undo never deletes storage here (only undoing a creation does, through the ordinary delete
	// path); it drops uploads it cannot restore instead.
	if (!appendEngine && restoring === undefined) {
		deferReplacedImageCleanup(context, giftRow.imageKey, updateData.imageKey);
	}
	if (role === WISHLIST_ROLES.moderator && didChange) {
		noteModeratorEdit(context, request, updated);
	}
	return { updated, didCategoryChange };
}
