import {
	and,
	asc,
	eq,
	inArray,
	isNotNull,
	isNull,
	ne,
	sql,
	type SQL,
	type SQLWrapper,
} from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { alias } from 'drizzle-orm/pg-core';
import type { DatabaseTransaction, getDb } from '$lib/server/db/index.js';
import { gift, giftLinkGroup, reservation } from '$lib/server/db/gift.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { WISHLIST_KIND } from '$lib/modules/wishlists/types.js';
import { SERVER_ERROR, type ServerErrorCode } from '$lib/modules/errors/server_error_codes.js';
import { giftFollowsStrictPostShareRules } from '$lib/modules/gifts/gift_strict_post_share_rules.js';
import {
	isPreShareOwnerFullEditGraceOpen,
	preShareOwnerFullEditGraceExpiresAt,
} from '$lib/modules/gifts/gift_deletion_rules.js';
import type { LinkedGiftCopy, SharedGiftMember } from '$lib/modules/gifts/types.js';
import {
	GIFT_LINK_GROUP_KIND,
	type GiftLinkGroupKind,
} from '$lib/modules/gifts/gift_link_group_kind.js';
import { loadReservedGiftIds } from './wishlist_kind_rules.js';
import {
	WISHLIST_ROW_LOCK,
	lockWishlistsInIdOrder,
	type WishlistRow,
	type WishlistRowLock,
} from './wishlist_management.js';

type Database = DatabaseTransaction | ReturnType<typeof getDb>;

/** Wishlists a transaction already holds, with the lock mode it holds each in. */
export type HeldWishlistLocks = ReadonlyMap<string, WishlistRowLock>;

/** A live copy in a link group, with the wishlist facts the link rules and reads use. */
export interface LinkGroupMember {
	giftId: string;
	linkGroupId: string;
	linkGroupKind: GiftLinkGroupKind;
	createdAt: Date;
	/**
	 * The wishlist's free-text recipient name, else its linked recipient's account name, else its
	 * title, so a member is never shown nameless.
	 */
	recipientDisplayName: string;
	/** The linked recipient's account image; null for a free-text recipient. */
	recipientImage: string | null;
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
		| 'recipientUserId'
		| 'recipientName'
	>;
}

function linkGroupMemberColumns() {
	return {
		giftId: gift.id,
		linkGroupId: gift.linkGroupId,
		linkGroupKind: giftLinkGroup.kind,
		createdAt: gift.createdAt,
		recipientDisplayName: sql<string>`coalesce(${wishlist.recipientName}, ${user.name}, ${wishlist.title})`,
		recipientImage: user.image,
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
			recipientUserId: wishlist.recipientUserId,
			recipientName: wishlist.recipientName,
		},
	};
}

/** Every live copy of the given link groups, including copies on deleted or archived wishlists. */
async function loadLinkGroupMembers(
	database: Database,
	linkGroupIds: readonly string[],
): Promise<LinkGroupMember[]> {
	if (linkGroupIds.length === 0) {
		return [];
	}
	const rows = await database
		.select(linkGroupMemberColumns())
		.from(gift)
		.innerJoin(wishlist, eq(wishlist.id, gift.wishlistId))
		.innerJoin(giftLinkGroup, eq(giftLinkGroup.id, gift.linkGroupId))
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
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
	const membersByGroupId = new Map<string, LinkGroupMember[]>();
	for (const member of members) {
		membersByGroupId.set(member.linkGroupId, [
			...(membersByGroupId.get(member.linkGroupId) ?? []),
			member,
		]);
	}
	return new Map(
		linkedGiftRows.map((row) => [
			row.id,
			(row.linkGroupId === null ? [] : (membersByGroupId.get(row.linkGroupId) ?? [])).filter(
				(member) => member.giftId !== row.id,
			),
		]),
	);
}

