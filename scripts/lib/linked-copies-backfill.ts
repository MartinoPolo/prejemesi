import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';
import { user } from '../../src/lib/server/db/auth.schema.js';
import { gift, reservation } from '../../src/lib/server/db/gift.schema.js';
import { wishlist } from '../../src/lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '../../src/lib/server/db/moderator.schema.js';
import { GIFT_LINK_GROUP_KIND } from '../../src/lib/server/db/enums.js';
import { generateId } from '../../src/lib/server/db/id.js';
import type { DatabaseTransaction } from '../../src/lib/server/db/index.js';
import { activeGiftCategoriesColumn } from '../../src/lib/modules/gift-categories/gift_categories_service.js';
import { releasedImageKeys } from '../../src/lib/modules/gifts/gift_images.js';
import { jsonChanged } from '../../src/lib/modules/gifts/gift_post_share.js';
import { WISHLIST_KIND, WISHLIST_ROLES } from '../../src/lib/modules/wishlists/types.js';
import { tokenChannel, type OperationActor } from '../../src/lib/server/operations/actor.js';
import { giftColumnsWithImages } from '../../src/lib/server/operations/gift_gallery.js';
import {
	createLinkGroup,
	lockLinkedCopies,
	lockWishlistsWithLinkedCopies,
	wishlistsShareRecipient,
	type HeldWishlistLocks,
} from '../../src/lib/server/operations/gift_link_group.js';
import {
	linkedGiftEdit,
	propagateToLinkedCopies,
} from '../../src/lib/server/operations/gift_link_group_sync.js';
import type { GiftRow } from '../../src/lib/server/operations/gift_presentation_update.js';
import { GiftRevisionCollector } from '../../src/lib/server/operations/gift_revisions.js';
import type { MutationOperationContext } from '../../src/lib/server/operations/operation.js';
import type { WishlistRow } from '../../src/lib/server/operations/wishlist_management.js';
import {
	giftsMatchedInSeveralPairs,
	matchPairGifts,
	receivedMerge,
	reservationConflict,
	type BackfillGift,
	type LinkedCopiesPlan,
	type PlannedGift,
	type PlannedPair,
	type PlannedWishlist,
	type ReceivedMerge,
	type ReservationConflict,
	type ReviewedMatch,
	type ReviewedPair,
	type ReviewedPlan,
} from './linked-copies-plan.js';

export type BackfillDatabase = ReturnType<typeof drizzle>;

const BACKFILL_OPERATION_NAME = 'linkExistingGiftCopies';
const BACKFILL_CHANNEL = tokenChannel('linked-copies-backfill');

export interface BackfillOwner {
	id: string;
	email: string;
	name: string;
}

/** An owner by account id or email. */
export async function findOwner(
	database: BackfillDatabase,
	emailOrId: string,
): Promise<BackfillOwner | undefined> {
	const [owner] = await database
		.select({ id: user.id, email: user.email, name: user.name })
		.from(user)
		.where(or(eq(user.id, emailOrId), eq(user.email, emailOrId.trim().toLowerCase())))
		.limit(1);
	return owner;
}

function managedByOwner(ownerId: string) {
	const assignedWishlistIds = sql`(
		SELECT ${moderatorAssignment.wishlistId} FROM ${moderatorAssignment}
		WHERE ${moderatorAssignment.userId} = ${ownerId} AND ${moderatorAssignment.deletedAt} IS NULL
	)`;
	return or(eq(wishlist.recipientUserId, ownerId), inArray(wishlist.id, assignedWishlistIds));
}

/** Live wishlists the owner manages as their linked recipient or an active správce. */
async function loadManagedWishlists(
	database: Pick<BackfillDatabase, 'select'>,
	ownerId: string,
	wishlistIds?: readonly string[],
): Promise<WishlistRow[]> {
	return database
		.select()
		.from(wishlist)
		.where(
			and(
				isNull(wishlist.deletedAt),
				managedByOwner(ownerId),
				wishlistIds === undefined ? undefined : inArray(wishlist.id, [...wishlistIds]),
			),
		)
		.orderBy(asc(wishlist.createdAt), asc(wishlist.id));
}

/** A permanent wishlist and an occasion wishlist given by id or short id. */
export interface WishlistPairReference {
	permanent: string;
	occasion: string;
}

