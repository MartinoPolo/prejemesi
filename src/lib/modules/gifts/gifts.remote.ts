import * as v from 'valibot';
import { eq, and, isNull, sql, count as drizzleCount, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift, reservation, giftLike } from '$lib/server/db/gift.schema.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { publicQuery, guardedCommand, guardedQueryWithArgs } from '$lib/server/remote.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { getAnonVisitorId } from '$lib/server/anonymous_visitor.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import {
	verifyManagerAccess,
	assertWishlistMutable,
	resolveWishlistRole,
} from '$lib/modules/wishlists/wishlist_access.js';
import {
	hidesReservationState,
	canSeeReserverNames,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CreateGiftInputSchema,
	UpdateGiftInputSchema,
	ReorderGiftItemSchema,
	MarkGiftReceivedInputSchema,
	DEFAULT_GIFT_CURRENCY,
	type GiftForRecipient,
	type GiftForVisitor,
} from './types.js';
import { normalizeGiftLinks } from './gift_url.js';
import { computePreShareOwnerEdit, jsonChanged } from './gift_post_share.js';
import {
	isOwnerSharedGiftDeleteGraceOpen,
	isPreShareOwnerFullEditGraceOpen,
} from './gift_deletion_rules.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';

export const getGiftsByWishlistShortId = publicQuery(v.string(), async (authContext, shortId) => {
	const database = getDb();

	// Find wishlist
	const wishlistRows = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.shortId, shortId), isNull(wishlist.deletedAt)))
		.limit(1);

	const wishlistRow = wishlistRows[0];
	if (wishlistRow === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}

	// Determine role
	const role: WishlistRole = await resolveWishlistRole(authContext, wishlistRow);

	// Fetch gifts with priority info
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
		})
		.from(gift)
		.leftJoin(priorityLevel, eq(gift.priorityLevelId, priorityLevel.id))
		.where(and(eq(gift.wishlistId, wishlistRow.id), isNull(gift.deletedAt)))
		.orderBy(gift.sortOrder);

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
		}));

		return { role, gifts: recipientGifts } as const;
	}

	// Visitor/Moderator: include reservation counts and like counts
	const giftIds = giftRows.map((row) => row.id);

	// Batch fetch active reservations with reserver display names (scoped to this
	// wishlist's gifts): account name for authenticated reservers, the signed
	// anonymous name otherwise. Counts and names derive from the same rows so they
	// can never disagree. Names are only emitted to viewers passing the
	// canSeeReserverNames gate below (issue #102 REQ-14) — a self-promoted
	// recipient reaches this branch but must see counts only, never identities.
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

	// Batch fetch like counts (scoped to this wishlist's gifts)
	const likeCounts = new Map<string, number>();
	if (giftIds.length > 0) {
		const lkCounts = await database
			.select({
				giftId: giftLike.giftId,
				count: drizzleCount(),
			})
			.from(giftLike)
			.where(and(inArray(giftLike.giftId, giftIds), isNull(giftLike.deletedAt)))
			.groupBy(giftLike.giftId);

		for (const row of lkCounts) {
			likeCounts.set(row.giftId, Number(row.count));
		}
	}

	// Batch fetch the current visitor's active reservation per gift (powers the unreserve UI).
	// Authenticated visitors match by userId; anonymous visitors match by their per-browser
	// capability cookie against reservation.anonymousVisitorId.
	const myReservations = new Map<string, { id: string; purchasedAt: Date | null }>();
	if (giftIds.length > 0) {
		const anonVisitorId = authContext === null ? getAnonVisitorId() : null;
		const ownershipFilter =
			authContext !== null
				? eq(reservation.userId, authContext.user.id)
				: anonVisitorId !== null
					? and(
							isNull(reservation.userId),
							eq(reservation.anonymousVisitorId, anonVisitorId),
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
					myReservations.set(row.giftId, { id: row.id, purchasedAt: row.purchasedAt });
				}
			}
		}
	}

	const includeReserverNames = canSeeReserverNames(role);

	const visitorGifts: GiftForVisitor[] = giftRows.map((row) => {
		const qty = row.quantity ?? 1;
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
			likeCount: likeCounts.get(row.id) ?? 0,
			reservedCount: reserved,
			isFullyReserved: reserved >= qty,
			reserverNames: includeReserverNames ? (reserverNamesByGiftId.get(row.id) ?? []) : [],
			myReservationId: myReservations.get(row.id)?.id ?? null,
			myReservationPurchasedAt: myReservations.get(row.id)?.purchasedAt ?? null,
		};
	});

	return { role, gifts: visitorGifts } as const;
});

