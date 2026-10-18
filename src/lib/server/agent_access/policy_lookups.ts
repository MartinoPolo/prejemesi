import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DatabaseTransaction, getDb } from '$lib/server/db/index.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { giftRevision } from '$lib/server/db/gift_revision.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';

export type LookupDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

/** What an operation input names, each kind resolving to the wishlists it belongs to. */
export const TARGET_KIND = {
	wishlistId: 'wishlistId',
	wishlistShortId: 'wishlistShortId',
	/** Soft-deleted gifts count too: undo restores them on their own wishlist. */
	giftId: 'giftId',
	reservationId: 'reservationId',
	/** Every wishlist the batch's gift revisions belong to. */
	revisionBatchId: 'revisionBatchId',
} as const;

export type TargetKind = (typeof TARGET_KIND)[keyof typeof TARGET_KIND];

export interface TargetReference {
	kind: TargetKind;
	id: string;
}

/** Whether a call needs the user's explicit confirmation, or the revisions that decide it. */
export type ConfirmationRule =
	| boolean
	| { undoesGiftCreationsOfBatch: string }
	| { undoesGiftCreationOfGift: string };

/**
 * A revision without a `before` state recorded its gift's creation, so undoing it deletes the
 * gift (see `undoRevisions`).
 */
const recordsGiftCreation = isNull(giftRevision.before);

interface WishlistOfReference {
	referenceId: string;
	wishlistId: string;
}

const WISHLISTS_OF_REFERENCES = {
	[TARGET_KIND.wishlistId]: async (_database, referenceIds) =>
		referenceIds.map((referenceId) => ({ referenceId, wishlistId: referenceId })),
	[TARGET_KIND.wishlistShortId]: (database, referenceIds) =>
		database
			.select({ referenceId: wishlist.shortId, wishlistId: wishlist.id })
			.from(wishlist)
			.where(inArray(wishlist.shortId, referenceIds)),
	[TARGET_KIND.giftId]: (database, referenceIds) =>
		database
			.select({ referenceId: gift.id, wishlistId: gift.wishlistId })
			.from(gift)
			.where(inArray(gift.id, referenceIds)),
	[TARGET_KIND.reservationId]: (database, referenceIds) =>
		database
			.select({ referenceId: reservation.id, wishlistId: gift.wishlistId })
			.from(reservation)
			.innerJoin(gift, eq(reservation.giftId, gift.id))
			.where(inArray(reservation.id, referenceIds)),
	[TARGET_KIND.revisionBatchId]: (database, referenceIds) =>
		database
			.selectDistinct({
				referenceId: giftRevision.batchId,
				wishlistId: giftRevision.wishlistId,
			})
			.from(giftRevision)
			.where(inArray(giftRevision.batchId, referenceIds)),
} satisfies Record<
	TargetKind,
	(database: LookupDatabase, referenceIds: string[]) => Promise<WishlistOfReference[]>
>;

/**
 * The wishlists each step's references belong to, in reference order; a reference that does not
 * exist contributes none. One query per reference kind, however many steps name it.
 */
export async function resolveTargetWishlistIds(
	database: LookupDatabase,
	referencesPerStep: readonly (readonly TargetReference[])[],
): Promise<string[][]> {
	const referenceIdsByKind = new Map<TargetKind, Set<string>>();
	for (const reference of referencesPerStep.flat()) {
		const referenceIds = referenceIdsByKind.get(reference.kind) ?? new Set<string>();
		referenceIds.add(reference.id);
		referenceIdsByKind.set(reference.kind, referenceIds);
	}
	const wishlistIdsByReference = new Map<string, string[]>();
	for (const [kind, referenceIds] of referenceIdsByKind) {
		for (const row of await WISHLISTS_OF_REFERENCES[kind](database, [...referenceIds])) {
			const key = `${kind}:${row.referenceId}`;
			wishlistIdsByReference.set(key, [
				...(wishlistIdsByReference.get(key) ?? []),
				row.wishlistId,
			]);
		}
	}
	return referencesPerStep.map((references) => [
		...new Set(
			references.flatMap(
				(reference) =>
					wishlistIdsByReference.get(`${reference.kind}:${reference.id}`) ?? [],
			),
		),
	]);
}

/** Batches with at least one creation revision: a batch undo restores every gift it touched. */
async function batchesUndoingGiftCreations(
	database: LookupDatabase,
	batchIds: string[],
): Promise<Set<string>> {
	if (batchIds.length === 0) {
		return new Set();
	}
	const rows = await database
		.selectDistinct({ batchId: giftRevision.batchId })
		.from(giftRevision)
		.where(and(inArray(giftRevision.batchId, batchIds), recordsGiftCreation));
	return new Set(rows.map((row) => row.batchId));
}

/** Gifts whose latest revision, the one a single-gift undo reverts, recorded their creation. */
async function giftsUndoingTheirCreation(
	database: LookupDatabase,
	giftIds: string[],
): Promise<Set<string>> {
	if (giftIds.length === 0) {
		return new Set();
	}
	const latestRevisions = await database
		.selectDistinctOn([giftRevision.giftId], {
			giftId: giftRevision.giftId,
			recordsGiftCreation: sql<boolean>`${recordsGiftCreation}`.mapWith(Boolean),
		})
		.from(giftRevision)
		.where(inArray(giftRevision.giftId, giftIds))
		.orderBy(asc(giftRevision.giftId), desc(giftRevision.createdAt), desc(giftRevision.id));
	return new Set(
		latestRevisions
			.filter((revision) => revision.recordsGiftCreation)
			.map((revision) => revision.giftId),
	);
}

/** Each step's confirmation requirement; one query per revision lookup kind. */
export async function resolveConfirmations(
	database: LookupDatabase,
	rules: readonly ConfirmationRule[],
): Promise<boolean[]> {
	const batchIds = new Set<string>();
	const giftIds = new Set<string>();
	for (const rule of rules) {
		if (typeof rule === 'boolean') {
			continue;
		}
		if ('undoesGiftCreationsOfBatch' in rule) {
			batchIds.add(rule.undoesGiftCreationsOfBatch);
		} else {
			giftIds.add(rule.undoesGiftCreationOfGift);
		}
	}
	const creatingBatchIds = await batchesUndoingGiftCreations(database, [...batchIds]);
	const creatingGiftIds = await giftsUndoingTheirCreation(database, [...giftIds]);
	return rules.map((rule) => {
		if (typeof rule === 'boolean') {
			return rule;
		}
		return 'undoesGiftCreationsOfBatch' in rule
			? creatingBatchIds.has(rule.undoesGiftCreationsOfBatch)
			: creatingGiftIds.has(rule.undoesGiftCreationOfGift);
	});
}
