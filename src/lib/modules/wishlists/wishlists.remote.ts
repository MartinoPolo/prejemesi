import 'use server';

import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { guardedCommand, guardedQuery, publicCommand } from '$lib/server/remote.js';
import {
	DEFAULT_PRIORITY_LEVELS,
	type CreateWishlistInput,
	type UpdateWishlistInput,
} from './types.js';

// ── Queries ──────────────────────────────────────────────────────────────────

export const getMyWishlists = guardedQuery(async ({ user }) => {
	const database = getDb();
	return database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.ownerId, user.id), isNull(wishlist.deletedAt)))
		.orderBy(wishlist.createdAt);
});

export const getWishlistByShortId = publicCommand(async (authContext, shortId: string) => {
	const database = getDb();

	const rows = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.shortId, shortId), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = rows[0];
	if (row === undefined) {
		error(404, 'Wishlist not found');
	}

	const isOwner = authContext !== null && authContext.user.id === row.ownerId;
	const role = isOwner ? 'owner' : 'visitor';

	return { ...row, role } as const;
});

// ── Commands ─────────────────────────────────────────────────────────────────

export const createWishlist = guardedCommand(async ({ user }, input: CreateWishlistInput) => {
	const database = getDb();

	const [created] = await database
		.insert(wishlist)
		.values({
			ownerId: user.id,
			title: input.title,
			eventDate: input.eventDate ?? null,
			theme: input.theme ?? 'default',
		})
		.returning();

	if (created === undefined) {
		error(500, 'Failed to create wishlist');
	}

	// Auto-create default priority levels
	await database.insert(priorityLevel).values(
		DEFAULT_PRIORITY_LEVELS.map((level) => ({
			wishlistId: created.id,
			label: level.label,
			sortOrder: level.sortOrder,
		})),
	);

	return created;
});

export const updateWishlist = guardedCommand(async ({ user }, input: UpdateWishlistInput) => {
	const database = getDb();

	// Verify ownership
	const existing = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, input.id), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = existing[0];
	if (row === undefined) {
		error(404, 'Wishlist not found');
	}
	if (row.ownerId !== user.id) {
		error(403, 'Not authorized');
	}

	// Edit lock: if shared, only allow limited field updates
	const isShared = row.sharedAt !== null;

	const updateData: Record<string, unknown> = { updatedAt: new Date() };

	// Title and description can always be updated
	if (input.title !== undefined) {
		updateData['title'] = input.title;
	}
	if (input.description !== undefined) {
		updateData['description'] = input.description;
	}

	// These fields are locked after sharing
	if (!isShared) {
		if (input.eventDate !== undefined) {
			updateData['eventDate'] = input.eventDate;
		}
		if (input.theme !== undefined) {
			updateData['theme'] = input.theme;
		}
		if (input.customThemeColor !== undefined) {
			updateData['customThemeColor'] = input.customThemeColor;
		}
	}

	// Images can always be updated
	if (input.bannerImageKey !== undefined) {
		updateData['bannerImageKey'] = input.bannerImageKey;
	}
	if (input.thumbnailImageKey !== undefined) {
		updateData['thumbnailImageKey'] = input.thumbnailImageKey;
	}

	const [updated] = await database
		.update(wishlist)
		.set(updateData)
		.where(eq(wishlist.id, input.id))
		.returning();

	return updated;
});

export const archiveWishlist = guardedCommand(async ({ user }, wishlistId: string) => {
	const database = getDb();

	const existing = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = existing[0];
	if (row === undefined) {
		error(404, 'Wishlist not found');
	}
	if (row.ownerId !== user.id) {
		error(403, 'Not authorized');
	}

	const [archived] = await database
		.update(wishlist)
		.set({
			status: 'archived',
			archivedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(wishlist.id, wishlistId))
		.returning();

	return archived;
});

export const deleteWishlist = guardedCommand(async ({ user }, wishlistId: string) => {
	const database = getDb();

	const existing = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = existing[0];
	if (row === undefined) {
		error(404, 'Wishlist not found');
	}
	if (row.ownerId !== user.id) {
		error(403, 'Not authorized');
	}
	if (row.sharedAt !== null) {
		error(400, 'Cannot delete a shared wishlist. Archive it instead.');
	}

	// Soft delete
	await database
		.update(wishlist)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(wishlist.id, wishlistId));
});
