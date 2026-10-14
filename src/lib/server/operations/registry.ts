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
} as const satisfies Record<string, AnyOperation>;
