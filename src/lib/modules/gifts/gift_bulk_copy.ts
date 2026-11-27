import * as v from 'valibot';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { generateId } from '$lib/server/db/id.js';
import { GIFT_LINK_GROUP_KIND } from '$lib/modules/gifts/gift_link_group_kind.js';
import { getDb } from '$lib/server/db/index.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { giftIngestionOrphan } from '$lib/server/db/ingestion.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { getObject, putObject, deleteObject } from '$lib/server/storage/r2.js';
import { activeGiftCategoriesColumn } from '$lib/modules/gift-categories/gift_categories_service.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_KIND } from '$lib/modules/wishlists/types.js';
import { recipientMayMoveGifts } from '$lib/modules/wishlists/wishlist_capabilities.js';
import {
	appendGiftsUsingTransaction,
	type GiftCreationTransaction,
} from './gift_creation_service.js';
import type { DescriptionAppend, GiftWithImages } from './types.js';
import type { GiftImage } from './gift_images.js';
import { giftImagesColumn } from '$lib/server/operations/gift_gallery.js';
import type { RecordGiftRevisions } from '$lib/server/operations/gift_revisions.js';
import type { MutationOperationContext } from '$lib/server/operations/operation.js';
import { lockWishlistsInIdOrder } from '$lib/server/operations/wishlist_management.js';
import {
	createLinkGroup,
	loadLinkGroupKinds,
	lockLinkedCopies,
	wishlistsShareRecipient,
} from '$lib/server/operations/gift_link_group.js';
import { loadReservedGiftIds } from '$lib/server/operations/wishlist_kind_rules.js';
import {
	addMissingCopiedCategories,
	matchedCategoryIds,
	type DestinationCategory,
	type SourceCategory,
} from '$lib/server/operations/gift_category_mapping.js';

export const MAX_BULK_COPY_GIFTS = 50;

export const BulkCopyGiftsInputSchema = v.strictObject({
	sourceWishlistId: v.string(),
	destinationWishlistId: v.string(),
	giftIds: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(MAX_BULK_COPY_GIFTS)),
	/** Removes each copied unreserved source gift; allowed only from a permanent wishlist. */
	removeUnreservedSources: v.optional(v.boolean()),
	/**
	 * Keeps each copy linked with its source so their shared fields stay in sync. Omitted, copies
	 * link exactly when both wishlists have the same recipient; true for other wishlists is rejected.
	 */
	linkCopies: v.optional(v.boolean()),
});

export type BulkCopyGiftsInput = v.InferOutput<typeof BulkCopyGiftsInputSchema>;

type Database = ReturnType<typeof getDb>;
type Transaction = GiftCreationTransaction;
type SourceGift = typeof gift.$inferSelect & {
	categories: readonly SourceCategory[];
	images: GiftImage[];
};

export function flattenGiftDescription(
	description: string | null,
	appends: readonly DescriptionAppend[],
): string | null {
	const parts = [description, ...appends.map((append) => append.text)].filter(
		(part): part is string => part !== null && part.trim() !== '',
	);
	return parts.length === 0 ? null : parts.join('\n\n');
}

/**
 * The copy's gallery and portable fields. `destinationImageKeys` follows the source gallery: each
 * uploaded image gets the key of its own copied object, a linked image stays a link (null). A
 * linked copy keeps the source's description as is, because later appends sync segment by segment.
 */
export function portableGiftCopy(input: {
	source: SourceGift;
	destinationGiftId: string;
	destinationImageKeys: readonly (string | null)[];
	taxonomy: { priorityLevelId: string | null; categoryIds: string[] };
	linked: boolean;
}) {
	return {
		id: input.destinationGiftId,
		name: input.source.name,
		description: input.linked
			? input.source.description
			: flattenGiftDescription(input.source.description, input.source.descriptionAppends),
		links: input.source.links,
		price: input.source.price,
		priceMax: input.source.priceMax,
		currency: input.source.currency,
		quantity: input.source.quantity,
		images: input.source.images.map((image, index) => ({
			imageUrl: image.imageUrl,
			imageKey: input.destinationImageKeys[index] ?? null,
			imageMeta: image.imageMeta,
		})),
		...input.taxonomy,
	};
}