/** The other live copies linked to a gift; empty for an unlinked gift. */
export async function loadLinkedSiblings(
	database: Database,
	linkedGift: { id: string; linkGroupId: string | null },
): Promise<LinkGroupMember[]> {
	if (linkedGift.linkGroupId === null) {
		return [];
	}
	const members = await loadLinkGroupMembers(database, [linkedGift.linkGroupId]);
	return members.filter((member) => member.giftId !== linkedGift.id);
}

const MAX_LINK_GROUP_LOCK_ATTEMPTS = 3;

/** A lock pass found link group members it had not locked: a copy joined before its locks held. */
export class LinkGroupMembershipChanged extends Error {
	constructor() {
		super('Link group membership changed during the lock pass');
	}
}

/**
 * Runs a lock pass in a savepoint and retries it from scratch when it reports a member that joined
 * a link group before its locks held: rolling the savepoint back releases its locks, so the retry
 * takes every lock in order again instead of adding the new one out of order. 409 once the
 * attempts run out.
 */
export async function lockWithStableLinkGroups<TLocked>(
	transaction: DatabaseTransaction,
	lockPass: (savepoint: DatabaseTransaction) => Promise<TLocked>,
): Promise<TLocked> {
	for (let attempt = 1; attempt <= MAX_LINK_GROUP_LOCK_ATTEMPTS; attempt += 1) {
		try {
			return await transaction.transaction(lockPass);
		} catch (thrown) {
			if (!(thrown instanceof LinkGroupMembershipChanged)) {
				throw thrown;
			}
		}
	}
	error(409, SERVER_ERROR.CONFLICT);
}

/** The live copies in the link groups of the given gifts, with their wishlists. */
async function loadLinkedCopyRows(
	database: DatabaseTransaction,
	giftIds: readonly string[],
): Promise<{ id: string; wishlistId: string }[]> {
	const linkedGroups = database
		.select({ linkGroupId: gift.linkGroupId })
		.from(gift)
		.where(
			and(
				inArray(gift.id, [...giftIds]),
				isNotNull(gift.linkGroupId),
				isNull(gift.deletedAt),
			),
		);
	return database
		.select({ id: gift.id, wishlistId: gift.wishlistId })
		.from(gift)
		.where(and(inArray(gift.linkGroupId, linkedGroups), isNull(gift.deletedAt)));
}

/** The wishlists holding a live copy linked to a live gift on one of the given wishlists. */
async function loadLinkedCopyWishlistIds(
	database: DatabaseTransaction,
	wishlistIds: readonly string[],
): Promise<Set<string>> {
	const linkedGroups = database
		.select({ linkGroupId: gift.linkGroupId })
		.from(gift)
		.where(
			and(
				inArray(gift.wishlistId, [...wishlistIds]),
				isNotNull(gift.linkGroupId),
				isNull(gift.deletedAt),
			),
		);
	const rows = await database
		.selectDistinct({ wishlistId: gift.wishlistId })
		.from(gift)
		.where(and(inArray(gift.linkGroupId, linkedGroups), isNull(gift.deletedAt)));
	return new Set(rows.map((row) => row.wishlistId));
}

function holdsWishlistLock(
	heldWishlistLocks: HeldWishlistLocks,
	wishlistId: string,
	lock: WishlistRowLock,
): boolean {
	const heldLock = heldWishlistLocks.get(wishlistId);
	return heldLock === WISHLIST_ROW_LOCK.exclusive || heldLock === lock;
}

/**
 * A batch's up-front lock pass: its own wishlists exclusively and the wishlists of every copy
 * linked to a gift on them key share, all in one id-ordered pass. A step's linked edit then locks
 * no wishlist after the batch already holds one, so two batches editing one group from opposite
 * copies queue instead of deadlocking. Returns the locks it holds.
 */
