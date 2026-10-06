import { describe, expect, it } from 'vitest';
import {
	giftContextActions,
	groupGiftContextActions,
	hasAdditionalGiftContextActions,
	type GiftContextActionContext,
} from './gift_context_actions.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';

const capabilityFlags = [
	'readOnly',
	'canEdit',
	'canReserve',
	'ownsReservation',
	'canTrackPurchased',
] as const;

/** Every role combined with every on/off assignment of the capability flags. */
function everyActionContext(): GiftContextActionContext[] {
	const roleContexts = Object.values(WISHLIST_ROLES).map(
		(role): GiftContextActionContext => ({
			role,
			primaryUrl: 'https://shop.test/gift',
			readOnly: false,
		}),
	);
	return capabilityFlags.reduce(
		(contexts, flag) =>
			contexts.flatMap((context) => [
				{ ...context, [flag]: false },
				{ ...context, [flag]: true },
			]),
		roleContexts,
	);
}

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

	it('derives More visibility from the commands currently placed as direct actions', () => {
		expect(hasAdditionalGiftContextActions(['reserve'], ['reserve'])).toBe(false);
		expect(
			hasAdditionalGiftContextActions(['received', 'reserve'], ['received', 'reserve']),
		).toBe(false);
		expect(hasAdditionalGiftContextActions(['received', 'reserve'], ['reserve'])).toBe(true);
		expect(hasAdditionalGiftContextActions(['open', 'reserve'], ['reserve'])).toBe(true);
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

	it('groups a visitor menu into the link group only', () => {
		expect(
			groupGiftContextActions(
				giftContextActions({
					role: 'visitor',
					primaryUrl: 'https://shop.test/gift',
					readOnly: false,
				}),
			),
		).toEqual([{ name: 'link', actions: ['open', 'copy'] }]);
	});

	it('groups a manager menu as link, gift, then organization actions', () => {
		expect(
			groupGiftContextActions(
				giftContextActions({
					role: 'recipient',
					primaryUrl: 'https://shop.test/gift',
					readOnly: false,
					canEdit: true,
				}),
			),
		).toEqual([
			{ name: 'link', actions: ['open', 'copy'] },
			{ name: 'gift', actions: ['edit', 'received', 'multiselect'] },
			{ name: 'organization', actions: ['priority', 'category'] },
		]);
	});

	it('places reservation and purchased actions in the gift group', () => {
		expect(
			groupGiftContextActions([
				'priority',
				'category',
				'received',
				'multiselect',
				'cancel-reservation',
				'purchased',
			]),
		).toEqual([
			{
				name: 'gift',
				actions: ['received', 'multiselect', 'cancel-reservation', 'purchased'],
			},
			{ name: 'organization', actions: ['priority', 'category'] },
		]);
		expect(groupGiftContextActions(['reserve'])).toEqual([
			{ name: 'gift', actions: ['reserve'] },
		]);
	});

	it('places every offered action in exactly one group for every role and capability', () => {
		for (const context of everyActionContext()) {
			const actions = giftContextActions(context);
			const groupedActions = groupGiftContextActions(actions).flatMap(
				(group) => group.actions,
			);
			expect([...groupedActions].sort()).toEqual([...actions].sort());
		}
	});

	it('omits every group without available actions', () => {
		expect(groupGiftContextActions([])).toEqual([]);
	});
});