function galleryKeysMatch(first: SourceGift, second: SourceGift): boolean {
	return (
		first.images.length === second.images.length &&
		first.images.every((image, index) => image.imageKey === second.images[index]?.imageKey)
	);
}

export function mapCopiedTaxonomy(input: {
	source: SourceGift;
	sourcePriorityIdsByOrdinal: readonly string[];
	destinationPriorities: readonly { id: string }[];
	destinationCategories: readonly DestinationCategory[];
}): { priorityLevelId: string | null; categoryIds: string[] } {
	const priorityOrdinal =
		input.source.priorityLevelId === null
			? -1
			: input.sourcePriorityIdsByOrdinal.indexOf(input.source.priorityLevelId);
	return {
		priorityLevelId:
			priorityOrdinal < 0 ? null : (input.destinationPriorities[priorityOrdinal]?.id ?? null),
		categoryIds: matchedCategoryIds(input.source.categories, input.destinationCategories),
	};
}

/** Whether the copies link with their sources; an explicit link between other recipients fails. */
function copiesLink(
	input: BulkCopyGiftsInput,
	source: typeof wishlist.$inferSelect,
	destination: typeof wishlist.$inferSelect,
): boolean {
	const sameRecipient = wishlistsShareRecipient(source, destination);
	if (input.linkCopies === true && !sameRecipient) {
		error(400, SERVER_ERROR.BULK_COPY_LINK_NOT_ALLOWED);
	}
	return (input.linkCopies ?? true) && sameRecipient;
}

async function assertManagedWishlist(
	database: Database | Transaction,
	actorId: string,
	wishlistId: string,
	lock: boolean,
) {
	const query = database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt), wishlistScope()))
		.limit(1);
	const rows = lock ? await query.for('update') : await query;
	const row = rows[0];
	if (row === undefined || row.status === 'archived') {
		error(400, SERVER_ERROR.BULK_COPY_DESTINATION_UNAVAILABLE);
	}
	if (row.recipientUserId !== actorId) {
		const assignmentQuery = database
			.select({ id: moderatorAssignment.id })
			.from(moderatorAssignment)
			.where(
				and(
					eq(moderatorAssignment.wishlistId, wishlistId),
					eq(moderatorAssignment.userId, actorId),
					isNull(moderatorAssignment.deletedAt),
				),
			)
			.limit(1);
		const assignments = lock ? await assignmentQuery.for('update') : await assignmentQuery;
		if (assignments[0] === undefined) {
			error(403, SERVER_ERROR.BULK_COPY_DESTINATION_UNAVAILABLE);
		}
	}
	return row;
}

/**
 * Moving gifts out (copy, then remove the unreserved sources) is a permanent wishlist's workflow.
 * The recipient may move only from a list that was never shared: once shared, the reserved gifts a
 * move leaves behind would reveal their reservations, even after a revert to draft.
 */
function assertSourceRemovalAllowed(
	actorId: string,
	source: Pick<
		typeof wishlist.$inferSelect,
		'kind' | 'recipientUserId' | 'firstSharedAt' | 'sharedAt'
	>,
	input: BulkCopyGiftsInput,
): void {
	if (input.removeUnreservedSources !== true) {
		return;
	}
	if (source.kind !== WISHLIST_KIND.permanent) {
		error(400, SERVER_ERROR.BULK_COPY_SOURCE_NOT_PERMANENT);
	}
	if (source.recipientUserId === actorId && !recipientMayMoveGifts(source)) {
		error(403, SERVER_ERROR.BULK_COPY_RECIPIENT_CANNOT_MOVE);
	}
}

async function loadSourceGifts(
	database: Database | Transaction,
	input: BulkCopyGiftsInput,
	lock: boolean,
): Promise<SourceGift[]> {
	const query = database
		.select({ gift, categories: activeGiftCategoriesColumn(), images: giftImagesColumn() })
		.from(gift)
		.where(
			and(
				inArray(gift.id, input.giftIds),
				eq(gift.wishlistId, input.sourceWishlistId),
				isNull(gift.deletedAt),
			),
		);
	const rows = lock ? await query.for('update', { of: gift }) : await query;
	if (rows.length !== input.giftIds.length) {
		error(400, SERVER_ERROR.BULK_COPY_INVALID_SELECTION);
	}
	const byId = new Map(
		rows.map((row) => [
			row.gift.id,
			{ ...row.gift, categories: row.categories, images: row.images },
		]),
	);
	return input.giftIds.map((id) => byId.get(id)!);
}

