import { describe, expect, it } from 'vitest';
import { giftContextActions, hasAdditionalGiftContextActions } from './gift_context_actions.js';

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

	it('offers reservation ownership and purchased actions from explicit capabilities', () => {
		expect(
			giftContextActions({
				role: 'moderator',
				primaryUrl: null,
				readOnly: false,
				canEdit: false,
				canReserve: true,
				ownsReservation: true,
				canTrackPurchased: true,
			}),
		).toEqual([
			'priority',
			'category',
			'received',
			'multiselect',
			'cancel-reservation',
			'purchased',
		]);
	});

	it('derives visitor More visibility from actions outside Reserve and Cancel reservation', () => {
		expect(hasAdditionalGiftContextActions(['reserve'], 'visitor')).toBe(false);
		expect(hasAdditionalGiftContextActions(['cancel-reservation'], 'visitor')).toBe(false);
		expect(hasAdditionalGiftContextActions(['purchased'], 'visitor')).toBe(true);
		expect(hasAdditionalGiftContextActions(['open'], 'visitor')).toBe(true);
	});

	it('derives manager More visibility from actions outside Received', () => {
		expect(hasAdditionalGiftContextActions(['received'], 'moderator')).toBe(false);
		expect(hasAdditionalGiftContextActions(['edit'], 'moderator')).toBe(true);
		expect(hasAdditionalGiftContextActions(['priority'], 'moderator')).toBe(true);
		expect(hasAdditionalGiftContextActions(['reserve'], 'moderator')).toBe(true);
	});

	it('keeps only cancellation of an own reservation in archived contexts', () => {
		expect(
			giftContextActions({
				role: 'visitor',
				primaryUrl: 'https://shop.test/gift',
				readOnly: true,
				canReserve: true,
				ownsReservation: true,
				canTrackPurchased: true,
			}),
		).toEqual(['open', 'copy', 'cancel-reservation']);
	});
});