// ── Commands ────────────────────────────────────────────────────────────────

export const createGift = guardedCommand(CreateGiftInputSchema, async ({ user }, input) => {
	const database = getDb();
	const { wishlistRow } = await verifyManagerAccess(user.id, input.wishlistId);
	assertWishlistMutable(wishlistRow);

	// Determine sortOrder: place at the end
	const maxSortRows = await database
		.select({ maxSort: sql<number>`COALESCE(MAX(${gift.sortOrder}), -1)` })
		.from(gift)
		.where(and(eq(gift.wishlistId, input.wishlistId), isNull(gift.deletedAt)));

	const nextSortOrder = input.sortOrder ?? Number(maxSortRows[0]?.maxSort ?? -1) + 1;

	const [created] = await database
		.insert(gift)
		.values({
			wishlistId: input.wishlistId,
			name: input.name,
			description: input.description ?? null,
			links: normalizeGiftLinks(input.links),
			price: input.price ?? null,
			currency: input.currency ?? DEFAULT_GIFT_CURRENCY,
			imageUrl: input.imageUrl ?? null,
			imageKey: input.imageKey ?? null,
			imageMeta: input.imageMeta ?? null,
			quantity: input.quantity ?? 1,
			priorityLevelId: input.priorityLevelId ?? null,
			sortOrder: nextSortOrder,
		})
		.returning();

	if (created === undefined) {
		error(500, SERVER_ERROR.FAILED_TO_CREATE_GIFT);
	}

	const followerRows = await database
		.select({ userId: wishlistFollower.userId })
		.from(wishlistFollower)
		.where(
			and(
				eq(wishlistFollower.wishlistId, input.wishlistId),
				isNull(wishlistFollower.unfollowedAt),
			),
		);

	await dispatchNotification({
		type: NOTIFICATION_TYPE.NEW_GIFT_ADDED,
		targetUserIds: followerRows
			.map((row) => row.userId)
			.filter(
				(targetUserId) =>
					targetUserId !== user.id && targetUserId !== wishlistRow.recipientUserId,
			),
		wishlistId: input.wishlistId,
		giftId: created.id,
		actorId: user.id,
		actorName: user.name,
	});

	return created;
});

