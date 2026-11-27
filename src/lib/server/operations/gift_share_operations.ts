import * as v from 'valibot';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { assertWishlistMutable } from '$lib/modules/wishlists/wishlist_access.js';
import { GIFT_LINK_GROUP_KIND } from '$lib/modules/gifts/gift_link_group_kind.js';
import { MAX_BULK_COPY_GIFTS } from '$lib/modules/gifts/gift_bulk_copy.js';
import { MAX_SHARE_WISHLISTS } from '$lib/modules/gifts/shared_gift.js';
import { appendGiftsUsingTransaction } from '$lib/modules/gifts/gift_creation_service.js';
import { activeGiftCategoriesColumn } from '$lib/modules/gift-categories/gift_categories_service.js';
import type { GiftWithImages } from '$lib/modules/gifts/types.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import { requireOperationActor } from './actor.js';
import { giftColumnsWithImages } from './gift_gallery.js';
import { mapCategoriesIntoWishlist, type SourceCategory } from './gift_category_mapping.js';
import {
	createLinkGroup,
	loadLinkGroupKinds,
	loadLinkedSiblings,
	LinkGroupMembershipChanged,
	loadViewerManagedWishlistIds,
	lockLinkedCopies,
	lockWithStableLinkGroups,
	wishlistsShareRecipient,
	type LinkGroupMember,
} from './gift_link_group.js';
import {
	loadManagedOpenWishlists,
	lockWishlistsInIdOrder,
	requireWishlistManagement,
	resolveWishlistAccess,
	type WishlistRow,
} from './wishlist_management.js';
import type { GiftRow } from './gift_presentation_update.js';

const ShareGiftsInputSchema = v.strictObject({
	giftIds: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(MAX_BULK_COPY_GIFTS)),
	/** Lists to add each gift to; lists already sharing a gift are skipped for it. */
	wishlistIds: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(MAX_SHARE_WISHLISTS)),
});

const ReadGiftShareDestinationsInputSchema = v.strictObject({
	giftIds: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(MAX_BULK_COPY_GIFTS)),
});

type RecipientIdentity = Pick<WishlistRow, 'recipientUserId' | 'recipientName'>;

/** Every pair of the lists has different recipients, as a shared gift needs. */
function recipientsAllDiffer(wishlists: readonly RecipientIdentity[]): boolean {
	return wishlists.every((first, index) =>
		wishlists.slice(index + 1).every((second) => !wishlistsShareRecipient(first, second)),
	);
}

/** The gift's other live rows, and whether the actor manages every list holding one. */
async function loadLiveSiblingsManagedBy(
	database: DatabaseTransaction | ReturnType<typeof getDb>,
	actorUserId: string,
	giftRow: { id: string; linkGroupId: string | null },
): Promise<{ siblings: LinkGroupMember[]; managesEveryList: boolean }> {
	const siblings = (await loadLinkedSiblings(database, giftRow)).filter(
		(member) => member.wishlist.deletedAt === null,
	);
	const managedWishlistIds = await loadViewerManagedWishlistIds(database, actorUserId, siblings);
	return {
		siblings,
		managesEveryList: siblings.every((member) => managedWishlistIds.has(member.wishlist.id)),
	};
}

interface SharedGiftSource {
	giftRow: GiftRow;
	categories: readonly SourceCategory[];
	wishlistRow: WishlistRow;
	/** The gift's other live rows when it is shared already. */
	siblings: LinkGroupMember[];
	/** The requested lists not yet holding the gift. */
	destinationIds: string[];
}

/**
 * Locks every list taking part, then the gifts: an already shared gift's group first through the
 * linked-copy lock pass, which takes all wishlists in id order before any gift row; for unlinked
 * gifts the wishlists then the gift rows in id order. The gifts' and destinations' own lists are
 * locked exclusively, other lists of a shared gift key share. Returns each gift's link group as
 * read before the locks.
 */
async function lockShareParticipants(
	context: Pick<MutationOperationContext, 'transaction' | 'heldWishlistLocks'>,
	giftIds: readonly string[],
	destinationIds: readonly string[],
): Promise<Map<string, string | null>> {
	const { transaction } = context;
	const unlockedGifts = await transaction
		.select({ id: gift.id, wishlistId: gift.wishlistId, linkGroupId: gift.linkGroupId })
		.from(gift)
		.where(and(inArray(gift.id, [...giftIds]), isNull(gift.deletedAt)));
	if (unlockedGifts.length !== giftIds.length) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}
	const ownWishlistIds = [
		...new Set([...unlockedGifts.map((row) => row.wishlistId), ...destinationIds]),
	];
	await lockLinkedCopies(transaction, giftIds, {
		wishlistIds: ownWishlistIds,
		heldWishlistLocks: context.heldWishlistLocks,
	});
	await lockWishlistsInIdOrder(transaction, ownWishlistIds);
	return new Map(unlockedGifts.map((row) => [row.id, row.linkGroupId]));
}

