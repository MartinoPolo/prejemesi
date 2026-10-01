import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	expectRightAlignedAdjacentActions,
	MORE_ACTION_SELECTOR,
	RECEIVED_ACTION_SELECTOR,
	RESERVE_ACTION_SELECTOR,
	resolvedCssLength,
	visibleAction,
	visibleActions,
} from './gift_action_geometry.test_fixtures.js';
import {
	GiftCardTestHost,
	MOBILE_VIEWPORT_WIDTH,
	cleanupCardHosts,
	fixedHosts,
	makeVisitorGift,
} from './gift_card.test_fixtures.js';

const DESKTOP_CARD_HOST_WIDTH = 360;
const MOBILE_CARD_HOST_WIDTH = 296;
const NARROW_OVERFLOW_CARD_HOST_WIDTH = 210;

afterEach(cleanupCardHosts);

describe('GiftCard actions (issue #255)', () => {
	it('does not render Like for an archived visitor gift while preserving own cancellation', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ myReservationId: 'reservation-1' }),
				role: WISHLIST_ROLES.visitor,
				isArchived: true,
				onunreserve: () => {},
			},
			{ baseElement: host },
		);

		expect(host.querySelector('[data-like-heart]')).toBeNull();
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeTruthy();
	});

	it('keeps manager reservation and received callbacks in the footer without duplicates', async () => {
		await page.viewport(800, 720);
		const onreserve = vi.fn();
		const onreceived = vi.fn();
		const host = document.createElement('div');
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreserve,
				onreceived,
			},
			{ baseElement: host },
		);

		const footer = host.querySelector('[data-testid="gift-card-footer"]') as HTMLElement;
		const image = host.querySelector('[data-testid="gift-card-image-frame"]') as HTMLElement;
		const reserve = host.querySelectorAll<HTMLElement>('[data-testid="reserve-button"]');
		const received = host.querySelector(
			'[data-testid="gift-received-toggle"]',
		) as HTMLButtonElement;
		expect(reserve).toHaveLength(1);
		expect(footer.contains(reserve[0]!)).toBe(true);
		expect(image.querySelector('[data-testid="reserve-button"]')).toBeNull();
		reserve[0]!.click();
		received.click();
		expect(onreserve).toHaveBeenCalledOnce();
		expect(onreceived).toHaveBeenCalledWith('gift-1', true);

		const withoutReceivedHost = document.createElement('div');
		document.body.appendChild(withoutReceivedHost);
		fixedHosts.add(withoutReceivedHost);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ id: 'gift-without-received', myReservationId: null }),
				role: WISHLIST_ROLES.moderator,
				onreserve: () => {},
			},
			{ baseElement: withoutReceivedHost },
		);
		expect(withoutReceivedHost.querySelectorAll('[data-testid="reserve-button"]')).toHaveLength(
			1,
		);
	});

	it('does not host reservation release even when the context permits it', async () => {
		await render(GiftCardTestHost, {
			gift: makeVisitorGift({ myReservationId: null, isFullyReserved: true }),
			role: WISHLIST_ROLES.moderator,
			isArchived: false,
			releaseCapability: 'any',
			reservations: [
				{
					id: 'reservation-other',
					giftId: 'gift-1',
					quantity: 1,
					displayName: 'Petr',
					releasable: true,
					createdAt: new Date('2026-01-02'),
				},
			],
		});

		expect(document.querySelector('[data-testid="release-reservation-button"]')).toBeNull();
	});
});

