import * as v from 'valibot';
import { GiftDraftInputSchema } from '$lib/modules/gifts/types.js';
import { GiftCategoryPresetKeySchema } from '$lib/modules/gift-categories/types.js';
import {
	WISHLIST_THEMES,
	RECIPIENT_KIND,
	RECIPIENT_NAME_MAX_LENGTH,
} from '$lib/modules/wishlists/types.js';

const ImportCategoryResolutionSchema = v.variant('action', [
	v.object({
		action: v.literal('map-existing'),
		sourceLabel: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
		categoryId: v.string(),
	}),
	v.object({
		action: v.literal('enable-preset'),
		sourceLabel: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
		presetKey: GiftCategoryPresetKeySchema,
	}),
	v.object({
		action: v.literal('create-custom'),
		sourceLabel: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
		label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
	}),
]);

export type ImportCategoryResolution = v.InferOutput<typeof ImportCategoryResolutionSchema>;

/** Append committed import/batch drafts to an existing wishlist. */
export const ImportGiftsInputSchema = v.object({
	wishlistId: v.string(),
	gifts: v.pipe(v.array(GiftDraftInputSchema), v.maxLength(200)),
	categoryResolutions: v.optional(v.array(ImportCategoryResolutionSchema), []),
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
	categoryResolutions: v.optional(v.array(ImportCategoryResolutionSchema), []),
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
