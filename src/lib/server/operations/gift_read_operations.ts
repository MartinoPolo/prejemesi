import * as v from 'valibot';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftLike, reservation } from '$lib/server/db/gift.schema.js';
import { priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { getAnonVisitorId } from '$lib/server/anonymous_visitor.js';
import { resolveWishlistRole } from '$lib/modules/wishlists/wishlist_access.js';
import {
	canSeeReserverNames,
	hidesReservationState,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import { activeGiftCategoriesColumn } from '$lib/modules/gift-categories/gift_categories_service.js';
import type {
	GiftByRole,
	GiftForRecipient,
	GiftForVisitor,
	LinkedGiftCopy,
	SharedGiftMember,
} from '$lib/modules/gifts/types.js';
import {
	GIFT_LINK_GROUP_KIND,
	type GiftLinkGroupKind,
} from '$lib/modules/gifts/gift_link_group_kind.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import { OPERATION_EXPOSURE, OPERATION_KIND, defineOperation } from './operation.js';
import { giftImagesColumn } from './gift_gallery.js';
import {
	loadManagedOpenWishlists,
	requireLiveWishlistRowByShortId,
	requireWishlistManagement,
	type WishlistRow,
} from './wishlist_management.js';
import { requireOperationActor, type OperationActor } from './actor.js';
import {
	isSharedAcrossRecipients,
	sharedGiftRowIds,
	listedLinkedCopies,
	listedSharedGiftMembers,
	loadLinkedSiblingsOnWishlist,
	sharedGiftRecipientUserIds,
	loadViewerManagedWishlistIds,
	wishlistsShareRecipient,
	type LinkGroupMember,
} from './gift_link_group.js';

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
			images: giftImagesColumn(),
		})
		.from(gift)
		.leftJoin(priorityLevel, eq(gift.priorityLevelId, priorityLevel.id))
		.where(and(eq(gift.wishlistId, wishlistId), isNull(gift.deletedAt)))
		.orderBy(gift.sortOrder);
}

type GiftReadRow = Awaited<ReturnType<typeof loadGiftRows>>[number];

/** What a viewer learns of the other rows of a gift's link group. */
interface GiftGroupView {
	linkedCopies: LinkedGiftCopy[];
	linkGroupKind: GiftLinkGroupKind | null;
	sharedWith: SharedGiftMember[];
}

function toRecipientGift(row: GiftReadRow, groupView: GiftGroupView): GiftForRecipient {
	return { ...row, categoryIds: row.categories.map((category) => category.id), ...groupView };
}

/**
 * Only the recipient and správci learn where else a linked copy is listed; visitors never do. A
 * shared gift tells everyone whose gift it also is (issue #737), and its lists to their managers.
 */
function readableGroupView(
	role: WishlistRole,
	siblings: readonly LinkGroupMember[],
	managedWishlistIds: ReadonlySet<string>,
): GiftGroupView {
	if (isSharedAcrossRecipients(siblings)) {
		return {
			linkedCopies: [],
			linkGroupKind: GIFT_LINK_GROUP_KIND.sharedAcrossRecipients,
			sharedWith: listedSharedGiftMembers(siblings, managedWishlistIds),
		};
	}
	const linkedCopies =
		role === WISHLIST_ROLES.visitor ? [] : listedLinkedCopies(siblings, managedWishlistIds);
	return {
		linkedCopies,
		linkGroupKind: linkedCopies.length > 0 ? GIFT_LINK_GROUP_KIND.linkedCopies : null,
		sharedWith: [],
	};
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

/** The users actively liking each gift. */
async function loadLikerIds(
	database: ReadDatabase,
	giftIds: readonly string[],
): Promise<Map<string, Set<string>>> {
	const likerIdsByGiftId = new Map<string, Set<string>>();
	if (giftIds.length === 0) {
		return likerIdsByGiftId;
	}
	const likeRows = await database
		.select({ giftId: giftLike.giftId, userId: giftLike.userId })
		.from(giftLike)
		.where(and(inArray(giftLike.giftId, [...giftIds]), isNull(giftLike.deletedAt)));
	for (const row of likeRows) {
		const likerIds = likerIdsByGiftId.get(row.giftId) ?? new Set<string>();
		likerIds.add(row.userId);
		likerIdsByGiftId.set(row.giftId, likerIds);
	}
	return likerIdsByGiftId;
}

/** Likes stay per linked copy; a shared gift counts each liker of any of its rows once. */
function countLikes(
	giftId: string,
	siblings: readonly LinkGroupMember[],
	likerIdsByGiftId: ReadonlyMap<string, ReadonlySet<string>>,
): number {
	const likerIds = sharedGiftRowIds(giftId, siblings).flatMap((likedGiftId) => [
		...(likerIdsByGiftId.get(likedGiftId) ?? []),
	]);
	return new Set(likerIds).size;
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
	quantity: number;
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
			quantity: reservation.quantity,
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
			reservationsByGiftId.set(row.giftId, {
				id: row.id,
				purchasedAt: row.purchasedAt,
				quantity: row.quantity,
			});
		}
	}
	return reservationsByGiftId;
}

