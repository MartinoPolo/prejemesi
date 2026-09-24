import { describe, expect, it } from 'vitest';
import { placeGiftActions } from './gift_action_placement.js';

describe('gift action placement', () => {
	it('overflows Received before Reserve and restores both when content width grows', () => {
		const common = {
			secondary: { id: 'received' as const, width: 92 },
			primary: { id: 'reserve' as const, width: 88 },
			moreWidth: 32,
			gap: 11,
			persistentMore: false,
		};

		expect(placeGiftActions({ ...common, contentWidth: 202 })).toEqual({
			showSecondary: true,
			showPrimary: true,
			showMore: false,
			overflowActions: [],
		});
		expect(placeGiftActions({ ...common, contentWidth: 142 })).toEqual({
			showSecondary: false,
			showPrimary: true,
			showMore: true,
			overflowActions: ['received'],
		});
		expect(placeGiftActions({ ...common, contentWidth: 42 })).toEqual({
			showSecondary: false,
			showPrimary: true,
			showMore: true,
			overflowActions: ['received'],
		});
		expect(placeGiftActions({ ...common, contentWidth: 202 })).toEqual({
			showSecondary: true,
			showPrimary: true,
			showMore: false,
			overflowActions: [],
		});
	});

	it.each(['reserve', 'cancel-reservation', 'received'] as const)(
		'never moves the primary %s command into More',
		(primaryAction) => {
			expect(
				placeGiftActions({
					contentWidth: 20,
					primary: { id: primaryAction, width: 120 },
					moreWidth: 40,
					gap: 12,
					persistentMore: true,
				}),
			).toEqual({
				showSecondary: false,
				showPrimary: true,
				showMore: true,
				overflowActions: [],
			});
		},
	);
});
