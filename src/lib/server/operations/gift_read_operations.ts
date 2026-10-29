import * as v from 'valibot';
import { and, count as drizzleCount, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftLike, reservation } from '$lib/server/db/gift.schema.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { getAnonVisitorId } from '$lib/server/anonymous_visitor.js';
import { resolveWishlistRole } from '$lib/modules/wishlists/wishlist_access.js';
import {
	canSeeReserverNames,
	hidesReservationState,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import { activeGiftCategoriesColumn } from '$lib/modules/gift-categories/gift_categories_service.js';
import type { GiftForRecipient, GiftForVisitor } from '$lib/modules/gifts/types.js';
import { OPERATION_EXPOSURE, OPERATION_KIND, defineOperation } from './operation.js';
import {
	requireLiveWishlistRowByShortId,
	requireWishlistManagement,
} from './wishlist_management.js';
import { requireOperationActor, type OperationActor } from './actor.js';

type ReadDatabase = ReturnType<typeof getDb>;

/** Gift columns every role may read; anything else (snapshots, soft-delete state) stays server-side. */
const READABLE_GIFT_COLUMN_NAMES = [
	'id',
	'wishlistId',
	'name',
	'description',
	'descriptionAppends',
	'editedAfterShareAt',
	'links',
	'price',
	'priceMax',
	'currency',
	'imageUrl',
	'imageKey',
	'imageMeta',
	'quantity',
	'sortOrder',
	'received',
	'createdAt',
	'priorityLevelId',
] as const satisfies readonly (keyof typeof gift.$inferSelect)[];

const readableGiftColumns = Object.fromEntries(
	READABLE_GIFT_COLUMN_NAMES.map((columnName) => [columnName, gift[columnName]]),
) as Pick<typeof gift, (typeof READABLE_GIFT_COLUMN_NAMES)[number]>;

function loadGiftRows(database: ReadDatabase, wishlistId: string) {
	return database
		.select({
			...readableGiftColumns,
			priorityLabel: priorityLevel.label,
			prioritySortOrder: priorityLevel.sortOrder,
			categories: activeGiftCategoriesColumn(),
		})
		.from(gift)
		.leftJoin(priorityLevel, eq(gift.priorityLevelId, priorityLevel.id))
		.where(and(eq(gift.wishlistId, wishlistId), isNull(gift.deletedAt)))
		.orderBy(gift.sortOrder);
}

type GiftReadRow = Awaited<ReturnType<typeof loadGiftRows>>[number];

function toRecipientGift(row: GiftReadRow): GiftForRecipient {
	return { ...row, categoryIds: row.categories.map((category) => category.id) };
}

interface ReservationSummary {
	reservedCount: number;
	reserverNames: string[];
}

/**
 * Counts and names derive from the same reservation rows so they can never disagree; names are
 * only EMITTED to správci (issue #198) via the canSeeReserverNames gate.
 */
async function loadReservationSummaries(
	database: ReadDatabase,
	giftIds: readonly string[],
): Promise<Map<string, ReservationSummary>> {
	const summariesByGiftId = new Map<string, ReservationSummary>();
	if (giftIds.length === 0) {
		return summariesByGiftId;
	}
	const reservationRows = await database
		.select({
			giftId: reservation.giftId,
			quantity: reservation.quantity,
			reserverName: sql<string | null>`COALESCE(${user.name}, ${reservation.anonymousName})`,
		})
		.from(reservation)
		.leftJoin(user, eq(reservation.userId, user.id))
		.where(and(inArray(reservation.giftId, giftIds), isNull(reservation.deletedAt)))
		.orderBy(reservation.createdAt);

	for (const row of reservationRows) {
		const summary = summariesByGiftId.get(row.giftId) ?? {
			reservedCount: 0,
			reserverNames: [],
		};
		summary.reservedCount += Number(row.quantity);
		if (
			row.reserverName !== null &&
			row.reserverName.trim() !== '' &&
			!summary.reserverNames.includes(row.reserverName)
		) {
			summary.reserverNames.push(row.reserverName);
		}
		summariesByGiftId.set(row.giftId, summary);
	}
	return summariesByGiftId;
}

async function loadLikeCounts(
	database: ReadDatabase,
	giftIds: readonly string[],
): Promise<Map<string, number>> {
	if (giftIds.length === 0) {
		return new Map();
	}
	const likeCountRows = await database
		.select({ giftId: giftLike.giftId, count: drizzleCount() })
		.from(giftLike)
		.where(and(inArray(giftLike.giftId, giftIds), isNull(giftLike.deletedAt)))
		.groupBy(giftLike.giftId);
	return new Map(likeCountRows.map((row) => [row.giftId, Number(row.count)]));
}

/** Accounts match by user id; anonymous visitors by their per-browser capability cookie. */
function viewerReservationFilter(actor: OperationActor | null) {
	if (actor !== null) {
		return eq(reservation.userId, actor.userId);
	}
	const anonymousVisitorId = getAnonVisitorId();
	return anonymousVisitorId === null
		? undefined
		: and(isNull(reservation.userId), eq(reservation.anonymousVisitorId, anonymousVisitorId));
}

interface ViewerReservation {
	id: string;
	purchasedAt: Date | null;
}

/** The viewer's own active reservation per gift powers the unreserve UI. */
async function loadViewerReservations(
	database: ReadDatabase,
	giftIds: readonly string[],
	actor: OperationActor | null,
): Promise<Map<string, ViewerReservation>> {
	const reservationsByGiftId = new Map<string, ViewerReservation>();
	const ownershipFilter = giftIds.length === 0 ? undefined : viewerReservationFilter(actor);
	if (ownershipFilter === undefined) {
		return reservationsByGiftId;
	}
	const viewerReservationRows = await database
		.select({
			id: reservation.id,
			giftId: reservation.giftId,
			purchasedAt: reservation.purchasedAt,
		})
		.from(reservation)
		.where(
			and(
				inArray(reservation.giftId, giftIds),
				ownershipFilter,
				isNull(reservation.deletedAt),
			),
		)
		.orderBy(reservation.createdAt);

	for (const row of viewerReservationRows) {
		// Keep the earliest active reservation per gift
		if (!reservationsByGiftId.has(row.giftId)) {
			reservationsByGiftId.set(row.giftId, { id: row.id, purchasedAt: row.purchasedAt });
		}
	}
	return reservationsByGiftId;
}

interface VisitorGiftReadings {
	reservationSummaries: Map<string, ReservationSummary>;
	likeCounts: Map<string, number>;
	viewerReservations: Map<string, ViewerReservation>;
	includeReserverNames: boolean;
}

function toVisitorGift(row: GiftReadRow, readings: VisitorGiftReadings): GiftForVisitor {
	const reservationSummary = readings.reservationSummaries.get(row.id);
	const reservedCount = reservationSummary?.reservedCount ?? 0;
	const viewerReservation = readings.viewerReservations.get(row.id);
	return {
		...toRecipientGift(row),
		likeCount: readings.likeCounts.get(row.id) ?? 0,
		reservedCount,
		isFullyReserved: reservedCount >= (row.quantity ?? 1),
		reserverNames: readings.includeReserverNames
			? (reservationSummary?.reserverNames ?? [])
			: [],
		myReservationId: viewerReservation?.id ?? null,
		myReservationPurchasedAt: viewerReservation?.purchasedAt ?? null,
	};
}

/**
 * Role-filtered gifts of a wishlist. Surprise protection is enforced here: an ordinary recipient
 * gets no reservation data or like counts, and reserver names reach správci only.
 */
export const readWishlistGiftsOperation = defineOperation({
	name: 'readWishlistGifts',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ wishlistShortId: v.string() }),
	async run({ actor }, { wishlistShortId }) {
		const database = getDb();
		const wishlistRow = await requireLiveWishlistRowByShortId(database, wishlistShortId);
		const role = await resolveWishlistRole(
			actor === null ? null : { user: { id: actor.userId } },
			wishlistRow,
		);
		const giftRows = await loadGiftRows(database, wishlistRow.id);

		if (hidesReservationState(role, wishlistRow.recipientIsModerator)) {
			// Recipient without self-promote: no reservation data, no like counts (protects the surprise)
			const recipientGifts: GiftForRecipient[] = giftRows.map((row) => toRecipientGift(row));
			return { role, gifts: recipientGifts } as const;
		}

		const giftIds = giftRows.map((row) => row.id);
		const readings: VisitorGiftReadings = {
			reservationSummaries: await loadReservationSummaries(database, giftIds),
			likeCounts: await loadLikeCounts(database, giftIds),
			viewerReservations: await loadViewerReservations(database, giftIds, actor),
			includeReserverNames: canSeeReserverNames(role),
		};
		const visitorGifts: GiftForVisitor[] = giftRows.map((row) => toVisitorGift(row, readings));
		return { role, gifts: visitorGifts } as const;
	},
});