function copiedObjectKey(destinationGiftId: string, sourceKey: string): string {
	const extension = /\.[a-zA-Z0-9]+$/.exec(sourceKey)?.[0] ?? '';
	return `gifts/${destinationGiftId}-${generateId()}${extension}`;
}

export async function stageCopiedImage(
	sourceKey: string,
	destinationKey: string,
	storage: {
		get: typeof getObject;
		put: typeof putObject;
	} = { get: getObject, put: putObject },
): Promise<void> {
	const source = await storage.get(sourceKey);
	if (source === null || !(await storage.put(destinationKey, source.body, source.contentType))) {
		throw new Error('Gift image copy failed');
	}
}

async function markJournalResolved(
	database: Database,
	journalIds: readonly string[],
): Promise<void> {
	if (journalIds.length === 0) {
		return;
	}
	await database
		.update(giftIngestionOrphan)
		.set({ resolvedAt: new Date() })
		.where(inArray(giftIngestionOrphan.id, journalIds));
}

export async function compensateStagedImages(
	staged: readonly { key: string; journalId: string }[],
	operations: {
		remove: (key: string) => Promise<void>;
		resolve: (journalId: string) => Promise<void>;
	},
): Promise<void> {
	for (const item of staged) {
		try {
			await operations.remove(item.key);
			await operations.resolve(item.journalId);
		} catch (thrown) {
			console.error('[Bulk gift copy] staged image cleanup failed', item.key, thrown);
		}
	}
}

interface GiftCopyPlan {
	source: SourceGift;
	destinationGiftId: string;
	/** One per source gallery image: the copied object's key, or null for a linked image. */
	destinationImageKeys: (string | null)[];
}

interface StagedImagePlan {
	sourceGiftId: string;
	sourceKey: string;
	destinationKey: string;
}

/** The pre-transaction part of a copy: preflight checks, staged image objects and their journal. */
export interface PreparedGiftCopy {
	plans: readonly GiftCopyPlan[];
	/** Closes the staging journal once the copy committed. */
	complete(): Promise<void>;
	/** Removes staged objects and closes the journal when the copy did not commit. */
	abandon(): Promise<void>;
}

/**
 * Validates the selection and stages copied images before the copy transaction opens, so R2 I/O
 * never holds row locks. A dry run skips staging because nothing will reference the objects.
 */