export const updateGift = guardedCommand(UpdateGiftInputSchema, async ({ user }, input) => {
	const database = getDb();

	// Find the gift
	const giftRows = await database
		.select()
		.from(gift)
		.where(and(eq(gift.id, input.id), isNull(gift.deletedAt)))
		.limit(1);

	const giftRow = giftRows[0];
	if (giftRow === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}

	const { role, wishlistRow } = await verifyManagerAccess(user.id, giftRow.wishlistId);
	assertWishlistMutable(wishlistRow);

	const now = new Date();
	const isShared = wishlistRow.sharedAt !== null;
	const isPreShareGift = isShared && giftRow.createdAt <= wishlistRow.sharedAt!;
	// Within the initial 2-minute share grace window the recipient regains full edit. Later edits
	// deliberately do not reopen name or delete grace.
	const shareGraceOpen = isPreShareOwnerFullEditGraceOpen(
		{
			wishlistSharedAt: wishlistRow.sharedAt,
			giftCreatedAt: giftRow.createdAt,
		},
		now,
	);
	// The recipient editing a pre-share gift once the grace window has closed follows the per-field
	// rules (REQ-4/5): name is locked, quantity may only rise, description edits accrue as appends —
	// these protect gifters from the surprise-blind recipient. Správci (moderators), recipient edits
	// to post-share-created gifts, and in-window edits fall through to the full per-field write below.
	// A targeted segment edit (`descriptionAppendEdit`, issue #83) is always routed through the engine
	// – it carries its own per-segment window check that the full-write path cannot enforce – so it
	// stays validated even while the share window is open.
	const isPreShareRecipientEdit =
		role === WISHLIST_ROLES.recipient &&
		isPreShareGift &&
		(!shareGraceOpen || input.descriptionAppendEdit !== undefined);

	if (isPreShareRecipientEdit) {
		const outcome = computePreShareOwnerEdit(giftRow, input, now);
		if (outcome.rejection !== null) {
			error(outcome.rejection.status, outcome.rejection.code);
		}

		const updateData: Partial<typeof gift.$inferInsert> = {
			...outcome.updateData,
			updatedAt: now,
		};
		if (outcome.changed) {
			updateData.editedAfterShareAt = now;
		}

		const [updated] = await database
			.update(gift)
			.set(updateData)
			.where(eq(gift.id, input.id))
			.returning();

		return updated;
	}

	const updateData: Partial<typeof gift.$inferInsert> = { updatedAt: now };
	let didChange = false;

	if (input.name !== undefined && input.name !== giftRow.name) {
		updateData.name = input.name;
		didChange = true;
	}
	if (input.description !== undefined && input.description !== giftRow.description) {
		updateData.description = input.description;
		didChange = true;
	}
	if (input.links !== undefined) {
		const normalized = normalizeGiftLinks(input.links);
		if (jsonChanged(normalized, giftRow.links)) {
			updateData.links = normalized;
			didChange = true;
		}
	}
	if (input.price !== undefined && input.price !== giftRow.price) {
		updateData.price = input.price;
		didChange = true;
	}
	if (input.currency !== undefined && input.currency !== giftRow.currency) {
		updateData.currency = input.currency;
		didChange = true;
	}
	if (input.imageUrl !== undefined && input.imageUrl !== giftRow.imageUrl) {
		updateData.imageUrl = input.imageUrl;
		didChange = true;
	}
	if (input.imageKey !== undefined && input.imageKey !== giftRow.imageKey) {
		updateData.imageKey = input.imageKey;
		didChange = true;
	}
	if (input.imageMeta !== undefined && jsonChanged(input.imageMeta, giftRow.imageMeta)) {
		updateData.imageMeta = input.imageMeta;
		didChange = true;
	}
	if (input.quantity !== undefined && input.quantity !== giftRow.quantity) {
		updateData.quantity = input.quantity;
		didChange = true;
	}
	if (input.priorityLevelId !== undefined && input.priorityLevelId !== giftRow.priorityLevelId) {
		updateData.priorityLevelId = input.priorityLevelId;
		didChange = true;
	}

	// Transparency: any post-share edit (moderator, or recipient on a post-share-created gift) that
	// actually changes a field flags the gift as edited after sharing (REQ-6).
	if (isShared && didChange) {
		updateData.editedAfterShareAt = now;
	}

	const [updated] = await database
		.update(gift)
		.set(updateData)
		.where(eq(gift.id, input.id))
		.returning();

	// Storage cleanup (issue #107, REQ-6): replacing or removing an uploaded
	// image leaves no unreferenced R2 object behind.
	if (
		updated !== undefined &&
		updateData.imageKey !== undefined &&
		giftRow.imageKey !== null &&
		giftRow.imageKey !== updateData.imageKey
	) {
		await deleteObjectsBestEffort([giftRow.imageKey]);
	}

	if (updated !== undefined && role === WISHLIST_ROLES.moderator && didChange) {
		const reservationRows = await database
			.select({
				userId: reservation.userId,
				anonymousEmail: reservation.anonymousEmail,
			})
			.from(reservation)
			.where(and(eq(reservation.giftId, input.id), isNull(reservation.deletedAt)));

		await dispatchNotification({
			type: NOTIFICATION_TYPE.RESERVED_GIFT_EDITED,
			targetUserIds: reservationRows
				.map((row) => row.userId)
				.filter((userId): userId is string => userId !== null && userId !== user.id),
			targetEmails: reservationRows
				.map((row) => row.anonymousEmail)
				.filter((email): email is string => email !== null && email !== ''),
			wishlistId: giftRow.wishlistId,
			giftId: input.id,
			actorId: user.id,
			actorName: user.name,
		});
	}

	return updated;
});