/** Eligible non-archived copy destinations managed by the actor. */
export const readBulkCopyDestinationsOperation = defineOperation({
	name: 'readBulkCopyDestinations',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ sourceWishlistId: v.string() }),
	async run(context, { sourceWishlistId }) {
		const actor = requireOperationActor(context.actor);
		const database = getDb();
		await requireWishlistManagement(database, actor.userId, sourceWishlistId, { lock: false });
		return database
			.selectDistinct({
				id: wishlist.id,
				title: wishlist.title,
				status: wishlist.status,
				kind: wishlist.kind,
				recipientDisplayName: sql<string>`coalesce(${wishlist.recipientName}, ${user.name})`,
			})
			.from(wishlist)
			.leftJoin(user, eq(user.id, wishlist.recipientUserId))
			.leftJoin(
				moderatorAssignment,
				and(
					eq(moderatorAssignment.wishlistId, wishlist.id),
					eq(moderatorAssignment.userId, actor.userId),
					isNull(moderatorAssignment.deletedAt),
				),
			)
			.where(
				and(
					ne(wishlist.id, sourceWishlistId),
					ne(wishlist.status, 'archived'),
					isNull(wishlist.deletedAt),
					wishlistScope(),
					or(
						eq(wishlist.recipientUserId, actor.userId),
						eq(moderatorAssignment.userId, actor.userId),
					),
				),
			)
			.orderBy(wishlist.title);
	},
});

export const readPriorityLevelsOperation = defineOperation({
	name: 'readPriorityLevels',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ wishlistId: v.string() }),
	async run(context, { wishlistId }) {
		const actor = requireOperationActor(context.actor);
		const database = getDb();
		await requireWishlistManagement(database, actor.userId, wishlistId, { lock: false });
		return database
			.select()
			.from(priorityLevel)
			.where(eq(priorityLevel.wishlistId, wishlistId))
			.orderBy(priorityLevel.sortOrder);
	},
});
