import * as v from 'valibot';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { generateId } from '$lib/server/db/id.js';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftCategory } from '$lib/server/db/gift.schema.js';
import { giftIngestionOrphan } from '$lib/server/db/ingestion.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { getObject, putObject, deleteObject } from '$lib/server/storage/r2.js';
import { normalizeGiftCategoryLabel } from '$lib/modules/gift-categories/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	appendGiftsUsingTransaction,
	type GiftCreationTransaction,
} from './gift_creation_service.js';
import type { DescriptionAppend } from './types.js';

export const MAX_BULK_COPY_GIFTS = 50;

export const BulkCopyGiftsInputSchema = v.strictObject({
	sourceWishlistId: v.string(),
	destinationWishlistId: v.string(),
	giftIds: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(MAX_BULK_COPY_GIFTS)),
});

export type BulkCopyGiftsInput = v.InferOutput<typeof BulkCopyGiftsInputSchema>;

type Database = ReturnType<typeof getDb>;
type Transaction = GiftCreationTransaction;
type SourceGift = typeof gift.$inferSelect & {
	categoryPresetKey: string | null;
	categoryCustomLabel: string | null;
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

export function portableGiftCopy(input: {
	source: SourceGift;
	destinationGiftId: string;
	destinationImageKey: string | null;
	taxonomy: { priorityLevelId: string | null; categoryId: string | null };
}) {
	return {
		id: input.destinationGiftId,
		name: input.source.name,
		description: flattenGiftDescription(
			input.source.description,
			input.source.descriptionAppends,
		),
		links: input.source.links,
		price: input.source.price,
		priceMax: input.source.priceMax,
		currency: input.source.currency,
		quantity: input.source.quantity,
		imageUrl: input.source.imageUrl,
		imageKey: input.destinationImageKey,
		imageMeta: input.source.imageMeta,
		...input.taxonomy,
	};
}

export function mapCopiedTaxonomy(input: {
	source: SourceGift;
	sourcePriorityIdsByOrdinal: readonly string[];
	destinationPriorities: readonly { id: string }[];
	destinationCategories: readonly {
		id: string;
		presetKey: string | null;
		customLabel: string | null;
	}[];
}): { priorityLevelId: string | null; categoryId: string | null } {
	const priorityOrdinal =
		input.source.priorityLevelId === null
			? -1
			: input.sourcePriorityIdsByOrdinal.indexOf(input.source.priorityLevelId);
	let categoryId: string | null = null;
	if (input.source.categoryPresetKey !== null) {
		categoryId =
			input.destinationCategories.find(
				(category) => category.presetKey === input.source.categoryPresetKey,
			)?.id ?? null;
	} else if (input.source.categoryCustomLabel !== null) {
		const normalizedSourceLabel = normalizeGiftCategoryLabel(input.source.categoryCustomLabel);
		categoryId =
			input.destinationCategories.find(
				(category) =>
					category.customLabel !== null &&
					normalizeGiftCategoryLabel(category.customLabel) === normalizedSourceLabel,
			)?.id ?? null;
	}
	return {
		priorityLevelId:
			priorityOrdinal < 0 ? null : (input.destinationPriorities[priorityOrdinal]?.id ?? null),
		categoryId,
	};
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
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
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

async function loadSourceGifts(
	database: Database | Transaction,
	input: BulkCopyGiftsInput,
	lock: boolean,
): Promise<SourceGift[]> {
	const query = database
		.select({
			gift,
			categoryPresetKey: giftCategory.presetKey,
			categoryCustomLabel: giftCategory.customLabel,
		})
		.from(gift)
		.leftJoin(
			giftCategory,
			and(
				eq(gift.categoryId, giftCategory.id),
				eq(gift.wishlistId, giftCategory.wishlistId),
				isNull(giftCategory.deletedAt),
			),
		)
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
			{
				...row.gift,
				categoryPresetKey: row.categoryPresetKey,
				categoryCustomLabel: row.categoryCustomLabel,
			},
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

export async function copyGifts(
	actorId: string,
	input: BulkCopyGiftsInput,
	options: { database?: Database } = {},
) {
	if (
		input.sourceWishlistId === input.destinationWishlistId ||
		new Set(input.giftIds).size !== input.giftIds.length
	) {
		error(400, SERVER_ERROR.BULK_COPY_INVALID_SELECTION);
	}
	const database = options.database ?? getDb();
	await assertManagedWishlist(database, actorId, input.sourceWishlistId, false);
	await assertManagedWishlist(database, actorId, input.destinationWishlistId, false);
	const preflightGifts = await loadSourceGifts(database, input, false);
	const operationId = generateId();
	const plans = preflightGifts.map((source) => {
		const destinationGiftId = generateId();
		return {
			source,
			destinationGiftId,
			destinationImageKey:
				source.imageKey === null
					? null
					: copiedObjectKey(destinationGiftId, source.imageKey),
		};
	});
	const imagePlans = plans.filter(
		(plan): plan is typeof plan & { destinationImageKey: string } =>
			plan.destinationImageKey !== null,
	);
	const journalRows =
		imagePlans.length === 0
			? []
			: await database
					.insert(giftIngestionOrphan)
					.values(
						imagePlans.map((plan) => ({
							manifestId: `bulk-copy:${operationId}`,
							itemId: plan.source.id,
							objectKey: plan.destinationImageKey,
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
	try {
		for (const plan of imagePlans) {
			const journalId = journalIdByKey.get(plan.destinationImageKey)!;
			attemptedJournalIds.add(journalId);
			await stageCopiedImage(plan.source.imageKey!, plan.destinationImageKey);
			staged.push({ key: plan.destinationImageKey, journalId });
		}
		const result = await database.transaction(async (tx) => {
			await assertManagedWishlist(tx, actorId, input.sourceWishlistId, true);
			const destination = await assertManagedWishlist(
				tx,
				actorId,
				input.destinationWishlistId,
				true,
			);
			const sourceRows = await loadSourceGifts(tx, input, true);
			if (
				sourceRows.some(
					(source, index) => source.imageKey !== plans[index]!.source.imageKey,
				)
			) {
				error(400, SERVER_ERROR.BULK_COPY_INVALID_SELECTION);
			}
			const sourcePriorities = await tx
				.select({ id: priorityLevel.id })
				.from(priorityLevel)
				.where(eq(priorityLevel.wishlistId, input.sourceWishlistId))
				.orderBy(priorityLevel.sortOrder);
			const destinationPriorities = await tx
				.select({ id: priorityLevel.id })
				.from(priorityLevel)
				.where(eq(priorityLevel.wishlistId, input.destinationWishlistId))
				.orderBy(priorityLevel.sortOrder);
			const destinationCategories = await tx
				.select({
					id: giftCategory.id,
					presetKey: giftCategory.presetKey,
					customLabel: giftCategory.customLabel,
				})
				.from(giftCategory)
				.where(
					and(
						eq(giftCategory.wishlistId, input.destinationWishlistId),
						isNull(giftCategory.deletedAt),
					),
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
					destinationImageKey: plans[index]!.destinationImageKey,
					taxonomy,
				});
			});
			const created = await appendGiftsUsingTransaction(tx, {
				wishlistId: input.destinationWishlistId,
				actorId,
				gifts: copied,
				notifyFollowers: destination.status === 'active',
			});
			return { created, destinationShortId: destination.shortId };
		});
		try {
			await markJournalResolved(
				database,
				journalRows.map((row) => row.id),
			);
		} catch (thrown) {
			console.error('[Bulk gift copy] could not close staging journal', thrown);
		}
		return result;
	} catch (thrown) {
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
			console.error('[Bulk gift copy] could not close unused staging journal', cleanupError);
		}
		throw thrown;
	}
}