function isLinkablePair(permanentWishlist: WishlistRow, occasionWishlist: WishlistRow): boolean {
	return (
		permanentWishlist.kind === WISHLIST_KIND.permanent &&
		occasionWishlist.kind === WISHLIST_KIND.occasion &&
		wishlistsShareRecipient(permanentWishlist, occasionWishlist)
	);
}

function selectWishlistPairs(
	managedWishlists: readonly WishlistRow[],
	references: readonly WishlistPairReference[],
): [WishlistRow, WishlistRow][] {
	if (references.length === 0) {
		return managedWishlists
			.filter((candidate) => candidate.kind === WISHLIST_KIND.permanent)
			.flatMap((permanentWishlist) =>
				managedWishlists
					.filter((occasionWishlist) =>
						isLinkablePair(permanentWishlist, occasionWishlist),
					)
					.map((occasionWishlist): [WishlistRow, WishlistRow] => [
						permanentWishlist,
						occasionWishlist,
					]),
			);
	}
	const findManaged = (reference: string) => {
		const found = managedWishlists.find(
			(candidate) => candidate.id === reference || candidate.shortId === reference,
		);
		if (found === undefined) {
			throw new Error(`Wishlist ${reference} is not a live wishlist the owner manages`);
		}
		return found;
	};
	return references.map((reference) => {
		const permanentWishlist = findManaged(reference.permanent);
		const occasionWishlist = findManaged(reference.occasion);
		if (!isLinkablePair(permanentWishlist, occasionWishlist)) {
			throw new Error(
				`${reference.permanent} → ${reference.occasion} is not a permanent → occasion pair of one recipient`,
			);
		}
		return [permanentWishlist, occasionWishlist];
	});
}

/** Active reserved units on the gift, or on every live copy of its link group. */
function groupReservedUnitsColumn() {
	return sql<number>`(
		SELECT coalesce(sum(group_reservation.quantity), 0)::int
		FROM ${reservation} AS group_reservation
		JOIN ${gift} AS reserved_gift ON reserved_gift.id = group_reservation.gift_id
		WHERE group_reservation.deleted_at IS NULL
			AND reserved_gift.deleted_at IS NULL
			AND (reserved_gift.id = "gift"."id" OR reserved_gift.link_group_id = "gift"."link_group_id")
	)`.mapWith(Number);
}

interface LoadedGift {
	row: GiftRow;
	backfillGift: BackfillGift;
}

async function loadGifts(
	database: Pick<BackfillDatabase, 'select'>,
	filter: { wishlistId: string } | { giftIds: readonly string[] },
	options: { lock: boolean } = { lock: false },
): Promise<LoadedGift[]> {
	const query = database
		.select({
			...giftColumnsWithImages(),
			categories: activeGiftCategoriesColumn(),
			reservedUnits: groupReservedUnitsColumn(),
		})
		.from(gift)
		.where(
			'wishlistId' in filter
				? and(eq(gift.wishlistId, filter.wishlistId), isNull(gift.deletedAt))
				: inArray(gift.id, [...filter.giftIds]),
		)
		.orderBy(asc(gift.id));
	const rows = await (options.lock ? query.for('update', { of: gift }) : query);
	return rows.map(({ categories, reservedUnits, ...row }) => ({
		row,
		backfillGift: {
			id: row.id,
			wishlistId: row.wishlistId,
			name: row.name,
			description: row.description,
			descriptionAppends: row.descriptionAppends,
			links: row.links,
			price: row.price,
			priceMax: row.priceMax,
			currency: row.currency,
			quantity: row.quantity,
			images: row.images,
			categoryLabels: categories.map(
				(category) => category.presetKey ?? category.customLabel ?? '',
			),
			received: row.received,
			linkGroupId: row.linkGroupId,
			updatedAt: row.updatedAt,
			reservedUnits,
		},
	}));
}

async function loadBackfillGifts(
	database: BackfillDatabase,
	wishlistId: string,
): Promise<BackfillGift[]> {
	return (await loadGifts(database, { wishlistId })).map((loaded) => loaded.backfillGift);
}

