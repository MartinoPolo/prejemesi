import { and, asc, eq, isNull } from 'drizzle-orm';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { rejectDemoOperation } from '$lib/server/demo/scope.js';
import {
	DEFAULT_GIFT_CURRENCY,
	DRAFT_PRIORITY,
	type DraftPriority,
	type GiftDraftInput,
} from '$lib/modules/gifts/types.js';
import {
	appendGiftsUsingTransaction,
	type NormalizedGiftCreationInput,
} from '$lib/modules/gifts/gift_creation_service.js';
import { mapGiftCreationError } from '$lib/modules/gifts/gift_creation_transport.js';
import { canonicalGiftLinkKey } from '$lib/modules/gifts/gift_url.js';
import { resolveImportGiftCategoryAssignments } from '$lib/modules/gift-categories/gift_categories_service.js';
import { seedNewWishlist } from '$lib/modules/wishlists/wishlist_create.js';
import {
	CreateWishlistFromImportInputSchema,
	ImportGiftsInputSchema,
	type ImportCategoryResolution,
	type ImportGiftsInput,
} from '$lib/modules/import/import_types.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import { requireMutableManagedWishlist } from './wishlist_management.js';

export type ImportGiftsResult =
	| { status: 'duplicate-warning'; duplicateIndexes: number[] }
	| { status: 'created'; gifts: { id: string }[] };

type SelectExecutor = Pick<DatabaseTransaction, 'select'>;

function draftToGiftInput(
	draft: GiftDraftInput,
	priorityLevelId: string | null,
	categoryId: string | null,
): NormalizedGiftCreationInput {
	return {
		name: draft.name,
		description: draft.description ?? null,
		links: draft.links,
		price: draft.price ?? null,
		priceMax: draft.priceMax ?? null,
		currency: draft.currency ?? DEFAULT_GIFT_CURRENCY,
		imageUrl: draft.imageUrl,
		quantity: draft.quantity,
		priorityLevelId,
		categoryId,
	};
}

function resolvedDraftCategoryId(
	draft: GiftDraftInput,
	resolvedImportedCategories: ReadonlyMap<string, string>,
): string | null {
	if (draft.categoryId != null && draft.categoryId !== '') {
		return draft.categoryId;
	}
	const importedLabel = draft.importedCategoryLabel?.trim() ?? '';
	return importedLabel === '' ? null : (resolvedImportedCategories.get(importedLabel) ?? null);
}

/**
 * Resolve a draft's binary priority to a concrete priority-level id by rank:
 * high → lowest sortOrder, medium → second. Returns null when the needed rank
 * is absent (the grid hides the toggle in that case — this is a safety net).
 */
function resolvePriorityLevelId(
	priority: DraftPriority,
	rankedLevelIds: readonly string[],
): string | null {
	const rank = priority === DRAFT_PRIORITY.high ? 0 : 1;
	return rankedLevelIds[rank] ?? null;
}

/** Priority-level ids for a wishlist, ranked by sortOrder (index 0 = highest priority). */
async function rankedPriorityLevelIds(
	database: SelectExecutor,
	wishlistId: string,
): Promise<string[]> {
	const rows = await database
		.select({ id: priorityLevel.id })
		.from(priorityLevel)
		.where(eq(priorityLevel.wishlistId, wishlistId))
		.orderBy(asc(priorityLevel.sortOrder));
	return rows.map((row) => row.id);
}

/**
 * Defense-in-depth duplicate advisory at the server boundary. The review grid
 * catches ordinary duplicates; this query catches stale or racing matches and
 * requires a separate explicit retry before preserving every reviewed row.
 */
async function findCanonicalLinkDuplicateIndexes(
	database: SelectExecutor,
	wishlistId: string,
	drafts: readonly GiftDraftInput[],
): Promise<number[]> {
	const draftKeySets = drafts.map(
		(draft) =>
			new Set(
				(draft.links ?? [])
					.map((link) => canonicalGiftLinkKey(link.url))
					.filter((key): key is string => key !== null),
			),
	);
	if (draftKeySets.every((keys) => keys.size === 0)) {
		return [];
	}

	const existing = await database
		.select({ links: gift.links })
		.from(gift)
		.where(and(eq(gift.wishlistId, wishlistId), isNull(gift.deletedAt)));
	const existingKeys = new Set(
		existing.flatMap((row) =>
			(row.links ?? [])
				.map((link) => canonicalGiftLinkKey(link.url))
				.filter((key): key is string => key !== null),
		),
	);
	return draftKeySets.flatMap((keys, index) =>
		[...keys].some((key) => existingKeys.has(key)) ? [index] : [],
	);
}