async function loadLockedSources(
	transaction: DatabaseTransaction,
	giftIds: readonly string[],
): Promise<{ giftRow: GiftRow; categories: SourceCategory[] }[]> {
	const rows = await transaction
		.select({ giftRow: giftColumnsWithImages(), categories: activeGiftCategoriesColumn() })
		.from(gift)
		.where(and(inArray(gift.id, [...giftIds]), isNull(gift.deletedAt)))
		.orderBy(asc(gift.id))
		.for('update');
	if (rows.length !== giftIds.length) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}
	return rows;
}

/**
 * Locks the participants and loads the locked gifts. A gift that joined or left a group between
 * the first read and its row lock would leave that group's other lists unlocked, so the pass then
 * starts over and locks the group it is in now before any recipient is checked.
 */
async function lockShareSources(
	context: Pick<MutationOperationContext, 'transaction' | 'heldWishlistLocks'>,
	giftIds: readonly string[],
	destinationIds: readonly string[],
): Promise<{ giftRow: GiftRow; categories: SourceCategory[] }[]> {
	return lockWithStableLinkGroups(context.transaction, async (savepoint) => {
		const linkGroupIdsBeforeLocks = await lockShareParticipants(
			{ ...context, transaction: savepoint },
			giftIds,
			destinationIds,
		);
		const lockedSources = await loadLockedSources(savepoint, giftIds);
		if (
			lockedSources.some(
				({ giftRow }) => giftRow.linkGroupId !== linkGroupIdsBeforeLocks.get(giftRow.id),
			)
		) {
			throw new LinkGroupMembershipChanged();
		}
		return lockedSources;
	});
}

/** A destination the actor manages that is live and not archived. */
async function requireShareDestination(
	transaction: DatabaseTransaction,
	actorUserId: string,
	wishlistId: string,
): Promise<WishlistRow> {
	const { role, wishlistRow } = await resolveWishlistAccess(
		transaction,
		actorUserId,
		wishlistId,
		{
			lock: true,
		},
	);
	if (role === WISHLIST_ROLES.visitor) {
		error(403, SERVER_ERROR.GIFT_SHARE_NOT_MANAGER);
	}
	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.GIFT_SHARE_DESTINATION_UNAVAILABLE);
	}
	return wishlistRow;
}

/**
 * Checks one gift may be shared to the destinations: the actor manages its list and every list it
 * is already shared with, it is no linked copy, and every list ends up with a different recipient.
 */
async function planSharedGiftSource(
	transaction: DatabaseTransaction,
	actorUserId: string,
	source: { giftRow: GiftRow; categories: SourceCategory[] },
	destinations: ReadonlyMap<string, WishlistRow>,
	linkGroupKinds: ReadonlyMap<string, string>,
): Promise<SharedGiftSource> {
	const { giftRow } = source;
	if (
		giftRow.linkGroupId !== null &&
		linkGroupKinds.get(giftRow.linkGroupId) === GIFT_LINK_GROUP_KIND.linkedCopies
	) {
		error(400, SERVER_ERROR.GIFT_SHARE_LINKED_COPY);
	}
	const { role, wishlistRow } = await resolveWishlistAccess(
		transaction,
		actorUserId,
		giftRow.wishlistId,
		{ lock: true },
	);
	if (role === WISHLIST_ROLES.visitor) {
		error(403, SERVER_ERROR.GIFT_SHARE_NOT_MANAGER);
	}
	assertWishlistMutable(wishlistRow);
	const { siblings, managesEveryList } = await loadLiveSiblingsManagedBy(
		transaction,
		actorUserId,
		giftRow,
	);
	if (!managesEveryList) {
		error(403, SERVER_ERROR.GIFT_SHARE_NOT_MANAGER);
	}
	const memberWishlistIds = new Set([
		wishlistRow.id,
		...siblings.map((member) => member.wishlist.id),
	]);
	const destinationIds = [...destinations.keys()].filter(
		(destinationId) => !memberWishlistIds.has(destinationId),
	);
	const participants: RecipientIdentity[] = [
		wishlistRow,
		...siblings.map((member) => member.wishlist),
		...destinationIds.map((destinationId) => destinations.get(destinationId)!),
	];
	if (!recipientsAllDiffer(participants)) {
		error(400, SERVER_ERROR.GIFT_SHARE_SAME_RECIPIENT);
	}
	return { ...source, wishlistRow, siblings, destinationIds };
}