export const deleteGift = guardedCommand(v.string(), async ({ user }, giftId) => {
	const database = getDb();

	// Find the gift
	const giftRows = await database
		.select()
		.from(gift)
		.where(and(eq(gift.id, giftId), isNull(gift.deletedAt)))
		.limit(1);

	const giftRow = giftRows[0];
	if (giftRow === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}

	const { role, wishlistRow } = await verifyManagerAccess(user.id, giftRow.wishlistId);
	assertWishlistMutable(wishlistRow);

	// Delete lock: recipient delete on shared wishlists is limited to the initial share grace for
	// pre-share gifts, or the creation grace for gifts added after sharing. Later edits do not reopen it.
	// Správci (moderators) are exempt — they see reservation state, so no inference leak to guard.
	const now = new Date();
	const isShared = wishlistRow.sharedAt !== null;
	if (role === WISHLIST_ROLES.recipient && isShared) {
		const deleteGraceOpen = isOwnerSharedGiftDeleteGraceOpen(
			{
				wishlistSharedAt: wishlistRow.sharedAt,
				giftCreatedAt: giftRow.createdAt,
			},
			now,
		);
		if (!deleteGraceOpen) {
			error(403, SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING);
		}
	}

	// Cannot delete reserved gifts
	const reservationRows = await database
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)))
		.limit(1);

	if (reservationRows[0] !== undefined) {
		error(400, SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT);
	}

	// Soft delete
	await database.update(gift).set({ deletedAt: now, updatedAt: now }).where(eq(gift.id, giftId));

	// Storage cleanup (issue #107, REQ-6): the uploaded image is unreachable
	// once the gift is deleted (no restore path exists) – drop the object.
	await deleteObjectsBestEffort([giftRow.imageKey]);
});

export const reorderGifts = guardedCommand(
	v.array(ReorderGiftItemSchema),
	async ({ user }, items) => {
		if (items.length === 0) {
			return;
		}

		const database = getDb();

		// Get the wishlistId from the first gift
		const firstGiftRows = await database
			.select({ wishlistId: gift.wishlistId })
			.from(gift)
			.where(eq(gift.id, items[0]!.id))
			.limit(1);

		const firstGift = firstGiftRows[0];
		if (firstGift === undefined) {
			error(404, SERVER_ERROR.GIFT_NOT_FOUND);
		}

		const { wishlistRow } = await verifyManagerAccess(user.id, firstGift.wishlistId);
		assertWishlistMutable(wishlistRow);

		const uniqueGiftIds = [...new Set(items.map((item) => item.id))];
		const reorderedGiftRows = await database
			.select({ id: gift.id, wishlistId: gift.wishlistId })
			.from(gift)
			.where(and(inArray(gift.id, uniqueGiftIds), isNull(gift.deletedAt)));

		if (
			reorderedGiftRows.length !== uniqueGiftIds.length ||
			reorderedGiftRows.some((row) => row.wishlistId !== firstGift.wishlistId) === true
		) {
			error(403, SERVER_ERROR.GIFT_WISHLIST_MISMATCH);
		}

		// Batch update sortOrder in a single CASE WHEN statement
		const now = new Date();
		const sortOrderCase = sql.join(
			items.map((item) => sql`WHEN ${gift.id} = ${item.id} THEN ${item.sortOrder}::integer`),
			sql` `,
		);
		await database
			.update(gift)
			.set({
				sortOrder: sql<number>`CASE ${sortOrderCase} END`,
				updatedAt: now,
			})
			.where(
				and(
					inArray(
						gift.id,
						items.map((item) => item.id),
					),
					eq(gift.wishlistId, firstGift.wishlistId),
					isNull(gift.deletedAt),
				),
			);
	},
);

export const markGiftReceived = guardedCommand(
	MarkGiftReceivedInputSchema,
	async ({ user }, input) => {
		const database = getDb();

		const giftRows = await database
			.select()
			.from(gift)
			.where(and(eq(gift.id, input.giftId), isNull(gift.deletedAt)))
			.limit(1);

		const giftRow = giftRows[0];
		if (giftRow === undefined) {
			error(404, SERVER_ERROR.GIFT_NOT_FOUND);
		}

		// Marking received is a management action (recipient or správce) — the recipient marks
		// their own gifts received; on a for-someone list the správce does it for the recipient.
		const { wishlistRow } = await verifyManagerAccess(user.id, giftRow.wishlistId);
		assertWishlistMutable(wishlistRow);

		const [updated] = await database
			.update(gift)
			.set({ received: input.received, updatedAt: new Date() })
			.where(eq(gift.id, input.giftId))
			.returning();

		return updated;
	},
);

/** Fetch priority levels for a wishlist */
export const getPriorityLevels = guardedQueryWithArgs(v.string(), async ({ user }, wishlistId) => {
	const database = getDb();

	// Verify access
	await verifyManagerAccess(user.id, wishlistId);

	return database
		.select()
		.from(priorityLevel)
		.where(eq(priorityLevel.wishlistId, wishlistId))
		.orderBy(priorityLevel.sortOrder);
});
