import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import {
	REALISTIC_LONG_NAME,
	GiftCardTestHost,
	cleanupCardHosts,
	expectRaisedActionShadowInside,
	fixedHosts,
	makeVisitorGift,
} from './gift_card.test_fixtures.js';

const { expectPixelsNear } = createPixelAssertions(expect);

afterEach(cleanupCardHosts);

async function nextLayout(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

describe('GiftCard responsive action placement', () => {
	it('omits the footer when More is only a latent overflow callback', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({
					links: [],
					isFullyReserved: true,
					reservedCount: 1,
					myReservationId: null,
				}),
				role: WISHLIST_ROLES.visitor,
				onmore: () => {},
				persistentMore: false,
			},
			{ baseElement: host },
		);

		expect(host.querySelector('[data-testid="gift-card-footer"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-action-row"]')).toBeNull();
	});

	it('keeps Reserve visible while Received overflows, then restores Received when width returns', async () => {
		await page.viewport(390, 900);
		const onreserve = vi.fn();
		const onreceived = vi.fn();
		const host = document.createElement('div');
		host.style.width = '296px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreceived,
				onreserve,
				onmore: () => {},
				persistentMore: false,
			},
			{ baseElement: host },
		);
		await nextLayout();

		const row = host.querySelector<HTMLElement>('[data-testid="gift-action-row"]')!;
		expect(row.querySelectorAll('[data-testid="reserve-button"]')).toHaveLength(1);
		expect(row.querySelectorAll('[data-testid="gift-received-toggle"]')).toHaveLength(1);
		expect(
			row.querySelector('[data-testid="gift-more-actions"]')?.getAttribute('aria-hidden'),
		).toBe('true');

		host.style.width = '210px';
		await nextLayout();
		const reserve = row.querySelector<HTMLButtonElement>('[data-testid="reserve-button"]')!;
		const received = row.querySelector<HTMLElement>('[data-testid="gift-received-toggle"]')!;
		const more = row.querySelector<HTMLElement>('[data-testid="gift-more-actions"]')!;
		expect(reserve.closest('[aria-hidden="true"]')).toBeNull();
		expect(received.closest('[aria-hidden="true"]')?.hasAttribute('inert')).toBe(true);
		expect(more.getAttribute('aria-hidden')).toBe('false');
		expect(row.dataset.overflowActions).toBe('received');
		expectPixelsNear(reserve.getBoundingClientRect().top, more.getBoundingClientRect().top);
		reserve.click();
		expect(onreserve).toHaveBeenCalledOnce();

		host.style.width = '296px';
		await nextLayout();
		const restoredReceived = row.querySelector<HTMLButtonElement>(
			'[data-testid="gift-received-toggle"]',
		)!;
		expect(restoredReceived.closest('[aria-hidden="true"]')).toBeNull();
		expect(row.querySelectorAll('[data-testid="reserve-button"]')).toHaveLength(1);
		expect(
			row.querySelector('[data-testid="gift-more-actions"]')?.getAttribute('aria-hidden'),
		).toBe('true');
		restoredReceived.click();
		expect(onreceived).toHaveBeenCalledWith('gift-1', true);
	});

	it.each([
		{
			name: 'visitor Reserve',
			role: WISHLIST_ROLES.visitor,
			gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
			primaryTestId: 'reserve-button',
		},
		{
			name: 'visitor own Cancel',
			role: WISHLIST_ROLES.visitor,
			gift: makeVisitorGift({
				myReservationId: 'reservation-1',
				reservedCount: 1,
				isFullyReserved: true,
			}),
			primaryTestId: 'reserve-button',
		},
		{
			name: 'recipient sole Received',
			role: WISHLIST_ROLES.recipient,
			gift: makeVisitorGift(),
			primaryTestId: 'gift-received-toggle',
		},
	])(
		'keeps the direct primary and persistent More reachable at desktop card width for $name',
		async ({ role, gift, primaryTestId }) => {
			await page.viewport(1280, 900);
			const host = document.createElement('div');
			host.style.width = '280px';
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
			await nextLayout();

			const row = host.querySelector<HTMLElement>('[data-testid="gift-action-row"]')!;
			const primary = row.querySelector<HTMLElement>(`[data-testid="${primaryTestId}"]`)!;
			const more = row.querySelector<HTMLElement>('[data-testid="gift-more-actions"]')!;
			expect(primary.closest('[aria-hidden="true"]')).toBeNull();
			expect(more.closest('[aria-hidden="true"]')).toBeNull();
			expectPixelsNear(primary.getBoundingClientRect().top, more.getBoundingClientRect().top);
		},
	);

	it('keeps More visible at wide widths when the caller marks it persistent', async () => {
		await page.viewport(768, 900);
		const host = document.createElement('div');
		host.style.width = '360px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreceived: () => {},
				onreserve: () => {},
				onmore: () => {},
				persistentMore: true,
			},
			{ baseElement: host },
		);
		await nextLayout();

		const row = host.querySelector<HTMLElement>('[data-testid="gift-action-row"]')!;
		const actions = Array.from(row.querySelectorAll<HTMLElement>('button'));
		expect(actions).toHaveLength(3);
		expect(row.querySelector('[data-testid="gift-more-actions"]')).toBeTruthy();
		const actionTops = actions.map((action) => action.getBoundingClientRect().top);
		for (const actionTop of actionTops.slice(1)) {
			expectPixelsNear(actionTop, actionTops[0]!);
		}
	});
});

