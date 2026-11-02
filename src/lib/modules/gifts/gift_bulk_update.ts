import { fillImageMeta, fitImageMeta } from '$lib/modules/images/editor_modes.js';
import type { ImageMetadata } from '$lib/modules/images/types.js';
import {
	giftCategoryIdsFromLegacyCategoryId,
	withGiftCategoryAdded,
	withGiftCategoryRemoved,
} from '$lib/modules/gift-categories/gift_category_assignment.js';
import type { BulkUpdateGiftsInput } from './types.js';

export type GiftBulkAction =
	Exclude<BulkUpdateGiftsInput, { action: 'restoreReceived' }> extends infer T
		? T extends { wishlistId: string; giftIds: string[] }
			? Omit<T, 'wishlistId' | 'giftIds'>
			: never
		: never;

export interface PendingGiftBulkActionDescriptor {
	action: GiftBulkAction['action'] | 'restoreReceived';
	count: number;
}

const CATEGORY_BULK_ACTIONS: ReadonlySet<BulkUpdateGiftsInput['action']> = new Set([
	'category',
	'addCategory',
	'removeCategory',
]);

/** Actions that write each gift's category list. */
export function isBulkCategoryAction(input: BulkUpdateGiftsInput): boolean {
	return CATEGORY_BULK_ACTIONS.has(input.action);
}

export function isBulkPresentationAction(input: BulkUpdateGiftsInput): boolean {
	return (
		input.action === 'priority' ||
		isBulkCategoryAction(input) ||
		input.action === 'imageFit' ||
		input.action === 'imageBackground'
	);
}

export function bulkGiftUpdateData(
	input: BulkUpdateGiftsInput,
	gift: { id?: string; imageMeta: ImageMetadata | null; categoryIds: readonly string[] },
): {
	priorityLevelId?: string | null;
	categoryIds?: string[];
	imageMeta?: ImageMetadata;
	received?: boolean;
} {
	switch (input.action) {
		case 'priority':
			return { priorityLevelId: input.priorityLevelId };
		case 'category':
			return {
				categoryIds: giftCategoryIdsFromLegacyCategoryId(
					gift.categoryIds,
					input.categoryId,
				),
			};
		case 'addCategory':
			return { categoryIds: withGiftCategoryAdded(gift.categoryIds, input.categoryId) };
		case 'removeCategory':
			return {
				categoryIds: withGiftCategoryRemoved(gift.categoryIds, input.categoryId),
			};
		case 'received':
			return { received: input.received };
		case 'restoreReceived':
			return { received: input.states[gift.id ?? ''] };
		case 'imageFit': {
			const background = gift.imageMeta?.bgColor ?? null;
			return {
				imageMeta: {
					...(input.fit === 'fill'
						? fillImageMeta(background)
						: fitImageMeta(background)),
					targets: undefined,
				},
			};
		}
		case 'imageBackground':
			return {
				imageMeta: { ...(gift.imageMeta ?? fillImageMeta()), bgColor: input.background },
			};
	}
}
