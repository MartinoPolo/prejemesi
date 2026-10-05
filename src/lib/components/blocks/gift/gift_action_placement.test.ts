import { describe, expect, it } from 'vitest';
import { placeGiftActions } from './gift_action_placement.js';

describe('gift action placement', () => {
	it('overflows Received before Reserve and restores both when content width grows', () => {
		const common = {
			secondary: [{ id: 'received' as const, width: 92 }],
			primary: { id: 'reserve' as const, width: 88 },
			moreWidth: 32,
			gap: 11,
			persistentMore: false,
		};

		expect(placeGiftActions({ ...common, contentWidth: 202 })).toEqual({
			visibleSecondaryActions: ['received'],
			showPrimary: true,
			showMore: false,
			overflowActions: [],
		});
		expect(placeGiftActions({ ...common, contentWidth: 142 })).toEqual({
			visibleSecondaryActions: [],
			showPrimary: true,
			showMore: true,
			overflowActions: ['received'],
		});
		expect(placeGiftActions({ ...common, contentWidth: 42 })).toEqual({
			visibleSecondaryActions: [],
			showPrimary: true,
			showMore: true,
			overflowActions: ['received'],
		});
		expect(placeGiftActions({ ...common, contentWidth: 202 })).toEqual({
			visibleSecondaryActions: ['received'],
			showPrimary: true,
			showMore: false,
			overflowActions: [],
		});
	});

	it('keeps Bought beside Received while both fit and moves Bought into More first', () => {
		const common = {
			secondary: [
				{ id: 'purchased' as const, width: 90 },
				{ id: 'received' as const, width: 92 },
			],
			primary: { id: 'cancel-reservation' as const, width: 100 },
			moreWidth: 32,
			gap: 8,
			persistentMore: false,
		};

		expect(placeGiftActions({ ...common, contentWidth: 298 })).toEqual({
			visibleSecondaryActions: ['purchased', 'received'],
			showPrimary: true,
			showMore: false,
			overflowActions: [],
		});
		expect(placeGiftActions({ ...common, contentWidth: 240 })).toEqual({
			visibleSecondaryActions: ['received'],
			showPrimary: true,
			showMore: true,
			overflowActions: ['purchased'],
		});
		expect(placeGiftActions({ ...common, contentWidth: 200 })).toEqual({
			visibleSecondaryActions: [],
			showPrimary: true,
			showMore: true,
			overflowActions: ['purchased', 'received'],
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
				visibleSecondaryActions: [],
				showPrimary: true,
				showMore: true,
				overflowActions: [],
			});
		},
	);
});