function toPlannedWishlist(wishlistRow: WishlistRow): PlannedWishlist {
	return {
		id: wishlistRow.id,
		shortId: wishlistRow.shortId,
		title: wishlistRow.title,
		occasion: wishlistRow.occasion,
		status: wishlistRow.status,
	};
}

/**
 * Read-only: the owner's permanent → occasion wishlist pairs of one recipient (or the given pairs)
 * with their gifts matched by name, for review before apply.
 */
export async function proposeLinkedCopiesPlan(
	database: BackfillDatabase,
	options: {
		owner: BackfillOwner;
		pairs: readonly WishlistPairReference[];
		databaseLabel: string;
		now?: Date;
	},
): Promise<LinkedCopiesPlan> {
	const managedWishlists = await loadManagedWishlists(database, options.owner.id);
	const plannedPairs: PlannedPair[] = [];
	for (const [permanentWishlist, occasionWishlist] of selectWishlistPairs(
		managedWishlists,
		options.pairs,
	)) {
		const occasionGifts = await loadBackfillGifts(database, occasionWishlist.id);
		const permanentGifts = await loadBackfillGifts(database, permanentWishlist.id);
		plannedPairs.push({
			permanentWishlist: toPlannedWishlist(permanentWishlist),
			occasionWishlist: toPlannedWishlist(occasionWishlist),
			confirmed: false,
			...matchPairGifts(occasionGifts, permanentGifts),
		});
	}
	return {
		version: 1,
		createdAt: (options.now ?? new Date()).toISOString(),
		database: options.databaseLabel,
		owner: options.owner,
		pairs: plannedPairs,
		warnings: giftsMatchedInSeveralPairs(plannedPairs).map(
			(giftId) =>
				`gift ${giftId} is matched in several pairs; after the first is linked, apply skips the others until a new propose`,
		),
	};
}

export const MATCH_OUTCOME = { linked: 'linked', skipped: 'skipped' } as const;

export type AppliedMatch = { occasionGiftId: string; permanentGiftId: string; name: string } & (
	| {
			outcome: typeof MATCH_OUTCOME.linked;
			linkGroupId: string;
			joinedExistingGroup: boolean;
			permanentFieldsChanged: string[];
			receivedMerge: ReceivedMerge;
			reservationConflict: ReservationConflict | null;
			/** Uploads the permanent copy no longer shows; the app's reference-aware cleanup did not run. */
			releasedImageKeys: string[];
	  }
	| { outcome: typeof MATCH_OUTCOME.skipped; reason: string }
);

export const PAIR_OUTCOME = {
	applied: 'applied',
	skipped: 'skipped',
	failed: 'failed',
} as const;

export interface AppliedPair {
	permanentWishlist: Pick<PlannedWishlist, 'id' | 'title' | 'shortId'>;
	occasionWishlist: Pick<PlannedWishlist, 'id' | 'title' | 'shortId'>;
	outcome: (typeof PAIR_OUTCOME)[keyof typeof PAIR_OUTCOME];
	reason?: string;
	batchId?: string;
	revisionCount: number;
	matches: AppliedMatch[];
}

export interface ApplyReport {
	executed: boolean;
	pairs: AppliedPair[];
}

class DryRunRollback extends Error {
	constructor(readonly pairReport: AppliedPair) {
		super('Linked copies dry run rollback');
	}
}

class PairRejected extends Error {}

/** Why a planned gift can no longer be linked as reviewed, or null when it still can. */
function staleGiftReason(
	planned: PlannedGift,
	loaded: LoadedGift | undefined,
	expectedWishlistId: string,
): string | null {
	if (loaded === undefined || loaded.row.deletedAt !== null) {
		return `gift ${planned.id} was deleted`;
	}
	if (loaded.row.wishlistId !== expectedWishlistId) {
		return `gift ${planned.id} moved to another wishlist`;
	}
	if (loaded.row.updatedAt.toISOString() !== planned.updatedAt) {
		return `gift ${planned.id} changed since propose`;
	}
	if (loaded.row.linkGroupId !== planned.linkGroupId) {
		return `gift ${planned.id} was linked or unlinked since propose`;
	}
	return null;
}

function linkBlockedReason(occasionRow: GiftRow, permanentRow: GiftRow): string | null {
	if (occasionRow.linkGroupId === null || permanentRow.linkGroupId === null) {
		return null;
	}
	return occasionRow.linkGroupId === permanentRow.linkGroupId
		? 'already linked'
		: 'the copies are in two different link groups';
}

