import * as v from 'valibot';
import { error, isHttpError } from '@sveltejs/kit';
import {
	publicQuery,
	guardedCommand,
	guardedQueryWithArgs,
	singleFlightRefresh,
} from '$lib/server/remote.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import {
	readBulkCopyDestinationsOperation,
	readPriorityLevelsOperation,
	readWishlistGiftsOperation,
} from '$lib/server/operations/gift_read_operations.js';
import {
	createGiftOperation,
	deleteGiftOperation,
	markGiftReceivedOperation,
	updateGiftOperation,
} from '$lib/server/operations/gift_mutation_operations.js';
import {
	bulkCopyGiftsOperation,
	bulkUpdateGiftsOperation,
	reorderGiftsOperation,
} from '$lib/server/operations/gift_bulk_operations.js';
import {
	CreateGiftInputSchema,
	UpdateGiftInputSchema,
	ReorderGiftsInputSchema,
	MarkGiftReceivedInputSchema,
	BulkUpdateGiftsInputSchema,
	GIFT_GROUPING_OPTIONS,
} from './types.js';
import { BulkCopyGiftsInputSchema } from './gift_bulk_copy.js';
import { getGiftCategories } from '$lib/modules/gift-categories/gift_category_queries.remote.js';

// Thin adapters over the operation core, which owns authorization and the post-share rules.

export const getGiftsByWishlistShortId = publicQuery(v.string(), (authContext, shortId) =>
	executeOperation(
		authContext === null ? null : userInterfaceActor(authContext.user),
		readWishlistGiftsOperation,
		{ wishlistShortId: shortId },
	),
);

export const createGift = guardedCommand(CreateGiftInputSchema, async ({ user }, input) => {
	const { gift, wishlistShortId } = await executeOperation(
		userInterfaceActor(user),
		createGiftOperation,
		input,
	);

	// Gift creation changes both the visible list and category assignment counts.
	singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
	singleFlightRefresh(getGiftCategories, input.wishlistId);

	return gift;
});

export const updateGift = guardedCommand(UpdateGiftInputSchema, async ({ user }, input) => {
	const { gift, wishlistId, wishlistShortId, didCategoryChange } = await executeOperation(
		userInterfaceActor(user),
		updateGiftOperation,
		input,
	);

	// Keep both gift data and category assignment counts current after category moves.
	singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
	if (didCategoryChange) {
		singleFlightRefresh(getGiftCategories, wishlistId);
	}

	return gift;
});

export const deleteGift = guardedCommand(v.string(), async ({ user }, giftId) => {
	const { wishlistId, wishlistShortId } = await executeOperation(
		userInterfaceActor(user),
		deleteGiftOperation,
		{ giftId },
	);

	// Deletion changes both the visible list and category assignment counts.
	singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
	singleFlightRefresh(getGiftCategories, wishlistId);
});

export const reorderGifts = guardedCommand(ReorderGiftsInputSchema, async ({ user }, input) => {
	const { wishlistShortId, changedGroupFields } = await executeOperation(
		userInterfaceActor(user),
		reorderGiftsOperation,
		input,
	);
	if (changedGroupFields.length === 0) {
		return;
	}
	// Group changes alter badges, groups and category counts; pure order changes stay optimistic.
	await singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
	if (changedGroupFields.includes(GIFT_GROUPING_OPTIONS.category)) {
		await singleFlightRefresh(getGiftCategories, input.wishlistId);
	}
});

export const bulkUpdateGifts = guardedCommand(
	BulkUpdateGiftsInputSchema,
	async ({ user }, input) => {
		const { updatedIds, priorReceived, wishlistShortId } = await executeOperation(
			userInterfaceActor(user),
			bulkUpdateGiftsOperation,
			input,
		);

		await singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
		if (input.action === 'category') {
			await singleFlightRefresh(getGiftCategories, input.wishlistId);
		}
		return { updatedIds, priorReceived };
	},
);

export const markGiftReceived = guardedCommand(
	MarkGiftReceivedInputSchema,
	async ({ user }, input) => {
		const { gift, wishlistShortId } = await executeOperation(
			userInterfaceActor(user),
			markGiftReceivedOperation,
			input,
		);

		// Single-flight refresh (issue #108, REQ-3/4): only the gift list rides back.
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);

		return gift;
	},
);

/** Eligible non-archived destinations managed by the current actor. */
export const getBulkCopyDestinations = guardedQueryWithArgs(
	v.string(),
	({ user }, sourceWishlistId) =>
		executeOperation(userInterfaceActor(user), readBulkCopyDestinationsOperation, {
			sourceWishlistId,
		}),
);

export const bulkCopyGifts = guardedCommand(BulkCopyGiftsInputSchema, async ({ user }, input) => {
	try {
		const { createdIds, removedSourceIds, destinationShortId, sourceShortId } =
			await executeOperation(userInterfaceActor(user), bulkCopyGiftsOperation, input);
		singleFlightRefresh(getGiftsByWishlistShortId, destinationShortId);
		singleFlightRefresh(getGiftCategories, input.destinationWishlistId);
		if (removedSourceIds.length > 0) {
			singleFlightRefresh(getGiftsByWishlistShortId, sourceShortId);
			singleFlightRefresh(getGiftCategories, input.sourceWishlistId);
		}
		return { createdIds, removedSourceIds };
	} catch (thrown) {
		if (isHttpError(thrown)) {
			throw thrown;
		}
		console.error('[Bulk gift copy] failed', thrown);
		error(500, SERVER_ERROR.BULK_COPY_FAILED);
	}
});

/** Fetch priority levels for a wishlist */
export const getPriorityLevels = guardedQueryWithArgs(v.string(), ({ user }, wishlistId) =>
	executeOperation(userInterfaceActor(user), readPriorityLevelsOperation, { wishlistId }),
);
