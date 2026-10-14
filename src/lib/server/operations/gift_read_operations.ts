import * as v from 'valibot';
import { and, count as drizzleCount, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftCategory, giftLike, reservation } from '$lib/server/db/gift.schema.js';
import { priorityLevel, wishlist } from '$lib/server/db/wishlist.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { getAnonVisitorId } from '$lib/server/anonymous_visitor.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { resolveWishlistRole } from '$lib/modules/wishlists/wishlist_access.js';
import {
	canSeeReserverNames,
	hidesReservationState,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import { publicGiftCategory } from '$lib/modules/gift-categories/gift_categories_service.js';
import type { GiftForRecipient, GiftForVisitor } from '$lib/modules/gifts/types.js';
import { OPERATION_KIND, defineOperation } from './operation.js';
import { requireWishlistManagement } from './wishlist_management.js';
import { requireOperationActor } from './actor.js';

/**
 * Role-filtered gifts of a wishlist. Surprise protection is enforced here: an ordinary recipient
 * gets no reservation data or like counts, and reserver names reach správci only.
 */
export const readWishlistGiftsOperation = defineOperation({
	name: 'readWishlistGifts',
	kind: OPERATION_KIND.read,
	input: v.strictObject({ wishlistShortId: v.string() }),
	async run({ actor }, { wishlistShortId }) {
		const database = getDb();

		const [wishlistRow] = await database
			.select()
			.from(wishlist)
			.where(
				and(
					eq(wishlist.shortId, wishlistShortId),
					isNull(wishlist.deletedAt),
					wishlistScope(),
				),
			)
			.limit(1);
		if (wishlistRow === undefined) {
			error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
		}

		const role = await resolveWishlistRole(
			actor === null ? null : { user: { id: actor.userId } },
			wishlistRow,
		);

		const giftRows = await database
			.select({
				id: gift.id,
				wishlistId: gift.wishlistId,
				name: gift.name,
				description: gift.description,
				descriptionAppends: gift.descriptionAppends,
				editedAfterShareAt: gift.editedAfterShareAt,
				links: gift.links,
				price: gift.price,
				priceMax: gift.priceMax,
				currency: gift.currency,
				imageUrl: gift.imageUrl,
				imageKey: gift.imageKey,
				imageMeta: gift.imageMeta,
				quantity: gift.quantity,
				sortOrder: gift.sortOrder,
				received: gift.received,
				createdAt: gift.createdAt,
				priorityLevelId: gift.priorityLevelId,
				priorityLabel: priorityLevel.label,
				prioritySortOrder: priorityLevel.sortOrder,
				categoryId: gift.categoryId,
				categoryPresetKey: giftCategory.presetKey,
				categoryCustomLabel: giftCategory.customLabel,
				categoryColor: giftCategory.color,
				categorySortOrder: giftCategory.sortOrder,
			})
			.from(gift)
			.leftJoin(priorityLevel, eq(gift.priorityLevelId, priorityLevel.id))
			.leftJoin(
				giftCategory,
				and(
					eq(gift.categoryId, giftCategory.id),
					eq(gift.wishlistId, giftCategory.wishlistId),
					isNull(giftCategory.deletedAt),
				),
			)
			.where(and(eq(gift.wishlistId, wishlistRow.id), isNull(gift.deletedAt)))
			.orderBy(gift.sortOrder);

		const giftCategoryForRow = (row: (typeof giftRows)[number]) =>
			row.categoryId === null ||
			(row.categoryPresetKey === null && row.categoryCustomLabel === null)
				? null
				: publicGiftCategory({
						id: row.categoryId,
						wishlistId: wishlistRow.id,
						presetKey: row.categoryPresetKey,
						customLabel: row.categoryCustomLabel,
						color: row.categoryColor!,
						sortOrder: row.categorySortOrder ?? 0,
						deletedAt: null,
						createdAt: new Date(0),
						updatedAt: new Date(0),
					});

		if (hidesReservationState(role, wishlistRow.recipientIsModerator)) {
			// Recipient without self-promote: no reservation data, no like counts (protects the surprise)
			const recipientGifts: GiftForRecipient[] = giftRows.map((row) => ({
				id: row.id,
				wishlistId: row.wishlistId,
				name: row.name,
				description: row.description,
				descriptionAppends: row.descriptionAppends,
				editedAfterShareAt: row.editedAfterShareAt,
				links: row.links,
				price: row.price,
				priceMax: row.priceMax,
				currency: row.currency,
				imageUrl: row.imageUrl,
				imageKey: row.imageKey,
				imageMeta: row.imageMeta,
				quantity: row.quantity,
				sortOrder: row.sortOrder,
				received: row.received,
				createdAt: row.createdAt,
				priorityLevelId: row.priorityLevelId,
				priorityLabel: row.priorityLabel,
				prioritySortOrder: row.prioritySortOrder,
				categoryId: row.categoryId ?? null,
				category: giftCategoryForRow(row),
			}));

			return { role, gifts: recipientGifts } as const;
		}

		const giftIds = giftRows.map((row) => row.id);

		// Counts and names derive from the same reservation rows so they can never disagree; names
		// are only EMITTED to správci (issue #198) via the canSeeReserverNames gate below.
		const reservationCounts = new Map<string, number>();
		const reserverNamesByGiftId = new Map<string, string[]>();
		if (giftIds.length > 0) {
			const reservationRows = await database
				.select({
					giftId: reservation.giftId,
					quantity: reservation.quantity,
					reserverName: sql<
						string | null
					>`COALESCE(${user.name}, ${reservation.anonymousName})`,
				})
				.from(reservation)
				.leftJoin(user, eq(reservation.userId, user.id))
				.where(and(inArray(reservation.giftId, giftIds), isNull(reservation.deletedAt)))
				.orderBy(reservation.createdAt);

			for (const row of reservationRows) {
				reservationCounts.set(
					row.giftId,
					(reservationCounts.get(row.giftId) ?? 0) + Number(row.quantity),
				);
				if (row.reserverName !== null && row.reserverName.trim() !== '') {
					const names = reserverNamesByGiftId.get(row.giftId);
					if (names === undefined) {
						reserverNamesByGiftId.set(row.giftId, [row.reserverName]);
					} else if (!names.includes(row.reserverName)) {
						names.push(row.reserverName);
					}
				}
			}
		}

		const likeCounts = new Map<string, number>();
		if (giftIds.length > 0) {
			const likeCountRows = await database
				.select({
					giftId: giftLike.giftId,
					count: drizzleCount(),
				})
				.from(giftLike)
				.where(and(inArray(giftLike.giftId, giftIds), isNull(giftLike.deletedAt)))
				.groupBy(giftLike.giftId);

			for (const row of likeCountRows) {
				likeCounts.set(row.giftId, Number(row.count));
			}
		}

		// The viewer's own active reservation per gift powers the unreserve UI. Accounts match by user
		// id; anonymous visitors by their per-browser capability cookie.
		const myReservations = new Map<string, { id: string; purchasedAt: Date | null }>();
		if (giftIds.length > 0) {
			const anonymousVisitorId = actor === null ? getAnonVisitorId() : null;
			const ownershipFilter =
				actor !== null
					? eq(reservation.userId, actor.userId)
					: anonymousVisitorId !== null
						? and(
								isNull(reservation.userId),
								eq(reservation.anonymousVisitorId, anonymousVisitorId),
							)
						: null;

			if (ownershipFilter !== undefined && ownershipFilter !== null) {
				const myRows = await database
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

				for (const row of myRows) {
					// Keep the earliest active reservation per gift
					if (!myReservations.has(row.giftId)) {
						myReservations.set(row.giftId, {
							id: row.id,
							purchasedAt: row.purchasedAt,
						});
					}
				}
			}
		}

		const includeReserverNames = canSeeReserverNames(role);

		const visitorGifts: GiftForVisitor[] = giftRows.map((row) => {
			const quantity = row.quantity ?? 1;
			const reserved = reservationCounts.get(row.id) ?? 0;
			return {
				id: row.id,
				wishlistId: row.wishlistId,
				name: row.name,
				description: row.description,
				descriptionAppends: row.descriptionAppends,
				editedAfterShareAt: row.editedAfterShareAt,
				links: row.links,
				price: row.price,
				priceMax: row.priceMax,
				currency: row.currency,
				imageUrl: row.imageUrl,
				imageKey: row.imageKey,
				imageMeta: row.imageMeta,
				quantity: row.quantity,
				sortOrder: row.sortOrder,
				received: row.received,
				createdAt: row.createdAt,
				priorityLevelId: row.priorityLevelId,
				priorityLabel: row.priorityLabel,
				prioritySortOrder: row.prioritySortOrder,
				categoryId: row.categoryId ?? null,
				category: giftCategoryForRow(row),
				likeCount: likeCounts.get(row.id) ?? 0,
				reservedCount: reserved,
				isFullyReserved: reserved >= quantity,
				reserverNames: includeReserverNames
					? (reserverNamesByGiftId.get(row.id) ?? [])
					: [],
				myReservationId: myReservations.get(row.id)?.id ?? null,
				myReservationPurchasedAt: myReservations.get(row.id)?.purchasedAt ?? null,
			};
		});

		return { role, gifts: visitorGifts } as const;
	},
});

/** Eligible non-archived copy destinations managed by the actor. */
export const readBulkCopyDestinationsOperation = defineOperation({
	name: 'readBulkCopyDestinations',
	kind: OPERATION_KIND.read,
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