/** The priority at the same position of each wishlist's priority order. */
async function loadPriorityIdsByWishlist(
	transaction: DatabaseTransaction,
	wishlistIds: readonly string[],
): Promise<Map<string, string[]>> {
	const rows = await transaction
		.select({ id: priorityLevel.id, wishlistId: priorityLevel.wishlistId })
		.from(priorityLevel)
		.where(inArray(priorityLevel.wishlistId, [...new Set(wishlistIds)]))
		.orderBy(asc(priorityLevel.sortOrder));
	const priorityIdsByWishlist = new Map<string, string[]>();
	for (const row of rows) {
		priorityIdsByWishlist.set(row.wishlistId, [
			...(priorityIdsByWishlist.get(row.wishlistId) ?? []),
			row.id,
		]);
	}
	return priorityIdsByWishlist;
}

function mappedPriorityLevelId(
	source: SharedGiftSource,
	destinationId: string,
	priorityIdsByWishlist: ReadonlyMap<string, readonly string[]>,
): string | null {
	const { priorityLevelId } = source.giftRow;
	if (priorityLevelId === null) {
		return null;
	}
	const ordinal = (priorityIdsByWishlist.get(source.wishlistRow.id) ?? []).indexOf(
		priorityLevelId,
	);
	return ordinal < 0 ? null : (priorityIdsByWishlist.get(destinationId)?.[ordinal] ?? null);
}

/**
 * Appends the destination's rows of the shared gifts at the end of its manual order, each in its
 * gift's group with the synced description segments and received state, and tells the followers
 * of an active list through the new-gift digest.
 */
async function appendSharedRows(
	context: MutationOperationContext,
	destination: WishlistRow,
	sources: readonly { source: SharedGiftSource; linkGroupId: string }[],
	priorityIdsByWishlist: ReadonlyMap<string, readonly string[]>,
): Promise<GiftWithImages[]> {
	const { transaction } = context;
	const newRows = [];
	for (const { source } of sources) {
		const { giftRow } = source;
		newRows.push({
			name: giftRow.name,
			description: giftRow.description,
			links: giftRow.links,
			price: giftRow.price,
			priceMax: giftRow.priceMax,
			currency: giftRow.currency,
			quantity: giftRow.quantity,
			// One gift's uploads are shared by its rows; image cleanup keeps referenced objects.
			images: giftRow.images,
			priorityLevelId: mappedPriorityLevelId(source, destination.id, priorityIdsByWishlist),
			categoryIds: await mapCategoriesIntoWishlist(
				transaction,
				destination.id,
				source.categories,
			),
		});
	}
	const created = await appendGiftsUsingTransaction(
		transaction,
		{
			wishlistId: destination.id,
			actorId: context.actor.userId,
			gifts: newRows,
			notifyFollowers: destination.status === 'active',
			recordRevisions: context.recordGiftRevisions,
		},
		context.now,
	);
	const sharedRows: GiftWithImages[] = [];
	for (const [index, createdRow] of created.entries()) {
		const { source, linkGroupId } = sources[index]!;
		const sharedState = {
			linkGroupId,
			descriptionAppends: source.giftRow.descriptionAppends,
			received: source.giftRow.received,
		};
		await transaction.update(gift).set(sharedState).where(eq(gift.id, createdRow.id));
		const sharedRow = { ...createdRow, ...sharedState };
		context.recordGiftRevisions([
			{
				giftId: createdRow.id,
				wishlistId: createdRow.wishlistId,
				before: createdRow,
				after: sharedRow,
			},
		]);
		sharedRows.push(sharedRow);
	}
	return sharedRows;
}

/**
 * Shares gifts with other recipients' wishlists (issue #737), or adds lists to gifts shared
 * already: each list gets its own row of the gift in one shared link group, with its own priority
 * and order, while every other field, reservations, received state and likes are the gift's.
 * Only a user managing every participating list may, and all lists need different recipients.
 */