describe('GiftCard footer alignment (issues #255, #420)', () => {
	const bought = `[aria-label="${m.gift_mark_bought()}"]`;
	const noop = () => {};
	const unreservedGift = makeVisitorGift({ myReservationId: null, reservedCount: 0 });

	it.each([
		{
			name: 'desktop recipient Received and More',
			props: { gift: makeVisitorGift(), role: WISHLIST_ROLES.recipient, onmore: noop },
			expectedActions: [RECEIVED_ACTION_SELECTOR, MORE_ACTION_SELECTOR],
		},
		{
			name: 'desktop recipient marked Received and More',
			props: {
				gift: makeVisitorGift({ received: true }),
				role: WISHLIST_ROLES.recipient,
				onmore: noop,
			},
			expectedActions: [RECEIVED_ACTION_SELECTOR, MORE_ACTION_SELECTOR],
		},
		{
			name: 'desktop recipient Received without More',
			props: { gift: makeVisitorGift(), role: WISHLIST_ROLES.recipient },
			expectedActions: [RECEIVED_ACTION_SELECTOR],
		},
		{
			name: 'desktop archived recipient More',
			props: {
				gift: makeVisitorGift({ received: true }),
				role: WISHLIST_ROLES.recipient,
				isArchived: true,
				onmore: noop,
			},
			expectedActions: [MORE_ACTION_SELECTOR],
		},
		{
			name: 'desktop archived visitor Bought and Cancel reservation',
			props: { gift: makeVisitorGift(), role: WISHLIST_ROLES.visitor, isArchived: true },
			expectedActions: [bought, RESERVE_ACTION_SELECTOR],
		},
		{
			name: 'desktop visitor Reserve and More',
			props: { gift: unreservedGift, role: WISHLIST_ROLES.visitor, onmore: noop },
			expectedActions: [RESERVE_ACTION_SELECTOR, MORE_ACTION_SELECTOR],
		},
		{
			name: 'desktop manager Received, Reserve and More',
			props: { gift: unreservedGift, role: WISHLIST_ROLES.moderator, onmore: noop },
			expectedActions: [
				RECEIVED_ACTION_SELECTOR,
				RESERVE_ACTION_SELECTOR,
				MORE_ACTION_SELECTOR,
			],
		},
		{
			name: 'desktop manager Received, Cancel reservation and More',
			props: { gift: makeVisitorGift(), role: WISHLIST_ROLES.moderator, onmore: noop },
			expectedActions: [
				RECEIVED_ACTION_SELECTOR,
				RESERVE_ACTION_SELECTOR,
				MORE_ACTION_SELECTOR,
			],
		},
		{
			name: 'desktop manager Received and Reserve without More',
			props: { gift: unreservedGift, role: WISHLIST_ROLES.moderator },
			expectedActions: [RECEIVED_ACTION_SELECTOR, RESERVE_ACTION_SELECTOR],
		},
		{
			name: 'desktop manager latent More with Received and Reserve',
			props: {
				gift: unreservedGift,
				role: WISHLIST_ROLES.moderator,
				onmore: noop,
				persistentMore: false,
			},
			expectedActions: [RECEIVED_ACTION_SELECTOR, RESERVE_ACTION_SELECTOR],
		},
		{
			name: 'mobile manager Received and Reserve',
			viewport: MOBILE_VIEWPORT_WIDTH,
			width: MOBILE_CARD_HOST_WIDTH,
			props: { gift: unreservedGift, role: WISHLIST_ROLES.moderator },
			expectedActions: [RECEIVED_ACTION_SELECTOR, RESERVE_ACTION_SELECTOR],
		},
	])(
		'right-aligns adjacent footer actions: $name',
		async ({ viewport = 800, width = DESKTOP_CARD_HOST_WIDTH, props, expectedActions }) => {
			await page.viewport(viewport, 900);
			const host = document.createElement('div');
			host.style.width = `${width}px`;
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
				{ onreceived: noop, onreserve: noop, onunreserve: noop, ...props },
				{ baseElement: host },
			);

			const row = host.querySelector<HTMLElement>('[data-testid="gift-action-row"]')!;
			await expect.poll(() => visibleActions(row).length).toBe(expectedActions.length);
			const footer = host.querySelector<HTMLElement>('[data-testid="gift-card-footer"]')!;

			expect(row.dataset.overflowActions).toBe('');
			expectRightAlignedAdjacentActions(
				row,
				expectedActions.map((selector) => visibleAction(row, selector)),
				footerInnerRight(footer),
			);
		},
	);

	it('overflows Received but keeps Reserve and More adjacent in a narrow mobile footer', async () => {
		await page.viewport(MOBILE_VIEWPORT_WIDTH, 900);
		const host = document.createElement('div');
		host.style.width = `${NARROW_OVERFLOW_CARD_HOST_WIDTH}px`;
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: unreservedGift,
				role: WISHLIST_ROLES.moderator,
				onreceived: noop,
				onreserve: noop,
				onmore: noop,
				persistentMore: true,
			},
			{ baseElement: host },
		);

		const row = host.querySelector<HTMLElement>('[data-testid="gift-action-row"]')!;
		await expect.poll(() => row.dataset.overflowActions).toBe('received');
		const footer = host.querySelector<HTMLElement>('[data-testid="gift-card-footer"]')!;

		expect(visibleActions(row)).toHaveLength(2);
		expectRightAlignedAdjacentActions(
			row,
			[visibleAction(row, RESERVE_ACTION_SELECTOR), visibleAction(row, MORE_ACTION_SELECTOR)],
			footerInnerRight(footer),
		);
	});
});

function footerInnerRight(footer: HTMLElement): number {
	return (
		footer.getBoundingClientRect().right -
		resolvedCssLength(footer, 'var(--gift-content-inset-end)')
	);
}
