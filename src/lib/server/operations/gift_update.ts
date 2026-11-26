import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { gift } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	isPriceRangeValid,
	type DescriptionAppend,
	type UpdateGiftInput,
} from '$lib/modules/gifts/types.js';
import { normalizeGiftLinks } from '$lib/modules/gifts/gift_url.js';
import { computePreShareOwnerEdit, jsonChanged } from '$lib/modules/gifts/gift_post_share.js';
import { isPreShareOwnerFullEditGraceOpen } from '$lib/modules/gifts/gift_deletion_rules.js';
import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
import { assertActiveGiftCategoryAssignments } from '$lib/modules/gift-categories/gift_categories_service.js';
import {
	requestedGiftCategoryIds,
	sameGiftCategoryIds,
} from '$lib/modules/gift-categories/gift_category_assignment.js';
import { galleryWithCover, giftCover, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import type { MutationOperationContext } from './operation.js';
import { replaceGiftGalleries } from './gift_gallery.js';
import { assertWishlistPriorityLevel, type ManagedWishlist } from './wishlist_management.js';
import { managerEditNotifiesReservers } from './wishlist_kind_rules.js';
import { lockedLinkedEditRules, type LinkedEditRules } from './gift_link_group.js';
import { propagateToLinkedCopies } from './gift_link_group_sync.js';
import {
	applyPostShareEditTransparency,
	deferReplacedImageCleanup,
	type GiftRow,
	type GiftUpdateData,
} from './gift_presentation_update.js';

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
		categoryIds: input.categoryIds,
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

/**
 * Whether the edit runs through the post-share append engine instead of a full write. A gift that
 * does not follow the strict post-share rules is written in full, except a targeted segment edit:
 * only the engine edits existing segments, which such a gift keeps from when it was reserved.
 */
function usesAppendEngine(
	request: GiftUpdateRequest,
	linkedRules: LinkedEditRules,
	now: Date,
): boolean {
	const { giftRow, input } = request;
	const { role, wishlistRow } = request.managedWishlist;
	// The strictest linked copy decides for every copy (issue #742).
	if (
		(role === WISHLIST_ROLES.recipient && linkedRules.frozenByLinkedCopy) ||
		(request.appendsDescription === true && linkedRules.appendsByLinkedCopy)
	) {
		return true;
	}
	if (!linkedRules.followsStrictRules) {
		return input.descriptionAppendEdit !== undefined;
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
 * Resolves the requested images into the complete next gallery. A full `images` list replaces
 * every image and becomes the cover fields the edit engines compare; the single cover fields
 * replace only the cover and keep the later images. Undefined when the edit names no image field.
 */
function withRequestedGallery(request: GiftUpdateRequest): {
	request: GiftUpdateRequest;
	nextImages: GiftImage[] | undefined;
} {
	const { giftRow } = request;
	const { images, ...input } = request.input;
	if (images !== undefined) {
		const cover = giftCover(images);
		return {
			request: {
				...request,
				input: {
					...input,
					imageUrl: cover.imageUrl,
					imageKey: cover.imageKey,
					imageMeta: cover.imageMeta,
				},
			},
			nextImages: images,
		};
	}
	if (
		input.imageUrl === undefined &&
		input.imageKey === undefined &&
		input.imageMeta === undefined
	) {
		return { request, nextImages: undefined };
	}
	const nextCover: GiftImage = {
		imageUrl: input.imageUrl === undefined ? giftRow.imageUrl : input.imageUrl,
		imageKey: input.imageKey === undefined ? giftRow.imageKey : input.imageKey,
		imageMeta: input.imageMeta === undefined ? giftRow.imageMeta : input.imageMeta,
	};
	return { request, nextImages: galleryWithCover(giftRow.images, nextCover) };
}

function noteReservedGiftEdit(
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

/** Resolves the superseded single `categoryId` into the full list the edit engine compares. */
function withRequestedCategoryIds(request: GiftUpdateRequest): GiftUpdateRequest {
	const { categoryId: legacyCategoryId, ...input } = request.input;
	if (legacyCategoryId === undefined) {
		return request;
	}
	const categoryIds = requestedGiftCategoryIds(
		{ categoryId: legacyCategoryId },
		request.giftRow.categoryIds,
	);
	return { ...request, input: { ...input, categoryIds } };
}

/**
 * The single gift-edit engine: price-range merge guard, the recipient's per-field post-share
 * rules (name freeze, raise-only quantity, append-only description) unless the gift is exempt on a
 * permanent wishlist, category validation, transparency, revision, storage cleanup and the
 * reserver notification. The caller holds the gift row FOR UPDATE.
 */
export async function applyGiftUpdate(
	context: MutationOperationContext,
	requestedEdit: GiftUpdateRequest,
): Promise<GiftUpdateResult> {
	const { request, nextImages: requestedImages } = withRequestedGallery(
		withRequestedCategoryIds(requestedEdit),
	);
	const { giftRow, input, restoring } = request;
	const { wishlistRow } = request.managedWishlist;
	const { transaction, now } = context;
	const didCategoryChange =
		input.categoryIds !== undefined &&
		!sameGiftCategoryIds(input.categoryIds, giftRow.categoryIds);

	assertMergedPriceRangeValid(giftRow, input);
	const linkedRules = await lockedLinkedEditRules(transaction, giftRow, wishlistRow, now);
	const appendEngine = usesAppendEngine(request, linkedRules, now);
	const plannedEdit = planGiftEdit(request, appendEngine, now);
	const { updateData } = plannedEdit;
	const nextImages =
		requestedImages !== undefined && jsonChanged(requestedImages, giftRow.images)
			? requestedImages
			: undefined;
	const didChange = plannedEdit.didChange || nextImages !== undefined;

	// Transparency: any post-share edit that actually changes a field flags the gift as edited
	// after sharing, unless it nets out to a byte-identical revert within the grace window.
	if (wishlistRow.sharedAt !== null && didChange) {
		applyPostShareEditTransparency({ giftRow, updateData, nextImages, now, wishlistRow });
	}
	Object.assign(updateData, restoredStateUpdateData(restoring), { updatedAt: now });

	if (updateData.categoryIds !== undefined) {
		updateData.categoryIds = await assertActiveGiftCategoryAssignments(
			transaction,
			giftRow.wishlistId,
			updateData.categoryIds,
		);
	}
	// The foreign key alone accepts another wishlist's level, and an undo may target a removed one.
	if (updateData.priorityLevelId !== undefined) {
		await assertWishlistPriorityLevel(
			transaction,
			giftRow.wishlistId,
			updateData.priorityLevelId,
		);
	}

	if (nextImages !== undefined) {
		await replaceGiftGalleries(transaction, new Map([[giftRow.id, nextImages]]));
	}
	const [updatedColumns] = await transaction
		.update(gift)
		.set(updateData)
		.where(eq(gift.id, giftRow.id))
		.returning();
	if (updatedColumns === undefined) {
		return { updated: undefined, didCategoryChange };
	}
	const updated: GiftRow = { ...updatedColumns, images: nextImages ?? giftRow.images };
	context.recordGiftRevisions([
		{ giftId: giftRow.id, wishlistId: giftRow.wishlistId, before: giftRow, after: updated },
	]);

	// Undo never deletes storage here (only undoing a creation does, through the ordinary delete
	// path); it drops uploads it cannot restore instead.
	if (!appendEngine && restoring === undefined && nextImages !== undefined) {
		deferReplacedImageCleanup(context, giftRow.images, nextImages);
	}
	if (managerEditNotifiesReservers(request.managedWishlist) && didChange) {
		noteReservedGiftEdit(context, request, updated);
	}
	await propagateToLinkedCopies(context, {
		before: giftRow,
		after: updated,
		editorRole: request.managedWishlist.role,
		restoring: restoring !== undefined,
	});
	return { updated, didCategoryChange };
}
