import { imagePublicUrl, resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
import type { GiftBase, GiftByRole, GiftForRecipient } from '$lib/modules/gifts/types.js';
import type { wishlist } from '$lib/server/db/wishlist.schema.js';
import type {
	readBulkCopyDestinationsOperation,
	readWishlistGiftsOperation,
} from '$lib/server/operations/gift_read_operations.js';
import type { readWishlistOperation } from '$lib/server/operations/wishlist_read_operations.js';
import type { AccessibleWishlist } from '$lib/modules/wishlists/accessible_wishlists.js';
import type { ChangeProposalGift } from '$lib/modules/change_proposals/types.js';
import {
	currentGiftRevisionSnapshot,
	type GiftRevisionSnapshot,
} from '$lib/server/operations/gift_revision_snapshot.js';
import { primaryGiftCategoryId } from '$lib/modules/gift-categories/gift_category_assignment.js';
import { sanitizeWishlistAppearance } from '$lib/modules/wishlists/wishlist_appearance.js';
import { resolveWishlistBackground, resolveWishlistStyle } from '$lib/theme/wishlist_themes.js';

type ReadWishlistOutput = Awaited<ReturnType<typeof readWishlistOperation.run>>;
type ReadWishlistGiftsOutput = Awaited<ReturnType<typeof readWishlistGiftsOperation.run>>;
type ReadBulkCopyDestinationsOutput = Awaited<
	ReturnType<typeof readBulkCopyDestinationsOperation.run>
>;

type AgentWishlistSource = Pick<
	typeof wishlist.$inferSelect,
	| 'id'
	| 'shortId'
	| 'recipientName'
	| 'title'
	| 'description'
	| 'eventDate'
	| 'status'
	| 'kind'
	| 'palette'
	| 'themeId'
	| 'styleTokens'
	| 'background'
	| 'imageKey'
	| 'recipientIsModerator'
	| 'sharedAt'
	| 'archivedAt'
	| 'createdAt'
	| 'updatedAt'
>;

/** The theme and its resolved look; the custom background's storage key stays internal. */
function projectAgentAppearance(wishlistRow: AgentWishlistSource) {
	const appearance = sanitizeWishlistAppearance(wishlistRow);
	return {
		themeId: appearance.themeId,
		style: resolveWishlistStyle(appearance.themeId, appearance.styleTokens),
		backgroundMode: resolveWishlistBackground(appearance.background).mode,
	};
}

/**
 * A wishlist as agents see it, from a read or a mutation's row. Listed field by field so internal
 * columns (demo session, recipient account id, superseded theme, edit-grace bookkeeping) never
 * reach an API response.
 */
export function projectAgentWishlistRow(wishlistRow: AgentWishlistSource) {
	return {
		id: wishlistRow.id,
		shortId: wishlistRow.shortId,
		recipientName: wishlistRow.recipientName,
		title: wishlistRow.title,
		description: wishlistRow.description,
		eventDate: wishlistRow.eventDate,
		status: wishlistRow.status,
		kind: wishlistRow.kind,
		palette: wishlistRow.palette,
		...projectAgentAppearance(wishlistRow),
		imageUrl: wishlistRow.imageKey === null ? null : imagePublicUrl(wishlistRow.imageKey),
		recipientIsModerator: wishlistRow.recipientIsModerator,
		sharedAt: wishlistRow.sharedAt,
		archivedAt: wishlistRow.archivedAt,
		createdAt: wishlistRow.createdAt,
		updatedAt: wishlistRow.updatedAt,
	};
}

/** The read wishlist adds the viewer's role and the people around it; capabilities stay human. */
export function projectAgentWishlist(wishlistOutput: ReadWishlistOutput) {
	return {
		...projectAgentWishlistRow(wishlistOutput),
		recipientDisplayName: wishlistOutput.recipientDisplayName,
		recipientImage: wishlistOutput.recipientImage,
		managerNames: wishlistOutput.managerNames,
		role: wishlistOutput.role,
	};
}

type AgentGiftSource = Pick<
	GiftBase,
	| 'id'
	| 'wishlistId'
	| 'name'
	| 'description'
	| 'descriptionAppends'
	| 'editedAfterShareAt'
	| 'links'
	| 'price'
	| 'priceMax'
	| 'currency'
	| 'imageUrl'
	| 'imageKey'
	| 'imageMeta'
	| 'quantity'
	| 'sortOrder'
	| 'received'
	| 'createdAt'
	| 'priorityLevelId'
	| 'categoryIds'
>;

/**
 * A gift as agents see it, from a read or a mutation's row: the storage key becomes its public
 * image URL, and internal columns (deletion, share-time snapshot) are left out.
 */
export function projectAgentGiftRow(giftRow: AgentGiftSource) {
	return {
		id: giftRow.id,
		wishlistId: giftRow.wishlistId,
		name: giftRow.name,
		description: giftRow.description,
		descriptionAppends: giftRow.descriptionAppends,
		editedAfterShareAt: giftRow.editedAfterShareAt,
		links: giftRow.links,
		price: giftRow.price,
		priceMax: giftRow.priceMax,
		currency: giftRow.currency,
		imageUrl: resolveGiftImageUrl(giftRow.imageUrl, giftRow.imageKey),
		imageMeta: giftRow.imageMeta,
		quantity: giftRow.quantity,
		sortOrder: giftRow.sortOrder,
		received: giftRow.received,
		createdAt: giftRow.createdAt,
		priorityLevelId: giftRow.priorityLevelId,
		categoryIds: giftRow.categoryIds,
		// Superseded by `categoryIds`; kept for agents written against the single category.
		categoryId: primaryGiftCategoryId(giftRow.categoryIds),
	};
}

/**
 * A gift's revision snapshot as a proposal shows it: the storage key becomes its public image URL
 * and the share-time snapshot stays internal. Snapshots carry no reservation or like data, so the
 * same shape suits every viewer role.
 */
export function projectAgentGiftSnapshot(snapshot: GiftRevisionSnapshot): ChangeProposalGift {
	return {
		name: snapshot.name,
		description: snapshot.description,
		descriptionAppends: snapshot.descriptionAppends,
		links: snapshot.links,
		price: snapshot.price,
		priceMax: snapshot.priceMax,
		currency: snapshot.currency,
		imageUrl: resolveGiftImageUrl(snapshot.imageUrl, snapshot.imageKey),
		imageMeta: snapshot.imageMeta,
		quantity: snapshot.quantity,
		priorityLevelId: snapshot.priorityLevelId,
		categoryIds: currentGiftRevisionSnapshot(snapshot).categoryIds,
		received: snapshot.received,
		deleted: snapshot.deletedAt !== null,
		editedAfterShareAt: snapshot.editedAfterShareAt,
	};
}

function projectAgentGiftBase(gift: GiftForRecipient) {
	return {
		...projectAgentGiftRow(gift),
		priorityLabel: gift.priorityLabel,
		prioritySortOrder: gift.prioritySortOrder,
		categories: gift.categories,
		// Superseded by `categories`: the primary category only.
		category: gift.categories[0] ?? null,
	};
}

/**
 * Reservation state and counts for viewers the core shows them to; reserver names only with the
 * `reservations:identities` scope. A recipient's gifts arrive from the core without any
 * reservation or like data and stay that way. No reserver email is ever part of a gift.
 */
function projectAgentGift(gift: GiftByRole, options: { includeReserverNames: boolean }) {
	const giftBase = projectAgentGiftBase(gift);
	if (!('reservedCount' in gift)) {
		return giftBase;
	}
	return {
		...giftBase,
		likeCount: gift.likeCount,
		reservedCount: gift.reservedCount,
		isFullyReserved: gift.isFullyReserved,
		myReservationId: gift.myReservationId,
		myReservationPurchasedAt: gift.myReservationPurchasedAt,
		...(options.includeReserverNames ? { reserverNames: gift.reserverNames } : {}),
	};
}

export function projectAgentWishlistGifts(
	giftsOutput: ReadWishlistGiftsOutput,
	options: { includeReserverNames: boolean },
) {
	return {
		role: giftsOutput.role,
		gifts: giftsOutput.gifts.map((gift: GiftByRole) => projectAgentGift(gift, options)),
	};
}

/** A wishlist-restricted token sees only the destinations it may reach. */
export function projectAgentBulkCopyDestinations(
	destinations: ReadBulkCopyDestinationsOutput,
	allowedWishlistIds: readonly string[] | null,
) {
	const reachable =
		allowedWishlistIds === null
			? destinations
			: destinations.filter((destination) => allowedWishlistIds.includes(destination.id));
	return reachable.map((destination) => ({
		id: destination.id,
		title: destination.title,
		status: destination.status,
		kind: destination.kind,
		recipientDisplayName: destination.recipientDisplayName,
	}));
}

/** A wishlist-restricted token sees only its wishlists in the list of the user's wishlists. */
export function projectAgentAccessibleWishlists(
	wishlists: readonly AccessibleWishlist[],
	allowedWishlistIds: readonly string[] | null,
) {
	const reachable =
		allowedWishlistIds === null
			? wishlists
			: wishlists.filter((accessible) => allowedWishlistIds.includes(accessible.id));
	return reachable.map((accessible) => ({
		id: accessible.id,
		shortId: accessible.shortId,
		title: accessible.title,
		recipientDisplayName: accessible.recipientDisplayName,
		status: accessible.status,
		kind: accessible.kind,
		eventDate: accessible.eventDate,
		role: accessible.role,
	}));
}
