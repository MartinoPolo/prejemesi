import { describe, expect, it, vi } from 'vitest';
import {
	createDuplicateAwareImportState,
	submitDuplicateAwareImport,
} from './duplicate_aware_submission.js';

interface Draft {
	name: string;
}

describe('duplicate-aware import submission', () => {
	it('retries the exact drafts with acknowledgement and resets after success', async () => {
		const drafts: Draft[] = [{ name: 'Camera' }, { name: 'Book' }];
		const command = vi
			.fn()
			.mockResolvedValueOnce({ status: 'duplicate-warning', duplicateIndexes: [0] })
			.mockResolvedValueOnce({ status: 'created', gifts: [{ id: 'gift-1' }] });
		let state = createDuplicateAwareImportState<Draft>();

		const warning = await submitDuplicateAwareImport({
			command,
			wishlistId: 'wishlist-1',
			drafts,
			state,
		});
		state = warning.state;
		expect(command.mock.calls[0]![0]).toEqual({
			wishlistId: 'wishlist-1',
			gifts: drafts,
			acknowledgeDuplicates: false,
		});
		expect(state).toMatchObject({ acknowledgeDuplicates: true, duplicateCount: 1 });

		const success = await submitDuplicateAwareImport({
			command,
			wishlistId: 'wishlist-1',
			drafts: [{ name: 'Changed while warning is visible' }],
			state,
		});
		expect(command.mock.calls[1]![0]).toEqual({
			wishlistId: 'wishlist-1',
			gifts: drafts,
			acknowledgeDuplicates: true,
		});
		expect(success.state).toEqual(createDuplicateAwareImportState<Draft>());
	});
});