/** The viewer of one wishlist, as the reservation privacy rules see them. */
interface ReservationViewer {
	role: WishlistRole;
	userId: string | null;
	wishlistRow: Pick<WishlistRow, 'recipientIsModerator' | 'recipientUserId'>;
}

/** Every linked recipient of a shared gift's lists receives it, so it stays a surprise to them. */
function isSharedGiftRecipient(
	viewer: ReservationViewer,
	siblings: readonly LinkGroupMember[],
): boolean {
	return (
		viewer.userId !== null &&
		isSharedAcrossRecipients(siblings) &&
		sharedGiftRecipientUserIds([
			viewer.wishlistRow,
			...siblings.map((member) => member.wishlist),
		]).has(viewer.userId)
	);
}

/**
 * Whose reservations a viewer of one gift sees: undefined when its reservation state must stay a
 * surprise to them, otherwise the gift's other rows whose reservations count here besides its
 * own. Linked copies and shared rows share their units, so reservations on any of them count. A
 * recipient of a shared gift sees none of its state on any list (issue #737) unless they promoted
 * themselves on the viewed list. A recipient who promoted themselves sees only what they would see
 * on each row: reservations on rows whose list they promoted themselves on too.
 */
function groupRowsWithVisibleReservations(
	viewer: ReservationViewer,
	siblings: readonly LinkGroupMember[],
): readonly LinkGroupMember[] | undefined {
	if (hidesReservationState(viewer.role, viewer.wishlistRow.recipientIsModerator)) {
		return undefined;
	}
	if (viewer.role === WISHLIST_ROLES.recipient) {
		return siblings.filter(
			(member) =>
				member.wishlist.recipientIsModerator &&
				member.wishlist.recipientUserId === viewer.userId,
		);
	}
	return isSharedGiftRecipient(viewer, siblings) ? undefined : siblings;
}

interface VisitorGiftReadings {
	role: WishlistRole;
	linkedSiblingsByGiftId: Map<string, LinkGroupMember[]>;
	/** Wishlists of linked copies the viewer manages. */
	managedLinkedWishlistIds: ReadonlySet<string>;
	countedLinkedCopiesByGiftId: Map<string, readonly LinkGroupMember[]>;
	reservationSummaries: Map<string, ReservationSummary>;
	likerIdsByGiftId: Map<string, Set<string>>;
	viewerReservations: Map<string, ViewerReservation>;
}

/** Units reserved on the linked copies whose reservations this viewer sees counted here. */
function countReservedOnLinkedCopies(giftId: string, readings: VisitorGiftReadings): number {
	const countedCopies = readings.countedLinkedCopiesByGiftId.get(giftId) ?? [];
	return countedCopies.reduce(
		(total, member) =>
			total + (readings.reservationSummaries.get(member.giftId)?.reservedCount ?? 0),
		0,
	);
}

/** A gifter may cancel or mark bought from any copy the reservation they made on another one. */
function viewerReservationFields(
	giftId: string,
	siblings: readonly LinkGroupMember[],
	readings: VisitorGiftReadings,
) {
	const ownViewerReservation = readings.viewerReservations.get(giftId);
	const viewerReservation =
		ownViewerReservation ??
		siblings
			.map((member) => readings.viewerReservations.get(member.giftId))
			.find((linkedReservation) => linkedReservation !== undefined);
	return {
		myReservationId: viewerReservation?.id ?? null,
		myReservationPurchasedAt: viewerReservation?.purchasedAt ?? null,
		myReservationQuantity: viewerReservation?.quantity ?? 0,
		myReservationOnLinkedCopy:
			viewerReservation !== undefined && ownViewerReservation === undefined,
	};
}

function toVisitorGift(row: GiftReadRow, readings: VisitorGiftReadings): GiftForVisitor {
	const siblings = readings.linkedSiblingsByGiftId.get(row.id) ?? [];
	const reservationSummary = readings.reservationSummaries.get(row.id);
	const reservedOnLinkedCopiesCount = countReservedOnLinkedCopies(row.id, readings);
	const reservedCount = (reservationSummary?.reservedCount ?? 0) + reservedOnLinkedCopiesCount;
	return {
		...toRecipientGift(
			row,
			readableGroupView(readings.role, siblings, readings.managedLinkedWishlistIds),
		),
		likeCount: countLikes(row.id, siblings, readings.likerIdsByGiftId),
		reservedCount,
		isFullyReserved: reservedCount >= (row.quantity ?? 1),
		// Names stay on the list the reservation was made on.
		reserverNames: canSeeReserverNames(readings.role)
			? (reservationSummary?.reserverNames ?? [])
			: [],
		reservedOnLinkedCopiesCount:
			readings.role === WISHLIST_ROLES.visitor ? 0 : reservedOnLinkedCopiesCount,
		...viewerReservationFields(row.id, siblings, readings),
	};
}