export async function lockWishlistsWithLinkedCopies(
	transaction: DatabaseTransaction,
	exclusiveWishlistIds: readonly string[],
): Promise<HeldWishlistLocks> {
	if (exclusiveWishlistIds.length === 0) {
		return new Map();
	}
	const exclusive = new Set(exclusiveWishlistIds);
	const lockModeFor = (wishlistId: string): WishlistRowLock =>
		exclusive.has(wishlistId) ? WISHLIST_ROW_LOCK.exclusive : WISHLIST_ROW_LOCK.keyShare;
	return lockWithStableLinkGroups(transaction, async (savepoint) => {
		const lockedWishlistIds = new Set([
			...exclusive,
			...(await loadLinkedCopyWishlistIds(savepoint, exclusiveWishlistIds)),
		]);
		await lockWishlistsInIdOrder(savepoint, [...lockedWishlistIds], lockModeFor);
		const currentWishlistIds = await loadLinkedCopyWishlistIds(savepoint, exclusiveWishlistIds);
		if ([...currentWishlistIds].some((wishlistId) => !lockedWishlistIds.has(wishlistId))) {
			throw new LinkGroupMembershipChanged();
		}
		return new Map(
			[...lockedWishlistIds].map((wishlistId) => [wishlistId, lockModeFor(wishlistId)]),
		);
	});
}

/**
 * Locks every live copy linked to the given gifts ahead of the caller's own locks: first all their
 * wishlists in id order (the caller's own exclusively unless `own.lock` says otherwise, the others
 * key share, so only exclusive wishlist changes wait), then all their gift rows in id order. Every
 * mutation keeps this wishlist-then-gift order, so edits of one group from different lists cannot
 * deadlock. Wishlists the caller already holds (a batch's up-front pass) are not locked again.
 * Membership is read again under the locks and the pass retried when a copy joined meanwhile. Does
 * nothing when none of the gifts is linked.
 */
