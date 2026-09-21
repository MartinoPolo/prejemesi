import '../../../../app.css';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import {
	REALISTIC_LONG_NAME,
	makeVisitorGift,
	firstNonBlankTextNode,
	expectRaisedActionShadowInside,
	GiftListItemTestHost,
} from './gift_list_item.test_fixtures.js';

async function settleActionPlacement() {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

describe('GiftListItem approved action geometry (issue #350)', () => {
	it('keeps nested action hover paint independent from the flat list row', async () => {
		await page.viewport(800, 900);
		const host = document.createElement('div');
		host.style.width = '720px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({
					links: [{ url: 'https://example.com/gift', label: 'Obchod' }],
					myReservationId: null,
					reservedCount: 0,
				}),
				role: WISHLIST_ROLES.moderator,
				onreserve: () => {},
				onreceived: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		const title = host.querySelector<HTMLElement>('h3')!;
		const more = host.querySelector<HTMLButtonElement>('[data-testid="gift-more-actions"]')!;
		const received = host.querySelector<HTMLButtonElement>(
			'[data-testid="gift-received-toggle"]',
		)!;
		const sourceLink = host.querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
		const moreSurface = more.querySelector<HTMLElement>(':scope > .elevation-surface')!;
		const receivedSurface = received.querySelector<HTMLElement>(':scope > .elevation-surface')!;
		const sourceSurface = sourceLink.querySelector<HTMLElement>(':scope > .elevation-surface')!;
		const restingPaint = [moreSurface, receivedSurface, sourceSurface].map(
			(element) => getComputedStyle(element).backgroundColor,
		);

		await userEvent.hover(title);
		await expect
			.poll(() =>
				[moreSurface, receivedSurface, sourceSurface].map(
					(element) => getComputedStyle(element).backgroundColor,
				),
			)
			.toEqual(restingPaint);

		await userEvent.hover(more);
		await expect
			.poll(() => getComputedStyle(moreSurface).backgroundColor)
			.not.toBe(restingPaint[0]);
		host.remove();
	});

	it('omits the action area when More is only a latent overflow callback', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
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

		expect(host.querySelector('[data-testid="gift-list-actions"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-action-row"]')).toBeNull();
		host.remove();
	});

	it('shows More only when an action overflows when persistent More is disabled', async () => {
		await page.viewport(800, 900);
		const host = document.createElement('div');
		host.style.width = '720px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreceived: () => {},
				onreserve: () => {},
				onmore: () => {},
				persistentMore: false,
			},
			{ baseElement: host },
		);
		await settleActionPlacement();

		expect(host.querySelector('[data-testid="reserve-button"]')).toBeTruthy();
		expect(host.querySelector('[data-testid="gift-received-toggle"]')).toBeTruthy();
		const more = host.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
		expect(more.getAttribute('aria-hidden')).toBe('true');

		host.style.width = '220px';
		await settleActionPlacement();
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeTruthy();
		expect(
			host
				.querySelector('[data-testid="gift-received-toggle"]')
				?.closest('[aria-hidden="true"]'),
		).toBeTruthy();
		expect(more.getAttribute('aria-hidden')).toBe('false');
		host.remove();
	});
	it.each([
		{
			viewport: 430,
			role: WISHLIST_ROLES.visitor,
			name: 'Myš',
		},
		{
			viewport: 430,
			role: WISHLIST_ROLES.recipient,
			name: REALISTIC_LONG_NAME,
		},
		{
			viewport: 500,
			role: WISHLIST_ROLES.moderator,
			name: REALISTIC_LONG_NAME,
		},
	])(
		'shows description and contains compact actions near mobile width for $role with title variant',
		async ({ viewport, role, name }) => {
			await page.viewport(viewport, 900);
			const host = document.createElement('div');
			host.style.width = `${viewport - 24}px`;
			document.body.appendChild(host);
			await render(
				GiftListItemTestHost,
				{
					gift: makeVisitorGift({
						name,
						description: 'Lehká myš pro pohodlné každodenní používání.',
						myReservationId: role === WISHLIST_ROLES.visitor ? null : 'mine',
						reservedCount: role === WISHLIST_ROLES.visitor ? 0 : 1,
					}),
					role,
					onreceived: () => {},
					onreserve: () => {},
					onunreserve: () => {},
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const description = host.querySelector('.gift-list-description') as HTMLElement;
			const itemRect = item.getBoundingClientRect();
			const descriptionRect = description.getBoundingClientRect();
			expect(getComputedStyle(description).display).not.toBe('none');
			expect(descriptionRect.top).toBeGreaterThanOrEqual(itemRect.top);
			expect(descriptionRect.bottom).toBeLessThanOrEqual(itemRect.bottom);
			const imageRect = image.getBoundingClientRect();
			const itemStyle = getComputedStyle(item);
			const innerHeight =
				itemRect.height -
				Number.parseFloat(itemStyle.borderTopWidth) -
				Number.parseFloat(itemStyle.borderBottomWidth);
			expect(imageRect.width).toBeCloseTo(Math.min(item.clientWidth * 0.35, 152), 0);
			expect(imageRect.height).toBeCloseTo(innerHeight, 0);
			expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth);
			expect(item.scrollHeight).toBeLessThanOrEqual(item.clientHeight);
			for (const action of host.querySelectorAll<HTMLElement>(
				'[data-testid="gift-list-actions"] button',
			)) {
				const actionRect = action.getBoundingClientRect();
				expect(actionRect.height).toBeCloseTo(40, 0);
				expect(actionRect.left).toBeGreaterThanOrEqual(itemRect.left);
				expect(actionRect.right).toBeLessThanOrEqual(itemRect.right);
				expect(actionRect.bottom).toBeLessThanOrEqual(itemRect.bottom);
			}
			host.remove();
		},
	);

	it('keeps Reserve visible and overflows Received into More on a narrow mobile row', async () => {
		await page.viewport(390, 900);
		const host = document.createElement('div');
		host.style.width = '366px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreceived: () => {},
				onreserve: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		await settleActionPlacement();
		const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
		const reserve = row.querySelector('[data-testid="reserve-button"]') as HTMLElement;
		const received = row.querySelector('[data-testid="gift-received-toggle"]') as HTMLElement;
		const more = row.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
		const rowRect = row.getBoundingClientRect();
		const reserveRect = reserve.getBoundingClientRect();
		const moreRect = more.getBoundingClientRect();

		expect(received.closest('[aria-hidden="true"]')).toBeTruthy();
		expect(row.dataset.overflowActions?.split(' ')).toContain('received');
		expect(getComputedStyle(row).flexWrap).toBe('nowrap');
		expect(reserveRect.top).toBeCloseTo(moreRect.top, 0);
		expect(reserveRect.right).toBeLessThanOrEqual(moreRect.left);
		expect(moreRect.right).toBeCloseTo(rowRect.right, 0);
		host.remove();
	});

	it('keeps Reserve, Received, and More in one right-aligned desktop row', async () => {
		await page.viewport(768, 900);
		const host = document.createElement('div');
		host.style.width = '720px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreceived: () => {},
				onreserve: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		await settleActionPlacement();
		const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
		const reserve = row.querySelector('[data-testid="reserve-button"]') as HTMLElement;
		const received = row.querySelector('[data-testid="gift-received-toggle"]') as HTMLElement;
		const more = row.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
		const rowRect = row.getBoundingClientRect();
		const actionRects = [reserve, received, more].map((action) =>
			action.getBoundingClientRect(),
		);

		for (const actionRect of actionRects) {
			expect(actionRect.top).toBeCloseTo(actionRects[0]!.top, 0);
			expect(actionRect.left).toBeGreaterThanOrEqual(rowRect.left);
			expect(actionRect.right).toBeLessThanOrEqual(rowRect.right);
		}
		expect(getComputedStyle(row).flexWrap).toBe('nowrap');
		expect(more.getBoundingClientRect().right).toBeCloseTo(rowRect.right, 0);
		host.remove();
	});

	it.each([
		{ viewport: 320, role: WISHLIST_ROLES.visitor, reservationId: null },
		{ viewport: 390, role: WISHLIST_ROLES.visitor, reservationId: 'mine' },
		{ viewport: 768, role: WISHLIST_ROLES.recipient, reservationId: null },
		{ viewport: 1440, role: WISHLIST_ROLES.moderator, reservationId: null },
	])(
		'contains equal-height primary and More actions at $viewport px for $role',
		async ({ viewport, role, reservationId }) => {
			await page.viewport(viewport, 900);
			const host = document.createElement('div');
			host.style.width = `${Math.min(viewport - 24, 720)}px`;
			document.body.appendChild(host);
			await render(
				GiftListItemTestHost,
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

			await settleActionPlacement();
			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
			const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
			const more = row.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
			const primary = row.querySelector(
				'[data-testid="gift-received-toggle"], [data-testid="reserve-button"]',
			) as HTMLElement;
			const expectedControlSize = viewport < 640 ? 40 : 32;
			const actions = Array.from(row.querySelectorAll<HTMLElement>('button'));
			expect(primary).toBeTruthy();
			expect(more).toBeTruthy();
			const contentRect = content.getBoundingClientRect();
			for (const action of actions) {
				const actionRect = action.getBoundingClientRect();
				expect(actionRect.height).toBeCloseTo(expectedControlSize, 0);
				expect(actionRect.left).toBeGreaterThanOrEqual(contentRect.left);
				expect(actionRect.right).toBeLessThanOrEqual(contentRect.right);
			}
			const primaryRect = primary.getBoundingClientRect();
			const moreRect = more.getBoundingClientRect();
			if (primaryRect.top === moreRect.top) {
				expect(primaryRect.right).toBeLessThanOrEqual(moreRect.left);
			} else {
				expect(primaryRect.bottom).toBeLessThanOrEqual(moreRect.top);
				expect(primaryRect.right).toBeCloseTo(row.getBoundingClientRect().right, 0);
				expect(moreRect.right).toBeCloseTo(row.getBoundingClientRect().right, 0);
			}
			const surface = primary.querySelector(':scope > .elevation-surface') as HTMLElement;
			const textRange = document.createRange();
			textRange.selectNodeContents(firstNonBlankTextNode(surface));
			const textRect = textRange.getBoundingClientRect();
			const surfaceRect = surface.getBoundingClientRect();
			expect(textRect.left).toBeGreaterThanOrEqual(surfaceRect.left + 2);
			expect(textRect.right).toBeLessThanOrEqual(surfaceRect.right - 2);
			expectRaisedActionShadowInside(primary, item);
			expectRaisedActionShadowInside(more, item);
			if (viewport < 640) {
				const itemRect = item.getBoundingClientRect();
				const imageRect = image.getBoundingClientRect();
				const itemStyle = getComputedStyle(item);
				const innerHeight =
					itemRect.height -
					Number.parseFloat(itemStyle.borderTopWidth) -
					Number.parseFloat(itemStyle.borderBottomWidth);
				expect(imageRect.width).toBeCloseTo(Math.min(item.clientWidth * 0.35, 152), 0);
				expect(imageRect.height).toBeCloseTo(innerHeight, 0);
				expect(content.getBoundingClientRect().left).toBeCloseTo(imageRect.right, 0);
				expect(imageRect.top).toBeCloseTo(
					itemRect.top + Number.parseFloat(itemStyle.borderTopWidth),
					0,
				);
				const imageFrame = image.querySelector(
					'[data-testid="image-frame"]',
				) as HTMLElement;
				const expectedInnerRadius =
					Number.parseFloat(itemStyle.borderTopLeftRadius) -
					Number.parseFloat(itemStyle.borderLeftWidth);
				expect(
					Number.parseFloat(getComputedStyle(imageFrame).borderTopLeftRadius),
				).toBeCloseTo(expectedInnerRadius, 0);
			}
			if (role === WISHLIST_ROLES.moderator) {
				const reserve = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
				expect(actions).toHaveLength(3);
				expect(image.contains(reserve)).toBe(false);
				const widths = actions.map((action) => action.getBoundingClientRect().width);
				expect(widths[0]).toBeGreaterThan(expectedControlSize);
				expect(widths[1]).toBeGreaterThan(expectedControlSize);
				expect(widths[2]).toBeCloseTo(expectedControlSize, 0);
			}
			if (role === WISHLIST_ROLES.recipient) {
				expect(host.querySelector('[data-like-heart]')).toBeNull();
				expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
				expect(host.textContent).not.toMatch(/rezerv/i);
			}
			host.remove();
		},
	);

	it.each([
		{ locale: 'cs' as const, received: false },
		{ locale: 'cs' as const, received: true },
		{ locale: 'en' as const, received: false },
		{ locale: 'en' as const, received: true },
	])(
		'contains localized intrinsic manager actions in a 320px horizontal row for $locale (received: $received)',
		async ({ locale, received }) => {
			overwriteGetLocale(() => locale);
			await page.viewport(768, 900);
			const host = document.createElement('div');
			host.style.width = '320px';
			document.body.appendChild(host);
			try {
				await render(
					GiftListItemTestHost,
					{
						gift: makeVisitorGift({
							description: 'Dlouhý popis, který se v úzkém řádku zkrátí jako první.',
							links: [{ url: 'https://example.com/product' }],
							price: 2499,
							currency: 'CZK',
							quantity: 3,
							reserverNames: ['Alexandra Nováková'],
							received,
						}),
						role: WISHLIST_ROLES.moderator,
						onreceived: () => {},
						onunreserve: () => {},
						onmore: () => {},
					},
					{ baseElement: host },
				);

				await settleActionPlacement();
				const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
				const content = host.querySelector(
					'[data-testid="gift-list-content"]',
				) as HTMLElement;
				const receivedAction = host.querySelector(
					'[data-testid="gift-received-toggle"]',
				) as HTMLElement;
				const more = host.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
				const reserve = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
				expect(getComputedStyle(item).display).toBe('grid');
				expect(content.getBoundingClientRect().left).toBeCloseTo(
					(
						host.querySelector('[data-testid="gift-list-image"]') as HTMLElement
					).getBoundingClientRect().right,
					0,
				);
				expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth);
				expect(item.scrollHeight).toBeLessThanOrEqual(item.clientHeight);
				expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
				expect(reserve.getAttribute('aria-label')).toBe(
					m.reserve_button_cancel_aria({ name: REALISTIC_LONG_NAME }),
				);
				expect(receivedAction.getAttribute('aria-label')).toBe(
					received ? m.gift_mark_unreceived() : m.gift_mark_received(),
				);
				expect(receivedAction.closest('[aria-hidden="true"]')).toBeTruthy();
				expect(more.getAttribute('aria-label')).toBe(m.gift_more_actions());
				const actions = [reserve, more];
				const actionRects = actions.map((action) => action.getBoundingClientRect());
				for (const [index, action] of actions.entries()) {
					expect(actionRects[index]!.height).toBeCloseTo(32, 0);
					if (index === actions.length - 1) {
						expect(actionRects[index]!.width).toBeCloseTo(32, 0);
					} else {
						expect(actionRects[index]!.width).toBeGreaterThan(32);
					}
					expectRaisedActionShadowInside(action, item);
				}
				expect(
					host.querySelector('[data-testid="gift-list-image"]')?.contains(reserve),
				).toBe(false);
			} finally {
				overwriteGetLocale(() => 'cs');
				host.remove();
			}
		},
	);

	it('keeps enlarged-text commands reachable through one non-wrapping mobile action lane', async () => {
		await page.viewport(390, 900);
		const previousFontSize = document.documentElement.style.fontSize;
		document.documentElement.style.fontSize = '32px';
		const host = document.createElement('div');
		host.style.width = '366px';
		document.body.appendChild(host);

		const onunreserve = vi.fn();
		try {
			await render(
				GiftListItemTestHost,
				{
					gift: makeVisitorGift({
						myReservationId: 'mine',
						isFullyReserved: true,
					}),
					role: WISHLIST_ROLES.visitor,
					onunreserve,
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
			await settleActionPlacement();
			const primary = host.querySelector(
				'[data-testid="reserve-button"]',
			) as HTMLButtonElement;
			const more = host.querySelector(
				'[data-testid="gift-more-actions"]',
			) as HTMLButtonElement;
			const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
			const imageRect = image.getBoundingClientRect();
			const contentRect = content.getBoundingClientRect();
			expect(getComputedStyle(item).display).toBe('grid');
			expect(item.hasAttribute('data-list-image-stacked')).toBe(false);
			expect(imageRect.width).toBeCloseTo(Math.min(item.clientWidth * 0.35, 152), 0);
			expect(imageRect.width).toBeLessThan(imageRect.height);
			expect(contentRect.left).toBeCloseTo(imageRect.right, 0);
			expect(getComputedStyle(row).flexWrap).toBe('nowrap');
			expect(primary.closest('[data-testid="gift-action-primary-group"]')).toBeTruthy();
			expect(primary.closest('[data-testid="gift-action-secondary"]')).toBeNull();
			expect(primary.closest('[inert]')).toBeNull();
			expect(row.dataset.overflowActions?.split(' ')).not.toContain('cancel-reservation');
			expect(more.closest('[inert]')).toBeNull();
			primary.focus();
			expect(document.activeElement).toBe(primary);
			primary.click();
			expect(onunreserve).toHaveBeenCalledOnce();
			expect(primary.getBoundingClientRect().top).toBeCloseTo(
				more.getBoundingClientRect().top,
				0,
			);
			expectRaisedActionShadowInside(primary, item);
			expectRaisedActionShadowInside(more, item);
			expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth);
			expect(item.scrollHeight).toBeLessThanOrEqual(item.clientHeight);
		} finally {
			document.documentElement.style.fontSize = previousFontSize;
			host.remove();
		}
	});

	it('keeps the portrait image beside content and commands reachable when actual space is narrow', async () => {
		await page.viewport(280, 900);
		const host = document.createElement('div');
		host.style.width = '256px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({
					myReservationId: null,
					reservedCount: 0,
					isFullyReserved: false,
				}),
				role: WISHLIST_ROLES.visitor,
				onreserve: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		await settleActionPlacement();
		const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
		const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
		const imageRect = image.getBoundingClientRect();
		expect(getComputedStyle(item).display).toBe('grid');
		expect(imageRect.width).toBeCloseTo(item.clientWidth * 0.35, 0);
		expect(imageRect.width).toBeLessThan(imageRect.height);
		expect(content.getBoundingClientRect().left).toBeCloseTo(imageRect.right, 0);
		expect(host.querySelector('[data-testid="gift-more-actions"]')).toBeTruthy();
		expect(getComputedStyle(row).flexWrap).toBe('nowrap');
		const reserve = host.querySelector('[data-testid="reserve-button"]');
		if (reserve === null) {
			expect(row.dataset.overflowActions).toContain('reserve');
		}
		expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth);
		host.remove();
	});
});