/**
 * Role-filtered gifts of a wishlist. Surprise protection is enforced here: an ordinary recipient
 * gets no reservation data or like counts, and reserver names reach správci only. A linked gift
 * counts the reservations of its copies (issue #742); only its managers learn where they are. A
 * shared gift (issue #737) reaches any of its recipients without reservation data on every list.
 */
export const readWishlistGiftsOperation = defineOperation({
	name: 'readWishlistGifts',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ wishlistShortId: v.string() }),
	async run({ actor }, { wishlistShortId }) {
		const database = getDb();
		const wishlistRow = await requireLiveWishlistRowByShortId(database, wishlistShortId);
		const [role, giftRows] = await Promise.all([
			resolveWishlistRole(
				actor === null ? null : { user: { id: actor.userId } },
				wishlistRow,
			),
			loadGiftRows(database, wishlistRow.id),
		]);
		// Link group ids stay server-side; readers get the linked copies their role may see.
		const linkedSiblingsByGiftId = await loadLinkedSiblingsOnWishlist(database, wishlistRow.id);
		// Any signed-in viewer may manage another list of a shared gift, visitors of this one too.
		const managedLinkedWishlistIds =
			actor === null
				? new Set<string>()
				: await loadViewerManagedWishlistIds(
						database,
						actor.userId,
						[...linkedSiblingsByGiftId.values()].flat(),
					);
		const groupViewOf = (row: GiftReadRow) =>
			readableGroupView(
				role,
				linkedSiblingsByGiftId.get(row.id) ?? [],
				managedLinkedWishlistIds,
			);

		if (hidesReservationState(role, wishlistRow.recipientIsModerator)) {
			// An undisclosed recipient gets no reservation data or like counts on the whole list.
			const recipientGifts: GiftForRecipient[] = giftRows.map((row) =>
				toRecipientGift(row, groupViewOf(row)),
			);
			return { role, gifts: recipientGifts } as const;
		}

		const viewer: ReservationViewer = { role, userId: actor?.userId ?? null, wishlistRow };
		const countedLinkedCopiesByGiftId = new Map<string, readonly LinkGroupMember[]>();
		for (const row of giftRows) {
			const counted = groupRowsWithVisibleReservations(
				viewer,
				linkedSiblingsByGiftId.get(row.id) ?? [],
			);
			if (counted !== undefined) {
				countedLinkedCopiesByGiftId.set(row.id, counted);
			}
		}

		const giftIds = giftRows.map((row) => row.id);
		const siblingGiftIds = [...linkedSiblingsByGiftId.values()]
			.flat()
			.map((member) => member.giftId);
		// Every sibling, not only counted ones: a viewer's own reservation shows on any copy.
		const reservableGiftIds = [...giftIds, ...siblingGiftIds];
		const [reservationSummaries, likerIdsByGiftId, viewerReservations] = await Promise.all([
			loadReservationSummaries(database, reservableGiftIds),
			loadLikerIds(database, reservableGiftIds),
			loadViewerReservations(database, reservableGiftIds, actor),
		]);
		const readings: VisitorGiftReadings = {
			role,
			linkedSiblingsByGiftId,
			managedLinkedWishlistIds,
			countedLinkedCopiesByGiftId,
			reservationSummaries,
			likerIdsByGiftId,
			viewerReservations,
		};
		// A shared gift kept a surprise from its recipient carries no reservation or like data.
		const gifts: GiftByRole[] = giftRows.map((row) =>
			countedLinkedCopiesByGiftId.has(row.id)
				? toVisitorGift(row, readings)
				: toRecipientGift(row, groupViewOf(row)),
		);
		return { role, gifts } as const;
	},
});

/**
 * Eligible non-archived copy destinations managed by the actor; `linkable` marks the ones of the
 * source's recipient, whose copies stay linked with their sources.
 */
export const readBulkCopyDestinationsOperation = defineOperation({
	name: 'readBulkCopyDestinations',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ sourceWishlistId: v.string() }),
	async run(context, { sourceWishlistId }) {
		const actor = requireOperationActor(context.actor);
		const database = getDb();
		const { wishlistRow: sourceWishlistRow } = await requireWishlistManagement(
			database,
			actor.userId,
			sourceWishlistId,
			{ lock: false },
		);
		const destinations = (await loadManagedOpenWishlists(database, actor.userId)).filter(
			(destination) => destination.id !== sourceWishlistId,
		);
		return destinations.map((destination) => ({
			id: destination.id,
			title: destination.title,
			status: destination.status,
			kind: destination.kind,
			recipientDisplayName: destination.recipientDisplayName,
			linkable: wishlistsShareRecipient(sourceWishlistRow, destination),
		}));
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