/** Writes a gift row's changes and records them as its revision. */
async function writeGift(
	context: MutationOperationContext,
	before: GiftRow,
	changes: Pick<Partial<GiftRow>, 'received' | 'linkGroupId' | 'updatedAt'>,
): Promise<GiftRow> {
	await context.transaction.update(gift).set(changes).where(eq(gift.id, before.id));
	const after = { ...before, ...changes };
	context.recordGiftRevisions([
		{ giftId: before.id, wishlistId: before.wishlistId, before, after },
	]);
	return after;
}

function ownerRoleOn(wishlistRow: WishlistRow, ownerId: string) {
	return wishlistRow.recipientUserId === ownerId
		? WISHLIST_ROLES.recipient
		: WISHLIST_ROLES.moderator;
}

const CHANGE_REPORTED_FIELDS = [
	'name',
	'description',
	'descriptionAppends',
	'links',
	'price',
	'priceMax',
	'currency',
	'quantity',
	'images',
	'categoryIds',
	'received',
] as const satisfies readonly (keyof GiftRow)[];

/**
 * Links one reviewed match like the app's linked copy: a received occasion or permanent copy makes
 * both received, the copies share the occasion copy's group (or the permanent copy's, or a new
 * one), and the occasion copy's synced values reach every other copy through the app's sync.
 * Reservations, likes, priority and order stay untouched.
 */
async function linkMatch(
	context: MutationOperationContext,
	occasion: { loaded: LoadedGift; wishlistRow: WishlistRow },
	permanent: { loaded: LoadedGift; wishlistRow: WishlistRow },
): Promise<AppliedMatch> {
	const { transaction, now, actor } = context;
	const permanentBefore = permanent.loaded.row;
	let occasionRow = occasion.loaded.row;
	const merge = receivedMerge(occasion.loaded.backfillGift, permanent.loaded.backfillGift);
	if (permanentBefore.received && !occasionRow.received) {
		const occasionBefore = occasionRow;
		occasionRow = await writeGift(context, occasionBefore, { received: true, updatedAt: now });
		await propagateToLinkedCopies(
			context,
			linkedGiftEdit(
				occasionBefore,
				occasionRow,
				ownerRoleOn(occasion.wishlistRow, actor.userId),
			),
		);
	}
	const existingGroupId = occasionRow.linkGroupId ?? permanentBefore.linkGroupId;
	const linkGroupId =
		existingGroupId ?? (await createLinkGroup(transaction, GIFT_LINK_GROUP_KIND.linkedCopies));
	if (occasionRow.linkGroupId !== linkGroupId) {
		occasionRow = await writeGift(context, occasionRow, { linkGroupId });
	}
	const permanentLinked =
		permanentBefore.linkGroupId === linkGroupId
			? permanentBefore
			: await writeGift(context, permanentBefore, { linkGroupId });
	await propagateToLinkedCopies(
		context,
		linkedGiftEdit(
			permanentLinked,
			occasionRow,
			ownerRoleOn(occasion.wishlistRow, actor.userId),
		),
	);
	const [permanentAfter] = await loadGifts(transaction, { giftIds: [permanentBefore.id] });
	const permanentRowAfter = permanentAfter?.row ?? permanentLinked;
	return {
		occasionGiftId: occasionRow.id,
		permanentGiftId: permanentBefore.id,
		name: occasionRow.name,
		outcome: MATCH_OUTCOME.linked,
		linkGroupId,
		joinedExistingGroup: existingGroupId !== null,
		permanentFieldsChanged: CHANGE_REPORTED_FIELDS.filter((field) =>
			jsonChanged(permanentBefore[field], permanentRowAfter[field]),
		),
		receivedMerge: merge,
		reservationConflict: reservationConflict(
			occasion.loaded.backfillGift,
			permanent.loaded.backfillGift,
		),
		releasedImageKeys: releasedImageKeys(permanentBefore.images, permanentRowAfter.images),
	};
}

