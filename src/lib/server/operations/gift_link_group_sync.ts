import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { gift } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { jsonChanged } from '$lib/modules/gifts/gift_post_share.js';
import { giftCover, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import { activeGiftCategoriesColumn } from '$lib/modules/gift-categories/gift_categories_service.js';
import type { MutationOperationContext } from './operation.js';
import { giftColumnsWithImages, replaceGiftGalleries } from './gift_gallery.js';
import { mapCategoriesIntoWishlist, type SourceCategory } from './gift_category_mapping.js';
import {
	deferReplacedImageCleanup,
	giftRowAfterWrite,
	planPresentationUpdate,
	type GiftRow,
	type GiftUpdateData,
} from './gift_presentation_update.js';
import type { ManagerRole, WishlistRow } from './wishlist_management.js';
import { managerEditNotifiesReservers } from './wishlist_kind_rules.js';

const LINKED_COPY_FIELD = {
	/** Copied to every copy as a post-share edit of it. */
	synced: 'synced',
	/** Copied to every copy as state, never a post-share edit. */
	syncedState: 'syncedState',
	/** Each copy keeps its own value. */
	perCopy: 'perCopy',
} as const;
type LinkedCopyField = (typeof LINKED_COPY_FIELD)[keyof typeof LINKED_COPY_FIELD];

/**
 * How each gift field behaves across the rows of a link group (issues #742, #737). Likes live
 * outside the gift row: linked copies keep them per copy, a shared gift counts them across its
 * rows. The gallery syncs as shared uploads and categories map into each row's wishlist; the other
 * synced fields copy verbatim.
 */
const LINKED_COPY_FIELD_POLICY = {
	name: LINKED_COPY_FIELD.synced,
	description: LINKED_COPY_FIELD.synced,
	descriptionAppends: LINKED_COPY_FIELD.synced,
	links: LINKED_COPY_FIELD.synced,
	price: LINKED_COPY_FIELD.synced,
	priceMax: LINKED_COPY_FIELD.synced,
	currency: LINKED_COPY_FIELD.synced,
	quantity: LINKED_COPY_FIELD.synced,
	images: LINKED_COPY_FIELD.synced,
	categoryIds: LINKED_COPY_FIELD.synced,
	received: LINKED_COPY_FIELD.syncedState,
	priorityLevelId: LINKED_COPY_FIELD.perCopy,
	sortOrder: LINKED_COPY_FIELD.perCopy,
} as const satisfies Partial<Record<keyof GiftRow, LinkedCopyField>>;

export type LinkedCopyPolicyField = keyof typeof LINKED_COPY_FIELD_POLICY;

/** Whether writing the field of a linked gift also writes its other copies. */
export function fieldSyncsLinkedCopies(field: LinkedCopyPolicyField): boolean {
	return LINKED_COPY_FIELD_POLICY[field] !== LINKED_COPY_FIELD.perCopy;
}

const FIELDS_SYNCED_BY_OWN_RULES: readonly LinkedCopyPolicyField[] = ['images', 'categoryIds'];

function isPolicyField(field: string): field is LinkedCopyPolicyField {
	return field in LINKED_COPY_FIELD_POLICY;
}

function fieldsWithPolicy(policy: LinkedCopyField): LinkedCopyPolicyField[] {
	return Object.keys(LINKED_COPY_FIELD_POLICY)
		.filter(isPolicyField)
		.filter(
			(field) =>
				LINKED_COPY_FIELD_POLICY[field] === policy &&
				!FIELDS_SYNCED_BY_OWN_RULES.includes(field),
		);
}

const VERBATIM_SYNCED_FIELDS = fieldsWithPolicy(LINKED_COPY_FIELD.synced);
const SYNCED_STATE_FIELDS = fieldsWithPolicy(LINKED_COPY_FIELD.syncedState);

export interface LinkedGiftEdit {
	before: GiftRow;
	after: GiftRow;
	/** The editor's role on the edited copy's wishlist, which decides reserver notices. */
	editorRole: ManagerRole;
	/** An undo keeps released uploads, as it does on the edited copy. */
	restoring: boolean;
}

/** An edit of a linked gift from its locked row before to its written row after. */
export function linkedGiftEdit(
	before: GiftRow,
	after: GiftRow,
	editorRole: ManagerRole,
	restoring = false,
): LinkedGiftEdit {
	return { before, after, editorRole, restoring };
}

/** The values `after` holds for the given fields where they differ from `before`. */
function changedFieldValues(
	before: GiftRow,
	after: GiftRow,
	fields: readonly LinkedCopyPolicyField[],
): GiftUpdateData {
	return Object.fromEntries(
		fields
			.filter((field) => jsonChanged(before[field], after[field]))
			.map((field) => [field, after[field]]),
	);
}

async function editedGiftCategories(transaction: DatabaseTransaction, giftId: string) {
	const [row] = await transaction
		.select({ categories: activeGiftCategoriesColumn() })
		.from(gift)
		.where(eq(gift.id, giftId));
	return row?.categories ?? [];
}

/** What one linked edit writes to every other copy. */
interface LinkedSync {
	edit: LinkedGiftEdit;
	verbatimFields: GiftUpdateData;
	/** The synced state fields the edit changed. */
	stateFields: LinkedCopyPolicyField[];
	/** The edited gallery when it changed. */
	gallery: GiftImage[] | undefined;
	/** The edited gift's categories when they changed. */
	categories: readonly SourceCategory[] | undefined;
}

/** Writes one sibling copy to the edited copy's synced values, with its own revision and notice. */
async function syncLinkedSibling(
	context: MutationOperationContext,
	sync: LinkedSync,
	sibling: { giftRow: GiftRow; wishlistRow: WishlistRow },
): Promise<void> {
	const { transaction, now } = context;
	const { giftRow, wishlistRow } = sibling;
	const nextImages =
		sync.gallery !== undefined && jsonChanged(sync.gallery, giftRow.images)
			? sync.gallery
			: undefined;
	const cover = sync.gallery === undefined ? undefined : giftCover(sync.gallery);
	const editData: GiftUpdateData = {
		...sync.verbatimFields,
		...(cover === undefined
			? {}
			: { imageUrl: cover.imageUrl, imageKey: cover.imageKey, imageMeta: cover.imageMeta }),
		...(sync.categories === undefined
			? {}
			: {
					categoryIds: await mapCategoriesIntoWishlist(
						transaction,
						giftRow.wishlistId,
						sync.categories,
					),
				}),
	};
	const plan = planPresentationUpdate({
		giftRow,
		updateData: editData,
		nextImages,
		now,
		wishlistRow,
	});
	const stateData = changedFieldValues(giftRow, sync.edit.after, sync.stateFields);
	if (!plan.didChange && Object.keys(stateData).length === 0) {
		return;
	}
	const updateData: GiftUpdateData = { ...plan.updateData, ...stateData };
	if (nextImages !== undefined) {
		await replaceGiftGalleries(transaction, new Map([[giftRow.id, nextImages]]));
	}
	await transaction
		.update(gift)
		.set({ ...updateData, updatedAt: now })
		.where(eq(gift.id, giftRow.id));
	const updated = giftRowAfterWrite(giftRow, updateData, nextImages);
	context.recordGiftRevisions([
		{ giftId: giftRow.id, wishlistId: giftRow.wishlistId, before: giftRow, after: updated },
	]);
	if (!sync.edit.restoring && nextImages !== undefined) {
		deferReplacedImageCleanup(context, giftRow.images, nextImages);
	}
	if (
		plan.didChange &&
		managerEditNotifiesReservers({ role: sync.edit.editorRole, wishlistRow })
	) {
		context.noteReservedGiftEdits([
			{
				giftId: giftRow.id,
				giftName: updated.name,
				wishlistId: giftRow.wishlistId,
				wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
			},
		]);
	}
}

/**
 * Writes the synced fields an edit changed ({@link LINKED_COPY_FIELD_POLICY}) to every other live
 * copy of the edited gift's link group in the same transaction. Categories map into each copy's
 * wishlist like a copy; the gallery's uploads become shared, which reference-aware cleanup keeps
 * alive. Received is state, not a post-share edit, exactly as on the edited copy. Each changed copy
 * gets its own transparency mark on a shared wishlist, revision and reserver notice.
 *
 * Precondition: the caller holds the group's wishlists and gift rows locked (`lockLinkedCopies`)
 * and already enforced the strictest copy's rules on the edit.
 */
export async function propagateToLinkedCopies(
	context: MutationOperationContext,
	edit: LinkedGiftEdit,
): Promise<void> {
	const { transaction } = context;
	const linkGroupId = edit.after.linkGroupId;
	if (linkGroupId === null) {
		return;
	}
	const verbatimFields = changedFieldValues(edit.before, edit.after, VERBATIM_SYNCED_FIELDS);
	const stateFields = SYNCED_STATE_FIELDS.filter((field) =>
		jsonChanged(edit.before[field], edit.after[field]),
	);
	const galleryChanged = jsonChanged(edit.before.images, edit.after.images);
	const categoriesChanged = jsonChanged(edit.before.categoryIds, edit.after.categoryIds);
	if (
		Object.keys(verbatimFields).length === 0 &&
		stateFields.length === 0 &&
		!galleryChanged &&
		!categoriesChanged
	) {
		return;
	}
	const siblings = await transaction
		.select({ giftRow: giftColumnsWithImages(), wishlistRow: wishlist })
		.from(gift)
		.innerJoin(wishlist, eq(wishlist.id, gift.wishlistId))
		.where(
			and(
				eq(gift.linkGroupId, linkGroupId),
				ne(gift.id, edit.after.id),
				isNull(gift.deletedAt),
			),
		)
		.orderBy(asc(gift.id))
		.for('update', { of: gift });
	if (siblings.length === 0) {
		return;
	}
	const sync: LinkedSync = {
		edit,
		verbatimFields,
		stateFields,
		gallery: galleryChanged ? edit.after.images : undefined,
		categories: categoriesChanged
			? await editedGiftCategories(transaction, edit.after.id)
			: undefined,
	};
	for (const sibling of siblings) {
		await syncLinkedSibling(context, sync, sibling);
	}
}
