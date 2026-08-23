import { error } from '@sveltejs/kit';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { GiftCreationError } from './gift_creation_service.js';

export function mapGiftCreationError(thrown: unknown): never {
	if (!(thrown instanceof GiftCreationError)) {
		throw thrown;
	}

	switch (thrown.code) {
		case 'wishlist-not-found':
			error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
		case 'wishlist-archived':
			error(400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
		case 'incomplete-insert':
			error(500, SERVER_ERROR.FAILED_TO_CREATE_GIFT);
	}
}