/** Locks the pair's wishlists, every copy linked to their gifts and the matched gifts, in that order. */
async function lockPair(
	transaction: DatabaseTransaction,
	pair: ReviewedPair,
): Promise<{ heldWishlistLocks: HeldWishlistLocks; loadedById: Map<string, LoadedGift> }> {
	const wishlistIds = [pair.permanentWishlist.id, pair.occasionWishlist.id];
	const matchedGiftIds = pair.matches.flatMap((match) => [match.occasion.id, match.permanent.id]);
	const heldWishlistLocks = await lockWishlistsWithLinkedCopies(transaction, wishlistIds);
	await lockLinkedCopies(transaction, matchedGiftIds, { wishlistIds, heldWishlistLocks });
	const loaded = await loadGifts(transaction, { giftIds: matchedGiftIds }, { lock: true });
	return {
		heldWishlistLocks,
		loadedById: new Map(loaded.map((entry) => [entry.backfillGift.id, entry])),
	};
}

async function applyPair(
	database: BackfillDatabase,
	owner: BackfillOwner,
	pair: ReviewedPair,
	options: { execute: boolean; now: Date },
): Promise<AppliedPair> {
	const batchId = generateId();
	const pairReport: AppliedPair = {
		permanentWishlist: pair.permanentWishlist,
		occasionWishlist: pair.occasionWishlist,
		outcome: PAIR_OUTCOME.applied,
		batchId,
		revisionCount: 0,
		matches: [],
	};
	const actor: OperationActor = {
		userId: owner.id,
		userName: owner.name,
		channel: BACKFILL_CHANNEL,
		isAppAdministrator: false,
	};
	await database.transaction(async (transaction) => {
		const { heldWishlistLocks, loadedById } = await lockPair(transaction, pair);
		const wishlistRows = await loadManagedWishlists(transaction, owner.id, [
			pair.permanentWishlist.id,
			pair.occasionWishlist.id,
		]);
		const permanentWishlist = wishlistRows.find((row) => row.id === pair.permanentWishlist.id);
		const occasionWishlist = wishlistRows.find((row) => row.id === pair.occasionWishlist.id);
		if (
			permanentWishlist === undefined ||
			occasionWishlist === undefined ||
			!isLinkablePair(permanentWishlist, occasionWishlist)
		) {
			throw new PairRejected(
				'the wishlists are no longer a live permanent → occasion pair of one recipient the owner manages',
			);
		}
		const revisionCollector = new GiftRevisionCollector({
			batchId,
			actorUserId: actor.userId,
			channel: actor.channel,
		});
		const context: MutationOperationContext = {
			actor,
			transaction,
			now: options.now,
			batchId,
			dryRun: !options.execute,
			heldWishlistLocks,
			recordGiftRevisions: (changes) =>
				revisionCollector.record(BACKFILL_OPERATION_NAME, changes),
			// A one-off data repair: no reserver notices, and uploads a copy no longer shows stay.
			noteReservedGiftEdits: () => {},
			deferEffect: () => {},
		};
		for (const match of pair.matches) {
			pairReport.matches.push(
				await applyMatch(context, match, loadedById, {
					occasion: occasionWishlist,
					permanent: permanentWishlist,
				}),
			);
		}
		pairReport.revisionCount = (await revisionCollector.flush(transaction)).length;
		if (!options.execute) {
			throw new DryRunRollback(pairReport);
		}
	});
	return pairReport;
}

async function applyMatch(
	context: MutationOperationContext,
	match: ReviewedMatch,
	loadedById: ReadonlyMap<string, LoadedGift>,
	wishlists: { occasion: WishlistRow; permanent: WishlistRow },
): Promise<AppliedMatch> {
	const occasionLoaded = loadedById.get(match.occasion.id);
	const permanentLoaded = loadedById.get(match.permanent.id);
	const skippedReason =
		staleGiftReason(match.occasion, occasionLoaded, wishlists.occasion.id) ??
		staleGiftReason(match.permanent, permanentLoaded, wishlists.permanent.id) ??
		(occasionLoaded === undefined || permanentLoaded === undefined
			? 'gift missing'
			: linkBlockedReason(occasionLoaded.row, permanentLoaded.row));
	if (skippedReason !== null || occasionLoaded === undefined || permanentLoaded === undefined) {
		return {
			occasionGiftId: match.occasion.id,
			permanentGiftId: match.permanent.id,
			name: match.occasion.name,
			outcome: MATCH_OUTCOME.skipped,
			reason: skippedReason ?? 'gift missing',
		};
	}
	return linkMatch(
		context,
		{ loaded: occasionLoaded, wishlistRow: wishlists.occasion },
		{ loaded: permanentLoaded, wishlistRow: wishlists.permanent },
	);
}

