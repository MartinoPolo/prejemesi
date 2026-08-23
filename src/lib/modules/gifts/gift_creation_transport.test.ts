import { describe, expect, it, vi } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const thrown = new Error(message) as Error & { status: number };
		thrown.status = status;
		throw thrown;
	}),
}));

import { GiftCreationError } from './gift_creation_service.js';
import { mapGiftCreationError } from './gift_creation_transport.js';

describe('mapGiftCreationError', () => {
	it.each([
		['wishlist-not-found', 404, SERVER_ERROR.WISHLIST_NOT_FOUND],
		['wishlist-archived', 400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST],
		['incomplete-insert', 500, SERVER_ERROR.FAILED_TO_CREATE_GIFT],
	] as const)('maps %s with the real domain error class', (code, status, message) => {
		expect(() => mapGiftCreationError(new GiftCreationError(code, 'internal detail'))).toThrow(
			expect.objectContaining({ status, message }),
		);
	});

	it('rethrows unknown exceptions unchanged', () => {
		const unknown = new Error('database unavailable');
		expect(() => mapGiftCreationError(unknown)).toThrow(unknown);
	});
});