/** Appends the drafts with their resolved priority and category; created gifts get revisions. */
async function appendImportedDrafts(
	context: MutationOperationContext,
	params: {
		wishlistId: string;
		rankedLevelIds: readonly string[];
		drafts: readonly GiftDraftInput[];
		categoryResolutions: readonly ImportCategoryResolution[];
		notifyFollowers: boolean;
	},
): Promise<{ id: string }[]> {
	const resolvedImportedCategories = await resolveImportGiftCategoryAssignments({
		database: context.transaction,
		wishlistId: params.wishlistId,
		drafts: params.drafts,
		resolutions: params.categoryResolutions,
	});
	return appendGiftsUsingTransaction(context.transaction, {
		wishlistId: params.wishlistId,
		actorId: context.actor.userId,
		notifyFollowers: params.notifyFollowers,
		recordRevisions: context.recordGiftRevisions,
		gifts: params.drafts.map((draft) =>
			draftToGiftInput(
				draft,
				resolvePriorityLevelId(draft.priority, params.rankedLevelIds),
				resolvedDraftCategoryId(draft, resolvedImportedCategories),
			),
		),
	});
}

async function importDraftsIntoWishlist(
	context: MutationOperationContext,
	input: ImportGiftsInput,
): Promise<ImportGiftsResult> {
	// Serializes concurrent imports so the duplicate advisory sees committed gifts.
	await context.transaction
		.select({ id: wishlist.id })
		.from(wishlist)
		.where(eq(wishlist.id, input.wishlistId))
		.limit(1)
		.for('update');
	const rankedLevelIds = await rankedPriorityLevelIds(context.transaction, input.wishlistId);
	const duplicateIndexes = await findCanonicalLinkDuplicateIndexes(
		context.transaction,
		input.wishlistId,
		input.gifts,
	);
	if (duplicateIndexes.length > 0 && !input.acknowledgeDuplicates) {
		return { status: 'duplicate-warning', duplicateIndexes };
	}
	const gifts = await appendImportedDrafts(context, {
		wishlistId: input.wishlistId,
		rankedLevelIds,
		drafts: input.gifts,
		categoryResolutions: input.categoryResolutions,
		notifyFollowers: true,
	});
	return { status: 'created', gifts };
}

/**
 * Appends imported drafts after the wishlist's current gifts in one step. Links already on the
 * list return a duplicate warning until the caller acknowledges them.
 */
export const importGiftsOperation = defineOperation({
	name: 'importGifts',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: ImportGiftsInputSchema,
	async run(context, input) {
		rejectDemoOperation();
		const wishlistRow = await requireMutableManagedWishlist(context, input.wishlistId, {
			lock: false,
		});
		if (input.gifts.length === 0) {
			const outcome: ImportGiftsResult = { status: 'created', gifts: [] };
			return { outcome, wishlistShortId: wishlistRow.shortId };
		}
		try {
			const outcome = await importDraftsIntoWishlist(context, input);
			return { outcome, wishlistShortId: wishlistRow.shortId };
		} catch (thrown) {
			mapGiftCreationError(thrown);
		}
	},
});

/** Creates a draft wishlist seeded with the imported drafts; followers are not notified. */
export const createWishlistFromImportOperation = defineOperation({
	name: 'createWishlistFromImport',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: CreateWishlistFromImportInputSchema,
	async run(context, input) {
		rejectDemoOperation();
		const created = await seedNewWishlist(context.transaction, context.actor.userId, input);
		if (input.gifts.length > 0) {
			await appendImportedDrafts(context, {
				wishlistId: created.id,
				rankedLevelIds: await rankedPriorityLevelIds(context.transaction, created.id),
				drafts: input.gifts,
				categoryResolutions: input.categoryResolutions,
				notifyFollowers: false,
			});
		}
		return created;
	},
});
