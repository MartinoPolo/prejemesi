import {
	readBulkCopyDestinationsOperation,
	readPriorityLevelsOperation,
	readWishlistGiftsOperation,
} from './gift_read_operations.js';
import {
	appendGiftDescriptionOperation,
	createGiftOperation,
	deleteGiftOperation,
	markGiftReceivedOperation,
	updateGiftOperation,
} from './gift_mutation_operations.js';
import {
	bulkCopyGiftsOperation,
	bulkUpdateGiftsOperation,
	reorderGiftsOperation,
} from './gift_bulk_operations.js';
import {
	undoGiftRevisionBatchOperation,
	undoGiftRevisionOperation,
} from './gift_undo_operations.js';
import {
	createWishlistOperation,
	renameRecipientOperation,
	saveWishlistSettingsOperation,
	setWishlistPaletteOperation,
	updateWishlistOperation,
} from './wishlist_detail_operations.js';
import {
	saveGiftCategorySettingsOperation,
	savePriorityLevelsOperation,
} from './gift_grouping_operations.js';
import {
	archiveWishlistOperation,
	deleteWishlistOperation,
	flipRecipientToFreeTextOperation,
	revertWishlistToDraftOperation,
	shareWishlistOperation,
} from './wishlist_lifecycle_operations.js';
import { createWishlistFromImportOperation, importGiftsOperation } from './import_operations.js';
import {
	cancelOwnReservationOperation,
	reserveGiftOperation,
	setReservationPurchasedOperation,
	unreserveGiftOperation,
} from './reservation_operations.js';
import {
	readMyGiftReservationsOperation,
	readReservationLedgerOperation,
} from './reservation_read_operations.js';
import {
	acceptModeratorInviteOperation,
	generateModeratorInviteLinkOperation,
	readWishlistModeratorsOperation,
	removeModeratorOperation,
	revokeModeratorInviteOperation,
	selfPromoteToModeratorOperation,
} from './manager_invitation_operations.js';
import type { AnyOperation } from './operation.js';

/** Every operation the core exposes, keyed by its name; agent surfaces are generated from this. */
export const OPERATION_REGISTRY = {
	[readWishlistGiftsOperation.name]: readWishlistGiftsOperation,
	[readBulkCopyDestinationsOperation.name]: readBulkCopyDestinationsOperation,
	[readPriorityLevelsOperation.name]: readPriorityLevelsOperation,
	[createGiftOperation.name]: createGiftOperation,
	[updateGiftOperation.name]: updateGiftOperation,
	[appendGiftDescriptionOperation.name]: appendGiftDescriptionOperation,
	[deleteGiftOperation.name]: deleteGiftOperation,
	[markGiftReceivedOperation.name]: markGiftReceivedOperation,
	[reorderGiftsOperation.name]: reorderGiftsOperation,
	[bulkUpdateGiftsOperation.name]: bulkUpdateGiftsOperation,
	[bulkCopyGiftsOperation.name]: bulkCopyGiftsOperation,
	[undoGiftRevisionBatchOperation.name]: undoGiftRevisionBatchOperation,
	[undoGiftRevisionOperation.name]: undoGiftRevisionOperation,
	[createWishlistOperation.name]: createWishlistOperation,
	[updateWishlistOperation.name]: updateWishlistOperation,
	[renameRecipientOperation.name]: renameRecipientOperation,
	[setWishlistPaletteOperation.name]: setWishlistPaletteOperation,
	[saveWishlistSettingsOperation.name]: saveWishlistSettingsOperation,
	[saveGiftCategorySettingsOperation.name]: saveGiftCategorySettingsOperation,
	[savePriorityLevelsOperation.name]: savePriorityLevelsOperation,
	[importGiftsOperation.name]: importGiftsOperation,
	[createWishlistFromImportOperation.name]: createWishlistFromImportOperation,
	[shareWishlistOperation.name]: shareWishlistOperation,
	[revertWishlistToDraftOperation.name]: revertWishlistToDraftOperation,
	[archiveWishlistOperation.name]: archiveWishlistOperation,
	[deleteWishlistOperation.name]: deleteWishlistOperation,
	[flipRecipientToFreeTextOperation.name]: flipRecipientToFreeTextOperation,
	[reserveGiftOperation.name]: reserveGiftOperation,
	[cancelOwnReservationOperation.name]: cancelOwnReservationOperation,
	[unreserveGiftOperation.name]: unreserveGiftOperation,
	[setReservationPurchasedOperation.name]: setReservationPurchasedOperation,
	[readReservationLedgerOperation.name]: readReservationLedgerOperation,
	[readMyGiftReservationsOperation.name]: readMyGiftReservationsOperation,
	[readWishlistModeratorsOperation.name]: readWishlistModeratorsOperation,
	[generateModeratorInviteLinkOperation.name]: generateModeratorInviteLinkOperation,
	[acceptModeratorInviteOperation.name]: acceptModeratorInviteOperation,
	[revokeModeratorInviteOperation.name]: revokeModeratorInviteOperation,
	[removeModeratorOperation.name]: removeModeratorOperation,
	[selfPromoteToModeratorOperation.name]: selfPromoteToModeratorOperation,
} as const satisfies Record<string, AnyOperation>;
