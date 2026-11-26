import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import type { DatabaseTransaction, getDb } from '$lib/server/db/index.js';
import { gift, giftLinkGroup, reservation } from '$lib/server/db/gift.schema.js';
import type { GIFT_LINK_GROUP_KIND } from '$lib/server/db/enums.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { WISHLIST_KIND } from '$lib/modules/wishlists/types.js';
import { giftFollowsStrictPostShareRules } from '$lib/modules/gifts/gift_strict_post_share_rules.js';
import {
	isPreShareOwnerFullEditGraceOpen,
	preShareOwnerFullEditGraceExpiresAt,
} from '$lib/modules/gifts/gift_deletion_rules.js';
import type { LinkedGiftCopy } from '$lib/modules/gifts/types.js';
import { loadReservedGiftIds } from './wishlist_kind_rules.js';
import type { WishlistRow } from './wishlist_management.js';

type Database = DatabaseTransaction | ReturnType<typeof getDb>;
type GiftLinkGroupKind = (typeof GIFT_LINK_GROUP_KIND)[keyof typeof GIFT_LINK_GROUP_KIND];

/** The lock a mutation takes on its own wishlists; linked copies' wishlists take key share. */
export const OWN_WISHLIST_LOCK = { exclusive: 'update', keyShare: 'key share' } as const;
type OwnWishlistLock = (typeof OWN_WISHLIST_LOCK)[keyof typeof OWN_WISHLIST_LOCK];

/** A live copy in a link group, with the wishlist facts the link rules and reads use. */
export interface LinkGroupMember {
	giftId: string;
	linkGroupId: string;
	createdAt: Date;
	wishlist: Pick<
		WishlistRow,
		| 'id'
		| 'shortId'
		| 'title'
		| 'occasion'
		| 'status'
		| 'kind'
		| 'sharedAt'
		| 'deletedAt'
		| 'recipientIsModerator'
	>;
}

const linkGroupMemberColumns = {
	giftId: gift.id,
	linkGroupId: gift.linkGroupId,
	createdAt: gift.createdAt,
	wishlist: {
		id: wishlist.id,
		shortId: wishlist.shortId,
		title: wishlist.title,
		occasion: wishlist.occasion,
		status: wishlist.status,
		kind: wishlist.kind,
		sharedAt: wishlist.sharedAt,
		deletedAt: wishlist.deletedAt,
		recipientIsModerator: wishlist.recipientIsModerator,
	},
};

/** Every live copy of the given link groups, including copies on deleted or archived wishlists. */
async function loadLinkGroupMembers(
	database: Database,
	linkGroupIds: readonly string[],
): Promise<LinkGroupMember[]> {
	if (linkGroupIds.length === 0) {
		return [];
	}
	const rows = await database
		.select(linkGroupMemberColumns)
		.from(gift)
		.innerJoin(wishlist, eq(wishlist.id, gift.wishlistId))
		.where(and(inArray(gift.linkGroupId, [...new Set(linkGroupIds)]), isNull(gift.deletedAt)))
		.orderBy(asc(gift.id));
	return rows.flatMap((row) =>
		row.linkGroupId === null ? [] : [{ ...row, linkGroupId: row.linkGroupId }],
	);
}

/** The other live copies of each linked gift on a wishlist, keyed by gift id. */
export async function loadLinkedSiblingsOnWishlist(
	database: Database,
	wishlistId: string,
): Promise<Map<string, LinkGroupMember[]>> {
	const linkedGiftRows = await database
		.select({ id: gift.id, linkGroupId: gift.linkGroupId })
		.from(gift)
		.where(
			and(
				eq(gift.wishlistId, wishlistId),
				isNotNull(gift.linkGroupId),
				isNull(gift.deletedAt),
			),
		);
	const members = await loadLinkGroupMembers(
		database,
		linkedGiftRows.flatMap((row) => (row.linkGroupId === null ? [] : [row.linkGroupId])),
	);
	return new Map(
		linkedGiftRows.map((row) => [
			row.id,
			members.filter(
				(member) => member.linkGroupId === row.linkGroupId && member.giftId !== row.id,
			),
		]),
	);
}

