import * as v from 'valibot';
import { SaveGiftCategorySettingsInputSchema } from '$lib/modules/gift-categories/types.js';
import { WishlistImageSlotsSchema, type WishlistImageSlots } from '$lib/modules/images/types.js';
import { isPalette, type Palette } from '$lib/theme/palettes.js';
import { RECIPIENT_NAME_MAX_LENGTH, WISHLIST_TITLE_MAX_LENGTH } from './types.js';

const DetailsSchema = v.object({
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(WISHLIST_TITLE_MAX_LENGTH)),
	description: v.nullable(v.string()),
	eventDate: v.optional(v.nullable(v.date())),
	recipientName: v.optional(
		v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(RECIPIENT_NAME_MAX_LENGTH)),
	),
});

export const SaveWishlistSettingsInputSchema = v.object({
	wishlistId: v.string(),
	details: v.optional(DetailsSchema),
	categories: v.optional(v.omit(SaveGiftCategorySettingsInputSchema, ['wishlistId'])),
	palette: v.optional(v.custom<Palette>(isPalette)),
	image: v.optional(
		v.object({
			imageKey: v.nullable(v.string()),
			imageSlots: v.nullable(WishlistImageSlotsSchema),
		}),
	),
});

export interface SaveWishlistSettingsInput {
	wishlistId: string;
	details?: {
		title: string;
		description: string | null;
		eventDate?: Date | null;
		recipientName?: string;
	};
	categories?: Omit<v.InferOutput<typeof SaveGiftCategorySettingsInputSchema>, 'wishlistId'>;
	palette?: Palette;
	image?: { imageKey: string | null; imageSlots: WishlistImageSlots | null };
}
