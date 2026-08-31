import { fillImageMeta, fitImageMeta } from '$lib/modules/images/editor_modes.js';
import type { ImageMetadata } from '$lib/modules/images/types.js';
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

export function isBulkPresentationAction(input: BulkUpdateGiftsInput): boolean {
	return (
		input.action === 'priority' ||
		input.action === 'category' ||
		input.action === 'imageFit' ||
		input.action === 'imageBackground'
	);
}

export function bulkGiftUpdateData(
	input: BulkUpdateGiftsInput,
	gift: { id?: string; imageMeta: ImageMetadata | null },
): {
	priorityLevelId?: string | null;
	categoryId?: string | null;
	imageMeta?: ImageMetadata;
	received?: boolean;
} {
	switch (input.action) {
		case 'priority':
			return { priorityLevelId: input.priorityLevelId };
		case 'category':
			return { categoryId: input.categoryId };
		case 'received':
			return { received: input.received };
		case 'restoreReceived':
			return { received: input.states[(gift as { id?: string }).id ?? ''] };
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