/** The other live copies linked to a gift; empty for an unlinked gift. */
async function loadLinkedSiblings(
	database: Database,
	linkedGift: { id: string; linkGroupId: string | null },
): Promise<LinkGroupMember[]> {
	if (linkedGift.linkGroupId === null) {
		return [];
	}
	const members = await loadLinkGroupMembers(database, [linkedGift.linkGroupId]);
	return members.filter((member) => member.giftId !== linkedGift.id);
}

/**
 * Locks every live copy linked to the given gifts ahead of the caller's own locks: first all their
 * wishlists in id order (the caller's own with `ownWishlistLock`, the others key share, so only
 * exclusive wishlist changes wait), then all their gift rows in id order. Every mutation keeps
 * this wishlist-then-gift order, so edits of one group from different lists cannot deadlock. Does
 * nothing when none of the gifts is linked.
 */
export async function lockLinkedCopies(
	transaction: DatabaseTransaction,
	giftIds: readonly string[],
	own: { wishlistIds: readonly string[]; lock: OwnWishlistLock },
): Promise<void> {
	if (giftIds.length === 0) {
		return;
	}
	const linkedGroups = transaction
		.select({ linkGroupId: gift.linkGroupId })
		.from(gift)
		.where(
			and(
				inArray(gift.id, [...giftIds]),
				isNotNull(gift.linkGroupId),
				isNull(gift.deletedAt),
			),
		);
	const members = await transaction
		.select({ id: gift.id, wishlistId: gift.wishlistId })
		.from(gift)
		.where(and(inArray(gift.linkGroupId, linkedGroups), isNull(gift.deletedAt)));
	if (members.length === 0) {
		return;
	}
	const ownWishlistIds = new Set(own.wishlistIds);
	// Postgres orders the ids, so this order matches `lockWishlistsInIdOrder`.
	const orderedWishlists = await transaction
		.select({ id: wishlist.id })
		.from(wishlist)
		.where(
			inArray(wishlist.id, [
				...new Set([...own.wishlistIds, ...members.map((member) => member.wishlistId)]),
			]),
		)
		.orderBy(asc(wishlist.id));
	for (const { id } of orderedWishlists) {
		await transaction
			.select({ id: wishlist.id })
			.from(wishlist)
			.where(eq(wishlist.id, id))
			.for(ownWishlistIds.has(id) ? own.lock : OWN_WISHLIST_LOCK.keyShare);
	}
	await transaction
		.select({ id: gift.id })
		.from(gift)
		.where(
			inArray(
				gift.id,
				members.map((member) => member.id),
			),
		)
		.orderBy(asc(gift.id))
		.for('update');
}

/** Starts an empty link group; gifts join it by taking its id. */
export async function createLinkGroup(
	transaction: DatabaseTransaction,
	kind: GiftLinkGroupKind,
): Promise<string> {
	const [created] = await transaction
		.insert(giftLinkGroup)
		.values({ kind })
		.returning({ id: giftLinkGroup.id });
	if (created === undefined) {
		throw new Error('Link group insert returned no row');
	}
	return created.id;
}

async function lockLiveGroupGiftIds(
	transaction: DatabaseTransaction,
	linkGroupId: string,
): Promise<string[]> {
	const rows = await transaction
		.select({ id: gift.id })
		.from(gift)
		.where(and(eq(gift.linkGroupId, linkGroupId), isNull(gift.deletedAt)))
		.orderBy(asc(gift.id))
		.for('update');
	return rows.map((row) => row.id);
}

/** A locked gift's capacity, shared by every live member of its link group. */
export interface LinkGroupAvailability {
	giftName: string;
	availableQuantity: number;
	/** The gift itself when unlinked, otherwise every live member of its group. */
	memberGiftIds: string[];
}