export async function lockLinkedCopies(
	transaction: DatabaseTransaction,
	giftIds: readonly string[],
	own: {
		wishlistIds: readonly string[];
		lock?: WishlistRowLock;
		heldWishlistLocks: HeldWishlistLocks;
	},
): Promise<void> {
	if (giftIds.length === 0) {
		return;
	}
	const ownWishlistIds = new Set(own.wishlistIds);
	const lockModeFor = (wishlistId: string): WishlistRowLock =>
		ownWishlistIds.has(wishlistId)
			? (own.lock ?? WISHLIST_ROW_LOCK.exclusive)
			: WISHLIST_ROW_LOCK.keyShare;
	if ((await loadLinkedCopyRows(transaction, giftIds)).length === 0) {
		return;
	}
	await lockWithStableLinkGroups(transaction, async (savepoint) => {
		const lockedMembers = await loadLinkedCopyRows(savepoint, giftIds);
		const wishlistIdsToLock = [
			...new Set([...own.wishlistIds, ...lockedMembers.map((member) => member.wishlistId)]),
		].filter(
			(wishlistId) =>
				!holdsWishlistLock(own.heldWishlistLocks, wishlistId, lockModeFor(wishlistId)),
		);
		await lockWishlistsInIdOrder(savepoint, wishlistIdsToLock, lockModeFor);
		const lockedGiftIds = new Set(lockedMembers.map((member) => member.id));
		if (lockedGiftIds.size > 0) {
			await savepoint
				.select({ id: gift.id })
				.from(gift)
				.where(inArray(gift.id, [...lockedGiftIds]))
				.orderBy(asc(gift.id))
				.for('update');
		}
		const currentMembers = await loadLinkedCopyRows(savepoint, giftIds);
		if (currentMembers.some((member) => !lockedGiftIds.has(member.id))) {
			throw new LinkGroupMembershipChanged();
		}
	});
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

async function liveGroupGiftIds(
	database: DatabaseTransaction,
	linkGroupId: string | null,
	options: { lock: boolean },
): Promise<string[]> {
	if (linkGroupId === null) {
		return [];
	}
	const query = database
		.select({ id: gift.id })
		.from(gift)
		.where(and(eq(gift.linkGroupId, linkGroupId), isNull(gift.deletedAt)))
		.orderBy(asc(gift.id));
	const rows = await (options.lock ? query.for('update') : query);
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
 * Membership is read again under the locks and the pass retried when the gift's group changed
 * meanwhile. Available quantity is the gift's quantity less the active reservations on all
 * members. Undefined when the gift is gone.
 */
export async function lockLinkGroupAvailability(
	transaction: DatabaseTransaction,
	target: { id: string; linkGroupId: string | null },
): Promise<LinkGroupAvailability | undefined> {
	let expectedLinkGroupId = target.linkGroupId;
	return lockWithStableLinkGroups(transaction, async (savepoint) => {
		const lockedGroupGiftIds = await liveGroupGiftIds(savepoint, expectedLinkGroupId, {
			lock: true,
		});
		const [lockedGift] = await savepoint
			.select({ quantity: gift.quantity, name: gift.name, linkGroupId: gift.linkGroupId })
			.from(gift)
			.where(and(eq(gift.id, target.id), isNull(gift.deletedAt)))
			.for('update')
			.limit(1);
		if (lockedGift === undefined) {
			return undefined;
		}
		const currentGroupGiftIds = await liveGroupGiftIds(savepoint, lockedGift.linkGroupId, {
			lock: false,
		});
		if (
			lockedGift.linkGroupId !== expectedLinkGroupId ||
			currentGroupGiftIds.some((giftId) => !lockedGroupGiftIds.includes(giftId))
		) {
			expectedLinkGroupId = lockedGift.linkGroupId;
			throw new LinkGroupMembershipChanged();
		}
		const memberGiftIds = currentGroupGiftIds.length === 0 ? [target.id] : currentGroupGiftIds;
		const [reserved] = await savepoint
			.select({ totalQuantity: sql<number>`COALESCE(SUM(${reservation.quantity}), 0)` })
			.from(reservation)
			.where(and(inArray(reservation.giftId, memberGiftIds), isNull(reservation.deletedAt)));
		return {
			giftName: lockedGift.name,
			availableQuantity: (lockedGift.quantity ?? 1) - Number(reserved?.totalQuantity ?? 0),
			memberGiftIds,
		};
	});
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

/** A live copy on a shared wishlist whose gifts follow the strict post-share rules. */
function copyFollowsStrictSharedRules(
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

/**
 * A copy whose own recipient edit is already restricted: a pre-share gift on a shared wishlist
 * following the strict rules, past its share grace. It freezes the recipient's edits on every copy.
 */
function linkedCopyFreezesRecipientEdits(
	member: LinkGroupMember,
	groupHasActiveReservation: boolean,
	now: Date,
): boolean {
	const { sharedAt } = member.wishlist;
	return (
		copyFollowsStrictSharedRules(member, groupHasActiveReservation) &&
		sharedAt !== null &&
		member.createdAt <= sharedAt &&
		!isPreShareOwnerFullEditGraceOpen(
			{ wishlistSharedAt: sharedAt, giftCreatedAt: member.createdAt },
			now,
		)
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

/** Whether a description addition on the edited wishlist becomes a dated segment. */
export function shouldAppendDescription(
	wishlistRow: Pick<WishlistRow, 'sharedAt'>,
	linkedRules: LinkedEditRules,
): boolean {
	return (
		(wishlistRow.sharedAt !== null && linkedRules.followsStrictRules) ||
		linkedRules.appendsByLinkedCopy
	);
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
		// A copy on a shared wishlist following the strict rules keeps every copy append-only.
		appendsByLinkedCopy: siblings.some((member) =>
			copyFollowsStrictSharedRules(member, groupHasActiveReservation),
		),
	};
}

/**
 * A linked copy as its managers and recipient see it. `editsFrozenFrom` derives from sharing alone,
 * never from reservations, so the recipient learns nothing a gifter did.
 */
function toLinkedGiftCopy(member: LinkGroupMember, viewerManages: boolean): LinkedGiftCopy {
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
		viewerManages,
	};
}

/**
 * Linked copies listed to people leave out deleted wishlists; `managedWishlistIds` are the
 * wishlists the viewer manages, whose copies they may unlink.
 */
export function listedLinkedCopies(
	members: readonly LinkGroupMember[],
	managedWishlistIds: ReadonlySet<string>,
): LinkedGiftCopy[] {
	return members
		.filter((member) => member.wishlist.deletedAt === null)
		.map((member) => toLinkedGiftCopy(member, managedWishlistIds.has(member.wishlist.id)));
}

/** The members' wishlists the viewer manages, as their linked recipient or an active správce. */
export async function loadViewerManagedWishlistIds(
	database: Database,
	viewerUserId: string,
	members: readonly LinkGroupMember[],
): Promise<Set<string>> {
	const managedWishlistIds = new Set(
		members
			.filter((member) => member.wishlist.recipientUserId === viewerUserId)
			.map((member) => member.wishlist.id),
	);
	const otherWishlistIds = [
		...new Set(
			members
				.map((member) => member.wishlist.id)
				.filter((wishlistId) => !managedWishlistIds.has(wishlistId)),
		),
	];
	if (otherWishlistIds.length === 0) {
		return managedWishlistIds;
	}
	const assignments = await database
		.select({ wishlistId: moderatorAssignment.wishlistId })
		.from(moderatorAssignment)
		.where(
			and(
				inArray(moderatorAssignment.wishlistId, otherWishlistIds),
				eq(moderatorAssignment.userId, viewerUserId),
				isNull(moderatorAssignment.deletedAt),
			),
		);
	for (const assignment of assignments) {
		managedWishlistIds.add(assignment.wishlistId);
	}
	return managedWishlistIds;
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

/** Whether a gift's other live members make it a gift shared across recipients (issue #737). */
export function isSharedAcrossRecipients(siblings: readonly LinkGroupMember[]): boolean {
	return siblings.some(
		(member) => member.linkGroupKind === GIFT_LINK_GROUP_KIND.sharedAcrossRecipients,
	);
}

/**
 * The recipients of a shared gift: every linked recipient account of any of its wishlists. Each of
 * them receives the gift, so it stays a surprise to them on every list, including lists they
 * manage.
 */
export function sharedGiftRecipientUserIds(
	wishlists: readonly Pick<WishlistRow, 'recipientUserId'>[],
): Set<string> {
	return new Set(
		wishlists.flatMap((memberWishlist) =>
			memberWishlist.recipientUserId === null ? [] : [memberWishlist.recipientUserId],
		),
	);
}

/** A gift's other live rows when it is a shared gift (issue #737); empty for other gifts. */
export async function loadSharedGiftSiblings(
	database: Database,
	giftRow: { id: string; linkGroupId: string | null },
): Promise<LinkGroupMember[]> {
	const siblings = await loadLinkedSiblings(database, giftRow);
	return isSharedAcrossRecipients(siblings) ? siblings : [];
}

/**
 * The rows that count as one gift: every row of a shared gift, whose likes and reservations are
 * the gift's; only the gift itself for ordinary gifts and linked copies.
 */
export function sharedGiftRowIds(giftId: string, siblings: readonly LinkGroupMember[]): string[] {
	return isSharedAcrossRecipients(siblings)
		? [giftId, ...siblings.map((member) => member.giftId)]
		: [giftId];
}

/**
 * Rejects a recipient of a shared gift reserving or liking it on any of its wishlists, with the
 * code the own-list rejection uses. Does nothing for ordinary and linked gifts.
 */
export function assertNotSharedGiftRecipient(
	siblings: readonly LinkGroupMember[],
	actorUserId: string,
	rejectionCode: ServerErrorCode,
): void {
	if (
		isSharedAcrossRecipients(siblings) &&
		sharedGiftRecipientUserIds(siblings.map((member) => member.wishlist)).has(actorUserId)
	) {
		error(403, rejectionCode);
	}
}

/**
 * A shared gift's other wishlists as a viewer sees them: whose gift it also is for everyone, the
 * list itself only on wishlists the viewer manages.
 */
export function listedSharedGiftMembers(
	siblings: readonly LinkGroupMember[],
	managedWishlistIds: ReadonlySet<string>,
): SharedGiftMember[] {
	if (!isSharedAcrossRecipients(siblings)) {
		return [];
	}
	return siblings
		.filter((member) => member.wishlist.deletedAt === null)
		.map((member) => {
			const viewerManages = managedWishlistIds.has(member.wishlist.id);
			return {
				recipientDisplayName: member.recipientDisplayName,
				recipientImage: member.recipientImage,
				giftId: viewerManages ? member.giftId : null,
				wishlistId: viewerManages ? member.wishlist.id : null,
				wishlistShortId: viewerManages ? member.wishlist.shortId : null,
				wishlistTitle: viewerManages ? member.wishlist.title : null,
			};
		});
}

/** The kind of each given link group. */
export async function loadLinkGroupKinds(
	database: Database,
	linkGroupIds: readonly (string | null)[],
): Promise<Map<string, GiftLinkGroupKind>> {
	const groupIds = [
		...new Set(linkGroupIds.filter((groupId): groupId is string => groupId !== null)),
	];
	if (groupIds.length === 0) {
		return new Map();
	}
	const rows = await database
		.select({ id: giftLinkGroup.id, kind: giftLinkGroup.kind })
		.from(giftLinkGroup)
		.where(inArray(giftLinkGroup.id, groupIds));
	return new Map(rows.map((row) => [row.id, row.kind]));
}

/** The live rows of shared gifts (issue #737) on one wishlist, in id order. */
export function loadSharedGiftRowsOnWishlist(
	database: Database,
	wishlistId: string,
): Promise<{ id: string; linkGroupId: string | null }[]> {
	return database
		.select({ id: gift.id, linkGroupId: gift.linkGroupId })
		.from(gift)
		.innerJoin(giftLinkGroup, eq(giftLinkGroup.id, gift.linkGroupId))
		.where(
			and(
				eq(gift.wishlistId, wishlistId),
				isNull(gift.deletedAt),
				eq(giftLinkGroup.kind, GIFT_LINK_GROUP_KIND.sharedAcrossRecipients),
			),
		)
		.orderBy(asc(gift.id));
}

/**
 * SQL: whether the gift with the given id is a shared gift (issue #737) the user receives as the
 * linked recipient of any of its wishlists, so its reservations stay a surprise to them on every
 * list. Its own aliases keep it correlatable to an outer query over gifts and wishlists.
 */
export function sharedGiftReceivedBySql(giftId: SQLWrapper, userId: string): SQL {
	const receivedGift = alias(gift, 'received_gift');
	const receivedGroupMember = alias(gift, 'received_group_member');
	const receivedMemberWishlist = alias(wishlist, 'received_member_wishlist');
	return sql`exists (select 1 from ${gift} as ${receivedGift} inner join ${giftLinkGroup} on ${giftLinkGroup.id} = ${receivedGift.linkGroupId} inner join ${gift} as ${receivedGroupMember} on ${receivedGroupMember.linkGroupId} = ${receivedGift.linkGroupId} inner join ${wishlist} as ${receivedMemberWishlist} on ${receivedMemberWishlist.id} = ${receivedGroupMember.wishlistId} where ${receivedGift.id} = ${giftId} and ${giftLinkGroup.kind} = ${GIFT_LINK_GROUP_KIND.sharedAcrossRecipients} and ${receivedGroupMember.deletedAt} is null and ${receivedMemberWishlist.recipientUserId} = ${userId})`;
}
