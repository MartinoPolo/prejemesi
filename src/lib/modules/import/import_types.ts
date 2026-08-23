import * as v from 'valibot';
import { GiftDraftInputSchema } from '$lib/modules/gifts/types.js';
import {
	WISHLIST_THEMES,
	RECIPIENT_KIND,
	RECIPIENT_NAME_MAX_LENGTH,
} from '$lib/modules/wishlists/types.js';

/** Append committed import/batch drafts to an existing wishlist. */
export const ImportGiftsInputSchema = v.object({
	wishlistId: v.string(),
	gifts: v.pipe(v.array(GiftDraftInputSchema), v.maxLength(200)),
	acknowledgeDuplicates: v.optional(v.boolean(), false),
});

export type ImportGiftsInput = v.InferOutput<typeof ImportGiftsInputSchema>;

/**
 * Create a new wishlist (+ default priority levels) and seed it with drafts. Carries the same
 * recipient discriminator as the plain create flow (issue #99): for-me vs for-someone-else.
 */
const CreateWishlistFromImportBaseFields = {
	title: v.pipe(v.string(), v.trim(), v.minLength(1)),
	eventDate: v.optional(v.nullable(v.date())),
	theme: v.optional(v.picklist(WISHLIST_THEMES)),
	gifts: v.pipe(v.array(GiftDraftInputSchema), v.maxLength(200)),
};

export const CreateWishlistFromImportInputSchema = v.variant('recipientKind', [
	v.object({
		recipientKind: v.literal(RECIPIENT_KIND.self),
		...CreateWishlistFromImportBaseFields,
	}),
	v.object({
		recipientKind: v.literal(RECIPIENT_KIND.other),
		recipientName: v.pipe(
			v.string(),
			v.trim(),
			v.minLength(1),
			v.maxLength(RECIPIENT_NAME_MAX_LENGTH),
		),
		...CreateWishlistFromImportBaseFields,
	}),
]);

export type CreateWishlistFromImportInput = v.InferOutput<
	typeof CreateWishlistFromImportInputSchema
>;