/**
 * Locks a gift and every live member of its link group in id order, without their wishlists: a
 * reservation already holds its own wishlist and only needs the shared capacity to stay put.
 * Available quantity is the gift's quantity less the active reservations on all members.
 * Undefined when the gift is gone.
 */
export async function lockLinkGroupAvailability(
	transaction: DatabaseTransaction,
	target: { id: string; linkGroupId: string | null },
): Promise<LinkGroupAvailability | undefined> {
	const lockedGroupGiftIds =
		target.linkGroupId === null
			? []
			: await lockLiveGroupGiftIds(transaction, target.linkGroupId);
	const [lockedGift] = await transaction
		.select({ quantity: gift.quantity, name: gift.name, linkGroupId: gift.linkGroupId })
		.from(gift)
		.where(and(eq(gift.id, target.id), isNull(gift.deletedAt)))
		.for('update')
		.limit(1);
	if (lockedGift === undefined) {
		return undefined;
	}
	// The group read before locking is current unless the gift left or joined one meanwhile.
	const groupGiftIds =
		lockedGift.linkGroupId === target.linkGroupId
			? lockedGroupGiftIds
			: lockedGift.linkGroupId === null
				? []
				: await lockLiveGroupGiftIds(transaction, lockedGift.linkGroupId);
	const memberGiftIds = groupGiftIds.length === 0 ? [target.id] : groupGiftIds;
	const [reserved] = await transaction
		.select({ totalQuantity: sql<number>`COALESCE(SUM(${reservation.quantity}), 0)` })
		.from(reservation)
		.where(and(inArray(reservation.giftId, memberGiftIds), isNull(reservation.deletedAt)));
	return {
		giftName: lockedGift.name,
		availableQuantity: (lockedGift.quantity ?? 1) - Number(reserved?.totalQuantity ?? 0),
		memberGiftIds,
	};
}

/**
 * Takes a gift out of its link group; a group left with a single live copy dissolves. The caller
 * holds the group locked ({@link lockLinkedCopies}).
 */
export async function leaveLinkGroup(
	transaction: DatabaseTransaction,
	leavingGift: { id: string; linkGroupId: string | null },
): Promise<void> {
	if (leavingGift.linkGroupId === null) {
		return;
	}
	await transaction.update(gift).set({ linkGroupId: null }).where(eq(gift.id, leavingGift.id));
	const remaining = await transaction
		.select({ id: gift.id })
		.from(gift)
		.where(
			and(
				eq(gift.linkGroupId, leavingGift.linkGroupId),
				isNull(gift.deletedAt),
				ne(gift.id, leavingGift.id),
			),
		);
	const [onlyRemaining] = remaining;
	if (remaining.length === 1 && onlyRemaining !== undefined) {
		await transaction
			.update(gift)
			.set({ linkGroupId: null })
			.where(eq(gift.id, onlyRemaining.id));
	}
}

/**
 * A copy whose own recipient edit is already restricted: a pre-share gift on a shared wishlist
 * following the strict rules, past its share grace. It freezes the recipient's edits on every copy.
 */
function linkedCopyFreezesRecipientEdits(
	member: LinkGroupMember,
	groupHasActiveReservation: boolean,
	now: Date,
): boolean {
	const { sharedAt, kind, deletedAt } = member.wishlist;
	return (
		deletedAt === null &&
		sharedAt !== null &&
		member.createdAt <= sharedAt &&
		giftFollowsStrictPostShareRules(kind, groupHasActiveReservation) &&
		!isPreShareOwnerFullEditGraceOpen(
			{ wishlistSharedAt: sharedAt, giftCreatedAt: member.createdAt },
			now,
		)
	);
}

