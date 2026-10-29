import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { rejectDemoImageUpload } from '$lib/server/demo/scope.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { seedNewWishlist } from '$lib/modules/wishlists/wishlist_create.js';
import { SaveWishlistSettingsInputSchema } from '$lib/modules/wishlists/wishlist_settings_types.js';
import {
	CreateWishlistInputSchema,
	RenameRecipientInputSchema,
	SetWishlistPaletteInputSchema,
	UpdateWishlistInputSchema,
} from '$lib/modules/wishlists/types.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import { requireMutableManagedWishlist, type WishlistRow } from './wishlist_management.js';
import {
	authorizeWishlistUploadReplacement,
	planWishlistDetailEdit,
} from './wishlist_edit_rules.js';
import { saveLockedWishlistSettings } from './wishlist_settings.js';

async function updateWishlistRow(
	context: MutationOperationContext,
	wishlistId: string,
	values: Partial<WishlistRow>,
): Promise<WishlistRow | undefined> {
	const [updated] = await context.transaction
		.update(wishlist)
		.set({ ...values, updatedAt: context.now })
		.where(eq(wishlist.id, wishlistId))
		.returning();
	return updated;
}

/** Storage cannot join the transaction; replaced uploads are deleted once the batch commits. */
function deleteReplacedImagesAfterCommit(
	context: MutationOperationContext,
	replacedImageKeys: readonly (string | null)[],
): void {
	const deletedImageKeys = replacedImageKeys.filter((imageKey) => imageKey !== null);
	if (deletedImageKeys.length > 0) {
		context.deferEffect(() => deleteObjectsBestEffort(deletedImageKeys));
	}
}

/** Creates a draft wishlist with its default priority levels; the demo wishlist limit applies. */
export const createWishlistOperation = defineOperation({
	name: 'createWishlist',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: CreateWishlistInputSchema,
	run: (context, input) => seedNewWishlist(context.transaction, context.actor.userId, input),
});

export const updateWishlistOperation = defineOperation({
	name: 'updateWishlist',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: UpdateWishlistInputSchema,
	async run(context, input) {
		rejectDemoImageUpload(input.imageKey);
		// Locked so the replaced image key is the one this batch actually replaces.
		const wishlistRow = await requireMutableManagedWishlist(context, input.id, { lock: true });
		const replacedImageKey = await authorizeWishlistUploadReplacement(
			context.actor.userId,
			wishlistRow.imageKey,
			{ imageKey: input.imageKey, assignmentToken: input.imageAssignmentToken },
			'wishlist-banner',
		);
		const updated = await updateWishlistRow(
			context,
			input.id,
			planWishlistDetailEdit(wishlistRow, input, context.now),
		);
		deleteReplacedImagesAfterCommit(context, [replacedImageKey]);
		return { wishlist: updated, wishlistShortId: wishlistRow.shortId };
	},
});

/** Renames a free-text recipient; a linked recipient's account name is not editable here. */
export const renameRecipientOperation = defineOperation({
	name: 'renameRecipient',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: RenameRecipientInputSchema,
	async run(context, input) {
		const wishlistRow = await requireMutableManagedWishlist(context, input.id, { lock: false });
		if (wishlistRow.recipientUserId !== null) {
			error(400, SERVER_ERROR.RECIPIENT_RENAME_NOT_ALLOWED);
		}
		const updated = await updateWishlistRow(context, input.id, {
			recipientName: input.recipientName,
		});
		return { wishlist: updated, wishlistShortId: wishlistRow.shortId };
	},
});

export const setWishlistPaletteOperation = defineOperation({
	name: 'setWishlistPalette',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: SetWishlistPaletteInputSchema,
	async run(context, input) {
		const wishlistRow = await requireMutableManagedWishlist(context, input.wishlistId, {
			lock: false,
		});
		const updated = await updateWishlistRow(context, input.wishlistId, {
			palette: input.palette,
		});
		return { wishlist: updated, wishlistShortId: wishlistRow.shortId };
	},
});

/** Saves the staged settings draft (details, categories, palette, appearance, image) atomically. */
export const saveWishlistSettingsOperation = defineOperation({
	name: 'saveWishlistSettings',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: SaveWishlistSettingsInputSchema,
	async run(context, input) {
		const { replacedImageKeys, shortId } = await saveLockedWishlistSettings(context, input);
		deleteReplacedImagesAfterCommit(context, replacedImageKeys);
		return { wishlistShortId: shortId };
	},
});
