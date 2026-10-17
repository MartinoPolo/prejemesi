import { asc, desc, eq, gt, inArray, and } from 'drizzle-orm';
import { gift } from '$lib/server/db/gift.schema.js';
import { giftRevision } from '$lib/server/db/gift_revision.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import {
	CHANGE_KIND,
	type ChangeKind,
	type ChangeKindCounts,
	type ChangeRowConflict,
	type ChangeRowError,
} from '$lib/modules/change_proposals/types.js';
import {
	giftRevisionSnapshotsDiffer,
	toGiftRevisionSnapshot,
	type GiftRevisionSnapshot,
} from '$lib/server/operations/gift_revision_snapshot.js';
import {
	toOperationStepRejection,
	type OperationStepRejection,
} from '$lib/server/operations/runner.js';
import { reorderGiftsOperation } from '$lib/server/operations/gift_bulk_operations.js';
import {
	saveGiftCategorySettingsOperation,
	savePriorityLevelsOperation,
} from '$lib/server/operations/gift_grouping_operations.js';
import {
	createWishlistOperation,
	renameRecipientOperation,
	saveWishlistSettingsOperation,
	setWishlistPaletteOperation,
	updateWishlistOperation,
} from '$lib/server/operations/wishlist_detail_operations.js';
import {
	cancelOwnReservationOperation,
	setReservationPurchasedOperation,
} from '$lib/server/operations/reservation_operations.js';
import { createWishlistFromImportOperation } from '$lib/server/operations/import_operations.js';
import type { OperationName } from './operation_policies.js';
import type { StoredChangeRow } from './change_proposal_records.js';
import { TARGET_KIND, type LookupDatabase, type TargetReference } from './policy_lookups.js';
import { projectAgentGiftSnapshot } from './read_projections.js';
import { describeServerError } from './server_error_description.js';

/** What each agent mutation does, for the review page's badges and summary counts. */
const CHANGE_KIND_BY_OPERATION = {
	createGift: CHANGE_KIND.giftCreation,
	importGifts: CHANGE_KIND.giftCreation,
	bulkCopyGifts: CHANGE_KIND.giftCreation,
	updateGift: CHANGE_KIND.giftEdit,
	bulkUpdateGifts: CHANGE_KIND.giftEdit,
	appendGiftDescription: CHANGE_KIND.descriptionAppend,
	deleteGift: CHANGE_KIND.giftDeletion,
	markGiftReceived: CHANGE_KIND.received,
	reorderGifts: CHANGE_KIND.reorder,
	saveGiftCategorySettings: CHANGE_KIND.category,
	savePriorityLevels: CHANGE_KIND.priorityLevel,
	reserveGift: CHANGE_KIND.reservation,
	cancelOwnReservation: CHANGE_KIND.reservation,
	setReservationPurchased: CHANGE_KIND.reservation,
	generateModeratorInviteLink: CHANGE_KIND.managerInvitation,
	updateWishlist: CHANGE_KIND.wishlistDetails,
	renameRecipient: CHANGE_KIND.wishlistDetails,
	setWishlistPalette: CHANGE_KIND.wishlistDetails,
	saveWishlistSettings: CHANGE_KIND.wishlistDetails,
	createWishlist: CHANGE_KIND.wishlistCreation,
	createWishlistFromImport: CHANGE_KIND.wishlistCreation,
	undoGiftRevisionBatch: CHANGE_KIND.undo,
	undoGiftRevision: CHANGE_KIND.undo,
} as const satisfies Partial<Record<OperationName, ChangeKind>>;

const CHANGE_KINDS = new Map<string, ChangeKind>(Object.entries(CHANGE_KIND_BY_OPERATION));

export function changeKindOf(operationName: string): ChangeKind {
	const kind = CHANGE_KINDS.get(operationName);
	if (kind === undefined) {
		throw new Error(`No change kind for operation ${operationName}`);
	}
	return kind;
}

export function countChangeKinds(rows: readonly Pick<StoredChangeRow, 'operation'>[]) {
	const counts: ChangeKindCounts = {};
	for (const row of rows) {
		const kind = changeKindOf(row.operation);
		counts[kind] = (counts[kind] ?? 0) + 1;
	}
	return counts;
}

/**
 * Operations whose effect the proposal undo cannot reverse: gift revisions leave out ordering,
 * categories, priority levels and wishlist details, and a reservation's cancellation or purchase
 * mark has no inverse operation. Undo refuses a batch with any of them rather than undo part of it.
 */
const UNDO_UNSUPPORTED_OPERATIONS = new Set<string>([
	reorderGiftsOperation.name,
	saveGiftCategorySettingsOperation.name,
	savePriorityLevelsOperation.name,
	updateWishlistOperation.name,
	renameRecipientOperation.name,
	setWishlistPaletteOperation.name,
	saveWishlistSettingsOperation.name,
	cancelOwnReservationOperation.name,
	setReservationPurchasedOperation.name,
	createWishlistOperation.name,
	createWishlistFromImportOperation.name,
]);

export function undoSupportsOperation(operationName: string): boolean {
	return !UNDO_UNSUPPORTED_OPERATIONS.has(operationName);
}