export async function prepareGiftCopy(
	actorId: string,
	input: BulkCopyGiftsInput,
	options: { database?: Database; stageImages: boolean },
): Promise<PreparedGiftCopy> {
	if (
		input.sourceWishlistId === input.destinationWishlistId ||
		new Set(input.giftIds).size !== input.giftIds.length
	) {
		error(400, SERVER_ERROR.BULK_COPY_INVALID_SELECTION);
	}
	const database = options.database ?? getDb();
	const source = await assertManagedWishlist(database, actorId, input.sourceWishlistId, false);
	assertSourceRemovalAllowed(actorId, source, input);
	const destination = await assertManagedWishlist(
		database,
		actorId,
		input.destinationWishlistId,
		false,
	);
	copiesLink(input, source, destination);
	const preflightGifts = await loadSourceGifts(database, input, false);
	const operationId = generateId();
	const plans: GiftCopyPlan[] = preflightGifts.map((source) => {
		const destinationGiftId = generateId();
		return {
			source,
			destinationGiftId,
			destinationImageKeys: source.images.map((image) =>
				image.imageKey === null ? null : copiedObjectKey(destinationGiftId, image.imageKey),
			),
		};
	});
	const imagePlans: StagedImagePlan[] = options.stageImages
		? plans.flatMap((plan) =>
				plan.source.images.flatMap((image, index) => {
					const destinationKey = plan.destinationImageKeys[index] ?? null;
					return image.imageKey === null || destinationKey === null
						? []
						: [
								{
									sourceGiftId: plan.source.id,
									sourceKey: image.imageKey,
									destinationKey,
								},
							];
				}),
			)
		: [];
	const journalRows =
		imagePlans.length === 0
			? []
			: await database
					.insert(giftIngestionOrphan)
					.values(
						imagePlans.map((imagePlan) => ({
							manifestId: `bulk-copy:${operationId}`,
							itemId: imagePlan.sourceGiftId,
							objectKey: imagePlan.destinationKey,
							reason: 'Bulk gift copy staging journal',
						})),
					)
					.returning({
						id: giftIngestionOrphan.id,
						objectKey: giftIngestionOrphan.objectKey,
					});
	const journalIdByKey = new Map(journalRows.map((row) => [row.objectKey, row.id]));
	const staged: { key: string; journalId: string }[] = [];
	const attemptedJournalIds = new Set<string>();
	const preparedCopy: PreparedGiftCopy = {
		plans,
		async complete() {
			try {
				await markJournalResolved(
					database,
					journalRows.map((row) => row.id),
				);
			} catch (thrown) {
				console.error('[Bulk gift copy] could not close staging journal', thrown);
			}
		},
		async abandon() {
			await compensateStagedImages(staged, {
				remove: deleteObject,
				resolve: (journalId) => markJournalResolved(database, [journalId]),
			});
			const unstagedJournalIds = journalRows
				.filter((row) => !attemptedJournalIds.has(row.id))
				.map((row) => row.id);
			try {
				await markJournalResolved(database, unstagedJournalIds);
			} catch (cleanupError) {
				console.error(
					'[Bulk gift copy] could not close unused staging journal',
					cleanupError,
				);
			}
		},
	};
	try {
		for (const imagePlan of imagePlans) {
			const journalId = journalIdByKey.get(imagePlan.destinationKey)!;
			attemptedJournalIds.add(journalId);
			await stageCopiedImage(imagePlan.sourceKey, imagePlan.destinationKey);
			staged.push({ key: imagePlan.destinationKey, journalId });
		}
	} catch (thrown) {
		await preparedCopy.abandon();
		throw thrown;
	}
	return preparedCopy;
}

/**
 * Puts each linked copy into its source's link group, which a source joins with a new id when it
 * had none. A copy carries the source's appended segments and received state as its own.
 */
async function linkCopiesWithSources(
	transaction: Transaction,
	links: readonly { source: SourceGift; copy: GiftWithImages }[],
	recordRevisions: RecordGiftRevisions,
): Promise<GiftWithImages[]> {
	const linkedCopies: GiftWithImages[] = [];
	for (const { source, copy } of links) {
		const linkGroupId =
			source.linkGroupId ??
			(await createLinkGroup(transaction, GIFT_LINK_GROUP_KIND.linkedCopies));
		if (source.linkGroupId === null) {
			await transaction.update(gift).set({ linkGroupId }).where(eq(gift.id, source.id));
		}
		const linkedState = {
			linkGroupId,
			descriptionAppends: source.descriptionAppends,
			received: source.received,
		};
		await transaction.update(gift).set(linkedState).where(eq(gift.id, copy.id));
		const linkedCopy = { ...copy, ...linkedState };
		linkedCopies.push(linkedCopy);
		await recordRevisions([
			{ giftId: copy.id, wishlistId: copy.wishlistId, before: copy, after: linkedCopy },
		]);
	}
	return linkedCopies;
}