describe('GiftCard approved action geometry (issue #350)', () => {
	it.each([
		{ viewport: 320, width: 296, role: WISHLIST_ROLES.visitor, reservationId: null },
		{ viewport: 390, width: 179, role: WISHLIST_ROLES.visitor, reservationId: 'mine' },
		{ viewport: 768, width: 280, role: WISHLIST_ROLES.recipient, reservationId: null },
		{ viewport: 1440, width: 360, role: WISHLIST_ROLES.moderator, reservationId: null },
	])(
		'contains equal-height primary and More actions at $viewport px for $role',
		async ({ viewport, width, role, reservationId }) => {
			await page.viewport(viewport, 900);
			const host = document.createElement('div');
			host.style.width = `${width}px`;
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift({
						myReservationId: reservationId,
						reservedCount: reservationId === null ? 0 : 1,
						isFullyReserved: reservationId !== null,
					}),
					role,
					onreceived: () => {},
					onreserve: () => {},
					onunreserve: () => {},
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
			const more = row.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
			const primary = row.querySelector(
				'[data-testid="gift-received-toggle"], [data-testid="reserve-button"]',
			) as HTMLElement;
			const card = host.querySelector('[data-testid="gift-card-image-frame"]')!
				.parentElement as HTMLElement;
			const expectedControlSize = viewport < 640 ? 40 : 32;
			const actions = Array.from(row.querySelectorAll<HTMLElement>('button'));
			expect(primary).toBeTruthy();
			expect(more).toBeTruthy();
			for (const action of actions) {
				expectPixelsNear(action.getBoundingClientRect().height, expectedControlSize);
				expectRaisedActionShadowInside(action, card);
			}
			if (role === WISHLIST_ROLES.recipient) {
				expect(host.querySelector('[data-like-heart]')).toBeNull();
				expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
			}
			if (role === WISHLIST_ROLES.moderator) {
				const reserve = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
				expect(actions).toHaveLength(3);
				expect(
					host.querySelector('[data-testid="gift-card-image-frame"]')?.contains(reserve),
				).toBe(false);
				expect(row.contains(reserve)).toBe(true);
				const widths = actions.map((action) => action.getBoundingClientRect().width);
				expect(widths[0]).toBeGreaterThan(expectedControlSize);
				expect(widths[1]).toBeGreaterThan(expectedControlSize);
				expectPixelsNear(widths[2]!, expectedControlSize);
			}
		},
	);

	it.each([
		{ locale: 'cs' as const, received: false },
		{ locale: 'cs' as const, received: true },
		{ locale: 'en' as const, received: false },
		{ locale: 'en' as const, received: true },
	])(
		'contains localized manager actions and shadows for $locale (received: $received)',
		async ({ locale, received }) => {
			overwriteGetLocale(() => locale);
			await page.viewport(390, 900);
			const host = document.createElement('div');
			host.style.width = '296px';
			document.body.appendChild(host);
			fixedHosts.add(host);
			try {
				await render(
					GiftCardTestHost,
					{
						gift: makeVisitorGift({ received }),
						role: WISHLIST_ROLES.moderator,
						onreceived: () => {},
						onunreserve: () => {},
						onmore: () => {},
					},
					{ baseElement: host },
				);
				const card = host.querySelector('[data-testid="gift-card-image-frame"]')!
					.parentElement as HTMLElement;
				const primary = host.querySelector(
					'[data-testid="gift-received-toggle"]',
				) as HTMLElement;
				const more = host.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
				const reserve = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
				expect(reserve.getAttribute('aria-label')).toBe(
					m.reserve_button_cancel_aria({ name: REALISTIC_LONG_NAME }),
				);
				expect(primary.getAttribute('aria-label')).toBe(
					received ? m.gift_mark_unreceived() : m.gift_mark_received(),
				);
				expect(more.getAttribute('aria-label')).toBe(m.gift_more_actions());
				const actions = [reserve, primary, more];
				const visibleActions = actions.filter(
					(action) => action.closest('[aria-hidden="true"]') === null,
				);
				for (const action of visibleActions) {
					expectPixelsNear(action.getBoundingClientRect().height, 40);
					expectRaisedActionShadowInside(action, card);
				}
				expect(reserve.closest('[aria-hidden="true"]')).toBeNull();
				expect(
					host.querySelector('[data-testid="gift-card-image-frame"]')?.contains(reserve),
				).toBe(false);
				if (primary.closest('[aria-hidden="true"]') === null) {
					expectPixelsNear(
						primary.getBoundingClientRect().top,
						more.getBoundingClientRect().top,
					);
				} else {
					expect(primary.closest('[aria-hidden="true"]')?.hasAttribute('inert')).toBe(
						true,
					);
					expect(
						host.querySelector<HTMLElement>('[data-testid="gift-action-row"]')?.dataset
							.overflowActions,
					).toContain('received');
					expect(more.closest('[aria-hidden="true"]')).toBeNull();
				}
			} finally {
				overwriteGetLocale(() => 'cs');
			}
		},
	);

	it('keeps both moving-surface shadows contained at 200% root text', async () => {
		await page.viewport(390, 900);
		const previousFontSize = document.documentElement.style.fontSize;
		document.documentElement.style.fontSize = '32px';
		const host = document.createElement('div');
		host.style.width = '296px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		try {
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
					role: WISHLIST_ROLES.visitor,
					onreserve: () => {},
					onmore: () => {},
				},
				{ baseElement: host },
			);
			const card = host.firstElementChild as HTMLElement;
			const primary = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
			const more = host.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
			expectPixelsNear(
				primary.getBoundingClientRect().height,
				more.getBoundingClientRect().height,
			);
			expectRaisedActionShadowInside(primary, card);
			expectRaisedActionShadowInside(more, card);
		} finally {
			document.documentElement.style.fontSize = previousFontSize;
		}
	});
});
