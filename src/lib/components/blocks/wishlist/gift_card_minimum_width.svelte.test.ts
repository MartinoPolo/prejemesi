import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import {
	GiftCardTestHost,
	cleanupCardHosts,
	expectRaisedActionShadowInside,
	fixedHosts,
	makeVisitorGift,
} from '../gift/gift_card.test_fixtures.js';
import {
	MORE_ACTION_SELECTOR,
	expectRightAlignedAdjacentActions,
	settleActionPlacement,
	visibleAction,
	visibleActions,
} from '../gift/gift_action_geometry.test_fixtures.js';
import { GIFT_CARD_MINIMUM_WIDTH_REM } from './gift_card_grid_columns.js';

const { expectPixelsNear, expectPixelsAtLeast } = createPixelAssertions(expect);

const PRIMARY_ACTION_SELECTOR =
	'[data-testid="reserve-button"], [data-testid="gift-received-toggle"]';

const primaryActionStates = [
	{
		state: 'visitor Reserve',
		role: WISHLIST_ROLES.visitor,
		gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
	},
	{
		state: 'visitor own Cancel reservation',
		role: WISHLIST_ROLES.visitor,
		gift: makeVisitorGift({ myReservationId: 'mine', reservedCount: 1, isFullyReserved: true }),
	},
	{
		state: 'recipient Received',
		role: WISHLIST_ROLES.recipient,
		gift: makeVisitorGift({ received: false }),
	},
	{
		state: 'recipient Not received',
		role: WISHLIST_ROLES.recipient,
		gift: makeVisitorGift({ received: true }),
	},
	{
		state: 'manager Reserve',
		role: WISHLIST_ROLES.moderator,
		gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
	},
	{
		state: 'manager Not received on a gift reserved by others',
		role: WISHLIST_ROLES.moderator,
		gift: makeVisitorGift({
			myReservationId: null,
			reservedCount: 1,
			isFullyReserved: true,
			received: true,
		}),
	},
];

const scenarios = (['cs', 'en'] as const).flatMap((locale) =>
	(['soft', 'ink', 'black'] as const).flatMap((depth) =>
		primaryActionStates.map((actionState) => ({ ...actionState, locale, depth })),
	),
);

afterEach(() => {
	cleanupCardHosts();
	delete document.documentElement.dataset.depth;
	overwriteGetLocale(() => 'cs');
});

describe('Gift card minimum width', () => {
	it.each(scenarios)(
		'keeps $state and More on one line inside the card ($locale, $depth depth)',
		async ({ role, gift, locale, depth }) => {
			overwriteGetLocale(() => locale);
			document.documentElement.dataset.depth = depth;
			await page.viewport(1280, 900);
			const rootFontSize = Number.parseFloat(
				getComputedStyle(document.documentElement).fontSize,
			);
			const host = document.createElement('div');
			host.style.width = `${GIFT_CARD_MINIMUM_WIDTH_REM * rootFontSize}px`;
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
				{
					gift,
					role,
					onreceived: () => {},
					onreserve: () => {},
					onunreserve: () => {},
					onmore: () => {},
					persistentMore: true,
				},
				{ baseElement: host },
			);
			await document.fonts.ready;
			await settleActionPlacement();

			const surface = host.querySelector<HTMLElement>('.gift-card-painted-surface')!;
			const row = host.querySelector<HTMLElement>('[data-testid="gift-action-row"]')!;
			const primary = visibleAction(row, PRIMARY_ACTION_SELECTOR);
			const more = visibleAction(row, MORE_ACTION_SELECTOR);
			const footerContentRect = host
				.querySelector<HTMLElement>('[data-testid="gift-card-reservation-actions"]')!
				.getBoundingClientRect();

			expect(visibleActions(row)).toEqual([primary, more]);
			expectRightAlignedAdjacentActions(row, [primary, more], footerContentRect.right);
			expectPixelsNear(primary.getBoundingClientRect().height, 32);
			expectPixelsAtLeast(primary.getBoundingClientRect().left, footerContentRect.left);
			expectRaisedActionShadowInside(primary, surface);
			expectRaisedActionShadowInside(more, surface);
		},
	);
});