export const shareGiftsOperation = defineOperation({
	name: 'shareGifts',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: ShareGiftsInputSchema,
	async run(context, input) {
		const { transaction, actor } = context;
		const giftIds = [...new Set(input.giftIds)];
		const requestedDestinationIds = [...new Set(input.wishlistIds)];
		const lockedSources = await lockShareSources(context, giftIds, requestedDestinationIds);
		const destinations = new Map<string, WishlistRow>();
		for (const destinationId of requestedDestinationIds) {
			destinations.set(
				destinationId,
				await requireShareDestination(transaction, actor.userId, destinationId),
			);
		}
		const linkGroupKinds = await loadLinkGroupKinds(
			transaction,
			lockedSources.map((source) => source.giftRow.linkGroupId),
		);
		const sources: SharedGiftSource[] = [];
		for (const lockedSource of lockedSources) {
			sources.push(
				await planSharedGiftSource(
					transaction,
					actor.userId,
					lockedSource,
					destinations,
					linkGroupKinds,
				),
			);
		}
		const sharedSources: { source: SharedGiftSource; linkGroupId: string }[] = [];
		for (const source of sources.filter((planned) => planned.destinationIds.length > 0)) {
			let linkGroupId = source.giftRow.linkGroupId;
			if (linkGroupId === null) {
				linkGroupId = await createLinkGroup(
					transaction,
					GIFT_LINK_GROUP_KIND.sharedAcrossRecipients,
				);
				await transaction
					.update(gift)
					.set({ linkGroupId })
					.where(eq(gift.id, source.giftRow.id));
			}
			sharedSources.push({ source, linkGroupId });
		}
		const priorityIdsByWishlist = await loadPriorityIdsByWishlist(transaction, [
			...sources.map((source) => source.wishlistRow.id),
			...destinations.keys(),
		]);
		const created: GiftWithImages[] = [];
		for (const destination of destinations.values()) {
			const destinationSources = sharedSources.filter(({ source }) =>
				source.destinationIds.includes(destination.id),
			);
			if (destinationSources.length > 0) {
				created.push(
					...(await appendSharedRows(
						context,
						destination,
						destinationSources,
						priorityIdsByWishlist,
					)),
				);
			}
		}
		const affectedWishlistShortIds = new Set([
			...sources.map((source) => source.wishlistRow.shortId),
			...sources.flatMap((source) =>
				source.siblings.map((member) => member.wishlist.shortId),
			),
			...[...destinations.values()].map((destination) => destination.shortId),
		]);
		return {
			createdIds: created.map((row) => row.id),
			affectedWishlistShortIds: [...affectedWishlistShortIds],
		};
	},
});

/**
 * The lists the actor could share all the given gifts with: lists they manage that are live, not
 * archived, do not hold the gift yet and whose recipient differs from every list already holding
 * it. None when the actor does not manage every list a gift is already on, as the share would
 * refuse. Choosing two lists of one recipient together is still refused when sharing.
 */
export const readGiftShareDestinationsOperation = defineOperation({
	name: 'readGiftShareDestinations',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.agent,
	input: ReadGiftShareDestinationsInputSchema,
	async run(context, input) {
		const actor = requireOperationActor(context.actor);
		const database = getDb();
		const giftRows = await database
			.select({ id: gift.id, wishlistId: gift.wishlistId, linkGroupId: gift.linkGroupId })
			.from(gift)
			.where(and(inArray(gift.id, [...new Set(input.giftIds)]), isNull(gift.deletedAt)));
		if (giftRows.length !== new Set(input.giftIds).size) {
			error(404, SERVER_ERROR.GIFT_NOT_FOUND);
		}
		const holderWishlists: (RecipientIdentity & { id: string })[] = [];
		for (const giftRow of giftRows) {
			const { wishlistRow } = await requireWishlistManagement(
				database,
				actor.userId,
				giftRow.wishlistId,
				{ lock: false },
			);
			const { siblings, managesEveryList } = await loadLiveSiblingsManagedBy(
				database,
				actor.userId,
				giftRow,
			);
			if (!managesEveryList) {
				return [];
			}
			holderWishlists.push(wishlistRow, ...siblings.map((member) => member.wishlist));
		}
		const holderWishlistIds = new Set(holderWishlists.map((holder) => holder.id));
		const candidates = await loadManagedOpenWishlists(database, actor.userId);
		return candidates
			.filter(
				(candidate) =>
					!holderWishlistIds.has(candidate.id) &&
					holderWishlists.every((holder) => !wishlistsShareRecipient(holder, candidate)),
			)
			.map((candidate) => ({
				id: candidate.id,
				shortId: candidate.shortId,
				title: candidate.title,
				status: candidate.status,
				kind: candidate.kind,
				recipientDisplayName: candidate.recipientDisplayName,
				recipientImage: candidate.recipientImage,
			}));
	},
});