/** A copy on a shared wishlist following the strict rules keeps every copy's description append-only. */
function linkedCopyAppendsDescriptions(
	member: LinkGroupMember,
	groupHasActiveReservation: boolean,
): boolean {
	const { sharedAt, kind, deletedAt } = member.wishlist;
	return (
		deletedAt === null &&
		sharedAt !== null &&
		giftFollowsStrictPostShareRules(kind, groupHasActiveReservation)
	);
}

/** The post-share rules a locked gift's edit follows, the strictest of its linked copies included. */
export interface LinkedEditRules {
	/** The gift's own wishlist rules, with reservations counted across the group. */
	followsStrictRules: boolean;
	/** Another copy freezes the recipient's name, description and quantity edits. */
	frozenByLinkedCopy: boolean;
	/** Another copy makes description additions dated segments. */
	appendsByLinkedCopy: boolean;
}

/**
 * {@link giftFollowsStrictPostShareRules} for a gift the caller holds FOR UPDATE with its group: a
 * reservation locks every copy of the group before inserting, so none can appear between this read
 * and the write. Reservations are read only where a permanent wishlist needs them.
 */
export async function lockedLinkedEditRules(
	transaction: DatabaseTransaction,
	lockedGift: { id: string; linkGroupId: string | null },
	wishlistRow: Pick<WishlistRow, 'kind'>,
	now: Date,
): Promise<LinkedEditRules> {
	const siblings = await loadLinkedSiblings(transaction, lockedGift);
	const needsReservationState = [wishlistRow, ...siblings.map((member) => member.wishlist)].some(
		(memberWishlist) => memberWishlist.kind === WISHLIST_KIND.permanent,
	);
	const groupHasActiveReservation =
		needsReservationState &&
		(
			await loadReservedGiftIds(transaction, [
				lockedGift.id,
				...siblings.map((member) => member.giftId),
			])
		).size > 0;
	return {
		followsStrictRules: giftFollowsStrictPostShareRules(
			wishlistRow.kind,
			groupHasActiveReservation,
		),
		frozenByLinkedCopy: siblings.some((member) =>
			linkedCopyFreezesRecipientEdits(member, groupHasActiveReservation, now),
		),
		appendsByLinkedCopy: siblings.some((member) =>
			linkedCopyAppendsDescriptions(member, groupHasActiveReservation),
		),
	};
}

/**
 * A linked copy as its managers and recipient see it. `editsFrozenFrom` derives from sharing alone,
 * never from reservations, so the recipient learns nothing a gifter did.
 */
function toLinkedGiftCopy(member: LinkGroupMember): LinkedGiftCopy {
	const { sharedAt, kind } = member.wishlist;
	return {
		giftId: member.giftId,
		wishlistId: member.wishlist.id,
		wishlistShortId: member.wishlist.shortId,
		wishlistTitle: member.wishlist.title,
		occasion: member.wishlist.occasion,
		status: member.wishlist.status,
		editsFrozenFrom: giftFollowsStrictPostShareRules(kind, false)
			? preShareOwnerFullEditGraceExpiresAt({
					wishlistSharedAt: sharedAt,
					giftCreatedAt: member.createdAt,
				})
			: null,
	};
}

/** Linked copies listed to people leave out deleted wishlists. */
export function listedLinkedCopies(members: readonly LinkGroupMember[]): LinkedGiftCopy[] {
	return members
		.filter((member) => member.wishlist.deletedAt === null)
		.map((member) => toLinkedGiftCopy(member));
}

/**
 * Gifts may link only between wishlists of the same recipient: the same account, or, for
 * recipients without one, the same written name.
 */
export function wishlistsShareRecipient(
	first: Pick<WishlistRow, 'recipientUserId' | 'recipientName'>,
	second: Pick<WishlistRow, 'recipientUserId' | 'recipientName'>,
): boolean {
	if (first.recipientUserId !== null || second.recipientUserId !== null) {
		return first.recipientUserId === second.recipientUserId;
	}
	const firstName = first.recipientName?.trim() ?? '';
	return firstName !== '' && firstName === (second.recipientName?.trim() ?? '');
}
