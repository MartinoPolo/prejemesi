import { describe, expect, it } from 'vitest';
import { giftContextActions } from './gift_context_actions.js';

describe('gift contextual actions', () => {
	it('offers visitors link actions only and no menu at all without a primary link', () => {
		expect(
			giftContextActions({
				role: 'visitor',
				primaryUrl: 'https://shop.test/gift',
				readOnly: false,
			}),
		).toEqual(['open', 'copy']);
		expect(giftContextActions({ role: 'visitor', primaryUrl: null, readOnly: false })).toEqual(
			[],
		);
	});

	it('offers managers permitted mutations but excludes card-only actions', () => {
		expect(
			giftContextActions({
				role: 'moderator',
				primaryUrl: 'https://shop.test/gift',
				readOnly: false,
				canEdit: true,
			}),
		).toEqual(['open', 'copy', 'edit', 'priority', 'category', 'received', 'multiselect']);
	});

	it('removes every mutation in archived and read-only contexts', () => {
		expect(
			giftContextActions({
				role: 'recipient',
				primaryUrl: 'https://shop.test/gift',
				readOnly: true,
				canEdit: true,
			}),
		).toEqual(['open', 'copy']);
	});
});