/** The transactional part of a copy: revalidates access and the selection under locks, then appends. */
export async function copyPreparedGifts(
	context: Pick<MutationOperationContext, 'transaction' | 'heldWishlistLocks'> & {
		recordGiftRevisions: RecordGiftRevisions;
	},
	actorId: string,
	input: BulkCopyGiftsInput,
	preparedCopy: Pick<PreparedGiftCopy, 'plans'>,
): Promise<{
	created: GiftWithImages[];
	linkedIds: string[];
	destinationShortId: string;
	sourceShortId: string;
}> {
	const { transaction, recordGiftRevisions: recordRevisions } = context;
	const { plans } = preparedCopy;
	// An already linked source's group is locked first, in the order every linked edit locks in.
	await lockLinkedCopies(transaction, input.giftIds, {
		wishlistIds: [input.sourceWishlistId, input.destinationWishlistId],
		heldWishlistLocks: context.heldWishlistLocks,
	});
	// Copies between two wishlists in opposite directions would otherwise deadlock.
	await lockWishlistsInIdOrder(transaction, [
		input.sourceWishlistId,
		input.destinationWishlistId,
	]);
	const source = await assertManagedWishlist(transaction, actorId, input.sourceWishlistId, true);
	assertSourceRemovalAllowed(actorId, source, input);
	const destination = await assertManagedWishlist(
		transaction,
		actorId,
		input.destinationWishlistId,
		true,
	);
	const linksCopies = copiesLink(input, source, destination);
	const sourceRows = await loadSourceGifts(transaction, input, true);
	if (sourceRows.some((source, index) => !galleryKeysMatch(source, plans[index]!.source))) {
		error(400, SERVER_ERROR.BULK_COPY_INVALID_SELECTION);
	}
	// A shared gift (issue #737) never takes in a second list of one recipient: it copies unlinked.
	const linkGroupKinds = await loadLinkGroupKinds(
		transaction,
		sourceRows.map((row) => row.linkGroupId),
	);
	const sharedSourceIds = new Set(
		sourceRows
			.filter(
				(row) =>
					row.linkGroupId !== null &&
					linkGroupKinds.get(row.linkGroupId) ===
						GIFT_LINK_GROUP_KIND.sharedAcrossRecipients,
			)
			.map((row) => row.id),
	);
	if (linksCopies && input.linkCopies === true && sharedSourceIds.size > 0) {
		error(400, SERVER_ERROR.BULK_COPY_LINK_NOT_ALLOWED);
	}
	// A move removes the unreserved sources afterwards, so only the reserved ones stay to link with.
	const reservedSourceIds =
		linksCopies && input.removeUnreservedSources === true
			? await loadReservedGiftIds(transaction, input.giftIds)
			: undefined;
	const linkedSourceIds = new Set(
		linksCopies
			? sourceRows
					.filter((row) => !sharedSourceIds.has(row.id))
					.filter((row) => reservedSourceIds?.has(row.id) ?? true)
					.map((row) => row.id)
			: [],
	);
	const sourcePriorities = await transaction
		.select({ id: priorityLevel.id })
		.from(priorityLevel)
		.where(eq(priorityLevel.wishlistId, input.sourceWishlistId))
		.orderBy(priorityLevel.sortOrder);
	const destinationPriorities = await transaction
		.select({ id: priorityLevel.id })
		.from(priorityLevel)
		.where(eq(priorityLevel.wishlistId, input.destinationWishlistId))
		.orderBy(priorityLevel.sortOrder);
	const destinationCategories = await addMissingCopiedCategories(
		transaction,
		input.destinationWishlistId,
		sourceRows.flatMap((source) => source.categories),
	);
	const sourcePriorityIds = sourcePriorities.map((level) => level.id);
	const copied = sourceRows.map((source, index) => {
		const taxonomy = mapCopiedTaxonomy({
			source,
			sourcePriorityIdsByOrdinal: sourcePriorityIds,
			destinationPriorities,
			destinationCategories,
		});
		return portableGiftCopy({
			source,
			destinationGiftId: plans[index]!.destinationGiftId,
			destinationImageKeys: plans[index]!.destinationImageKeys,
			taxonomy,
			linked: linkedSourceIds.has(source.id),
		});
	});
	const created = await appendGiftsUsingTransaction(transaction, {
		wishlistId: input.destinationWishlistId,
		actorId,
		gifts: copied,
		notifyFollowers: destination.status === 'active',
		recordRevisions,
	});
	const linkedCopies = await linkCopiesWithSources(
		transaction,
		sourceRows.flatMap((sourceRow, index) =>
			linkedSourceIds.has(sourceRow.id) ? [{ source: sourceRow, copy: created[index]! }] : [],
		),
		recordRevisions,
	);
	const linkedCopyById = new Map(linkedCopies.map((row) => [row.id, row]));
	return {
		created: created.map((row) => linkedCopyById.get(row.id) ?? row),
		linkedIds: linkedCopies.map((row) => row.id),
		destinationShortId: destination.shortId,
		sourceShortId: source.shortId,
	};
}
