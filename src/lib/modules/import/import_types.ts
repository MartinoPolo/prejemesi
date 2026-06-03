import * as v from 'valibot';
import { GiftDraftInputSchema } from '$lib/modules/gifts/types.js';
import { WISHLIST_THEMES } from '$lib/modules/wishlists/types.js';

/** Append committed import/batch drafts to an existing wishlist. */
export const ImportGiftsInputSchema = v.object({
	wishlistId: v.string(),
	gifts: v.array(GiftDraftInputSchema),
});

export type ImportGiftsInput = v.InferOutput<typeof ImportGiftsInputSchema>;

/** Create a new wishlist (+ default priority levels) and seed it with drafts. */
export const CreateWishlistFromImportInputSchema = v.object({
	title: v.pipe(v.string(), v.trim(), v.minLength(1)),
	eventDate: v.optional(v.nullable(v.date())),
	theme: v.optional(v.picklist(WISHLIST_THEMES)),
	gifts: v.array(GiftDraftInputSchema),
});

export type CreateWishlistFromImportInput = v.InferOutput<
	typeof CreateWishlistFromImportInputSchema
>;