/**
 * Links a reviewed plan's confirmed matches, one transaction per wishlist pair. Without `execute`
 * every pair runs the same writes and rolls back, so the report shows exactly what would change.
 * A match whose gifts changed, moved, were deleted or linked since propose is skipped; a pair
 * whose wishlists no longer qualify is skipped whole.
 */
export async function applyLinkedCopiesPlan(
	database: BackfillDatabase,
	plan: ReviewedPlan,
	options: { execute: boolean; now?: Date },
): Promise<ApplyReport> {
	const owner = await findOwner(database, plan.owner.id);
	if (owner === undefined) {
		throw new Error(`Owner ${plan.owner.id} no longer exists`);
	}
	const now = options.now ?? new Date();
	const pairs: AppliedPair[] = [];
	for (const pair of plan.pairs) {
		const unappliedPair = (outcome: AppliedPair['outcome'], reason: string): AppliedPair => ({
			permanentWishlist: pair.permanentWishlist,
			occasionWishlist: pair.occasionWishlist,
			outcome,
			reason,
			revisionCount: 0,
			matches: [],
		});
		if (!pair.confirmed) {
			pairs.push(unappliedPair(PAIR_OUTCOME.skipped, 'not confirmed'));
			continue;
		}
		if (pair.matches.length === 0) {
			pairs.push(unappliedPair(PAIR_OUTCOME.skipped, 'no matches'));
			continue;
		}
		try {
			pairs.push(await applyPair(database, owner, pair, { execute: options.execute, now }));
		} catch (thrown) {
			if (thrown instanceof DryRunRollback) {
				pairs.push(thrown.pairReport);
			} else if (thrown instanceof PairRejected) {
				pairs.push(unappliedPair(PAIR_OUTCOME.skipped, thrown.message));
			} else {
				pairs.push(
					unappliedPair(
						PAIR_OUTCOME.failed,
						thrown instanceof Error ? thrown.message : String(thrown),
					),
				);
			}
		}
	}
	return { executed: options.execute, pairs };
}

/** A readable apply report. */
export function formatApplyReport(report: ApplyReport): string {
	const lines = [report.executed ? 'Executed: changes committed' : 'Dry run: nothing committed'];
	for (const pair of report.pairs) {
		const linked = pair.matches.filter((match) => match.outcome === MATCH_OUTCOME.linked);
		lines.push(
			'',
			`„${pair.permanentWishlist.title}“ (${pair.permanentWishlist.shortId}) → „${pair.occasionWishlist.title}“ (${pair.occasionWishlist.shortId}): ${pair.outcome}${pair.reason === undefined ? '' : ` (${pair.reason})`}`,
			...(pair.outcome === PAIR_OUTCOME.applied
				? [
						`  ${linked.length} linked, ${pair.matches.length - linked.length} skipped, ${pair.revisionCount} gift revision(s), batch ${pair.batchId}`,
					]
				: []),
		);
		for (const match of pair.matches) {
			if (match.outcome === MATCH_OUTCOME.skipped) {
				lines.push(`    skipped ${match.name}: ${match.reason}`);
				continue;
			}
			const conflict = match.reservationConflict;
			lines.push(
				`    linked ${match.name}${match.joinedExistingGroup ? ' (joined existing group)' : ''}: permanent copy changed ${match.permanentFieldsChanged.join(', ') || 'nothing'}`,
				...(conflict === null
					? []
					: [
							`      ! reserved ${conflict.occasionReservedUnits} + ${conflict.permanentReservedUnits} of ${conflict.sharedQuantity}${conflict.bothCopiesReserved ? ' (double reservation)' : ''}; no reservation cancelled`,
						]),
				...(match.releasedImageKeys.length > 0
					? [`      uploads no longer shown: ${match.releasedImageKeys.join(', ')}`]
					: []),
			);
		}
	}
	return lines.join('\n');
}