/** A core rejection in the API's error shape: status, code and the code's parameters. */
export function toChangeRowError(rejection: OperationStepRejection): ChangeRowError {
	const { code, details } = describeServerError(rejection.status, rejection.message);
	return { status: rejection.status, code, details };
}

/** A client error the core threw, as a row error; null for a defect, which stays thrown. */
export function changeRowErrorOf(thrown: unknown): ChangeRowError | null {
	const rejection = toOperationStepRejection(thrown);
	return rejection === null ? null : toChangeRowError(rejection);
}

/** The gifts as they are now, soft-deleted ones included; a gift that no longer exists is absent. */
export async function readGiftSnapshots(
	database: LookupDatabase,
	giftIds: readonly string[],
): Promise<Map<string, GiftRevisionSnapshot>> {
	if (giftIds.length === 0) {
		return new Map();
	}
	const giftRows = await database
		.select()
		.from(gift)
		.where(inArray(gift.id, [...giftIds]));
	return new Map(giftRows.map((giftRow) => [giftRow.id, toGiftRevisionSnapshot(giftRow)]));
}

/**
 * The gifts a row's conflict check compares: the gifts it names, and the existing gifts its dry
 * run changed (a bulk edit, removed copy sources, an undo). Gifts the row creates have no baseline.
 */
export function baselineGiftIds(
	targets: readonly TargetReference[],
	giftChanges: readonly { giftId: string; before: unknown }[],
): string[] {
	return [
		...new Set([
			...targets
				.filter((target) => target.kind === TARGET_KIND.giftId)
				.map((target) => target.id),
			...giftChanges
				.filter((change) => change.before !== null)
				.map((change) => change.giftId),
		]),
	];
}

/** Baseline gifts that changed since submission or no longer exist, per row. */
function conflictingGiftIdsByRow(
	rows: readonly StoredChangeRow[],
	currentSnapshots: ReadonlyMap<string, GiftRevisionSnapshot>,
): Map<string, string[]> {
	const conflicts = new Map<string, string[]>();
	for (const row of rows) {
		const giftIds = row.baseline
			.filter((baseline) => {
				const current = currentSnapshots.get(baseline.giftId);
				return (
					current === undefined || giftRevisionSnapshotsDiffer(current, baseline.snapshot)
				);
			})
			.map((baseline) => baseline.giftId);
		if (giftIds.length > 0) {
			conflicts.set(row.rowId, giftIds);
		}
	}
	return conflicts;
}

/** Checks rows against the current gifts; under the wishlist locks during apply, live otherwise. */
export async function findConflictingGiftIds(
	database: LookupDatabase,
	rows: readonly StoredChangeRow[],
): Promise<{
	conflicts: Map<string, string[]>;
	currentSnapshots: Map<string, GiftRevisionSnapshot>;
}> {
	const currentSnapshots = await readGiftSnapshots(database, [
		...new Set(rows.flatMap((row) => row.baseline.map((baseline) => baseline.giftId))),
	]);
	return { conflicts: conflictingGiftIdsByRow(rows, currentSnapshots), currentSnapshots };
}

/** Who last changed each gift after the given time, from the gift revision history. */
async function readLatestChanges(
	database: LookupDatabase,
	giftIds: readonly string[],
	since: Date,
): Promise<Map<string, { changedByName: string | null; changedAt: Date }>> {
	if (giftIds.length === 0) {
		return new Map();
	}
	const latestRevisions = await database
		.selectDistinctOn([giftRevision.giftId], {
			giftId: giftRevision.giftId,
			changedAt: giftRevision.createdAt,
			changedByName: user.name,
		})
		.from(giftRevision)
		.leftJoin(user, eq(user.id, giftRevision.actorUserId))
		.where(and(inArray(giftRevision.giftId, [...giftIds]), gt(giftRevision.createdAt, since)))
		.orderBy(asc(giftRevision.giftId), desc(giftRevision.createdAt), desc(giftRevision.id));
	return new Map(
		latestRevisions.map((revision) => [
			revision.giftId,
			{ changedByName: revision.changedByName, changedAt: revision.changedAt },
		]),
	);
}

/** Each conflicting row's changed gifts with who changed them and how they look now. */
export async function describeConflicts(
	database: LookupDatabase,
	conflicts: ReadonlyMap<string, readonly string[]>,
	currentSnapshots: ReadonlyMap<string, GiftRevisionSnapshot>,
	since: Date,
): Promise<Map<string, ChangeRowConflict[]>> {
	const latestChanges = await readLatestChanges(
		database,
		[...new Set([...conflicts.values()].flat())],
		since,
	);
	return new Map(
		[...conflicts].map(([rowId, giftIds]) => [
			rowId,
			giftIds.map((giftId) => {
				const current = currentSnapshots.get(giftId);
				return {
					giftId,
					changedByName: latestChanges.get(giftId)?.changedByName ?? null,
					changedAt: latestChanges.get(giftId)?.changedAt ?? null,
					current: current === undefined ? null : projectAgentGiftSnapshot(current),
				};
			}),
		]),
	);
}
