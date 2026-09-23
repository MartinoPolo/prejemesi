import '../../../../app.css';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	IMAGE_URL,
	GiftCardTestHost,
	cleanupCardHosts,
	fixedHosts,
	makeVisitorGift,
} from './gift_card.test_fixtures.js';
import { GiftListItemTestHost } from './gift_list_item.test_fixtures.js';

const category = {
	id: 'category-sport',
	presetKey: null,
	customLabel: 'Sport',
	color: '#0369A1',
	sortOrder: 0,
};
const metadata = { categoryId: category.id, category, priorityLabel: 'Vysoka' };

async function renderGift(
	view: 'card' | 'list',
	width: number,
	gift: GiftForVisitor,
	role: WishlistRole,
	hideReservationState = role === WISHLIST_ROLES.recipient,
	dark = false,
) {
	await page.viewport(width, 900);
	const host = document.createElement('div');
	host.style.width = `${width === 390 ? 320 : view === 'card' ? 280 : 640}px`;
	host.dataset.palette = 'sky';
	host.classList.toggle('dark', dark);
	document.body.appendChild(host);
	fixedHosts.add(host);
	await render(
		view === 'card' ? GiftCardTestHost : GiftListItemTestHost,
		{ gift, role, hideReservationState, onreceived: () => {}, onreserve: () => {} },
		{ baseElement: host },
	);
	return host;
}

function badgeStyle(host: HTMLElement, testId: string) {
	const badge = host.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
	expect(badge).not.toBeNull();
	return getComputedStyle(badge!);
}

function expectBadgeMuted(host: HTMLElement, testId: string, muted: boolean) {
	const style = badgeStyle(host, testId);
	if (muted) {
		expect(Number(style.opacity)).toBeLessThan(1);
		expect(style.filter).toContain('saturate(');
	} else {
		expect(style.opacity).toBe('1');
		expect(style.filter).toBe('none');
	}
}

function expectSecondaryBadgesMuted(host: HTMLElement, muted: boolean) {
	for (const testId of ['gift-category-badge', 'gift-priority-badge']) {
		expectBadgeMuted(host, testId, muted);
	}
}

afterEach(cleanupCardHosts);

describe('secondary badges on gift imagery', () => {
	it.each([
		{ view: 'card' as const, width: 390 },
		{ view: 'card' as const, width: 900 },
		{ view: 'list' as const, width: 390 },
		{ view: 'list' as const, width: 900 },
	])('mutes badges only with the image veil in $view at $width px', async ({ view, width }) => {
		for (const imageUrl of [null, IMAGE_URL]) {
			for (const dark of [false, true]) {
				const available = await renderGift(
					view,
					width,
					makeVisitorGift({
						...metadata,
						imageUrl,
						reservedCount: 0,
						myReservationId: null,
					}),
					WISHLIST_ROLES.visitor,
					false,
					dark,
				);
				expectSecondaryBadgesMuted(available, false);
				expect(available.querySelector('[data-testid="gift-state-overlay"]')).toBeNull();

				for (const state of [
					{ received: true, reservedCount: 0, isFullyReserved: false },
					{ received: false, reservedCount: 1, isFullyReserved: true },
				]) {
					const unavailable = await renderGift(
						view,
						width,
						makeVisitorGift({ ...metadata, imageUrl, myReservationId: null, ...state }),
						WISHLIST_ROLES.visitor,
						false,
						dark,
					);
					expectSecondaryBadgesMuted(unavailable, true);
					for (const testId of ['gift-category-badge', 'gift-priority-badge']) {
						const original = badgeStyle(available, testId);
						const dimmed = badgeStyle(unavailable, testId);
						expect(dimmed.backgroundColor).toBe(original.backgroundColor);
						expect(dimmed.color).toBe(original.color);
					}
					const image = unavailable.querySelector(
						view === 'card'
							? '[data-testid="gift-card-image-frame"]'
							: '[data-testid="gift-list-image"]',
					)!;
					expect(
						image.querySelector(
							view === 'card'
								? '.bg-reserved-veil'
								: '[data-testid="gift-reserved-veil"]',
						),
					).not.toBeNull();
					const statePill = image.querySelector<HTMLElement>('[data-state-primary]')!;
					expect(statePill.textContent).toBe(
						state.received
							? m.gift_received_badge()
							: m.gift_reserved_by_other_overlay(),
					);
					expect(getComputedStyle(statePill).opacity).toBe('1');
					expect(getComputedStyle(statePill).filter).toBe('none');
					const content = unavailable.querySelector<HTMLElement>(
						view === 'card'
							? '[data-testid="gift-card-price"]'
							: '[data-testid="gift-list-content"]',
					)!;
					expect(getComputedStyle(content).opacity).toBe('1');
					expect(unavailable.querySelector('button')).not.toBeNull();
				}
			}
		}
	});

	it.each([
		{
			view: 'card' as const,
			metadata: 'category only',
			fields: { categoryId: category.id, category },
			present: 'gift-category-badge',
			absent: 'gift-priority-badge',
		},
		{
			view: 'card' as const,
			metadata: 'priority only',
			fields: { priorityLabel: 'Vysoka' },
			present: 'gift-priority-badge',
			absent: 'gift-category-badge',
		},
		{
			view: 'list' as const,
			metadata: 'category only',
			fields: { categoryId: category.id, category },
			present: 'gift-category-badge',
			absent: 'gift-priority-badge',
		},
		{
			view: 'list' as const,
			metadata: 'priority only',
			fields: { priorityLabel: 'Vysoka' },
			present: 'gift-priority-badge',
			absent: 'gift-category-badge',
		},
	])(
		'mutes the surviving $metadata badge for received and visible reservations in $view',
		async ({ view, fields, present, absent }) => {
			for (const state of [
				{ received: true, reservedCount: 0, isFullyReserved: false },
				{ received: false, reservedCount: 1, isFullyReserved: true },
			]) {
				const gift = makeVisitorGift({
					...fields,
					...state,
					myReservationId: null,
					reserverNames: ['Babička'],
				});
				const host = await renderGift(view, 900, gift, WISHLIST_ROLES.visitor, false);
				expectBadgeMuted(host, present, true);
				expect(host.querySelector(`[data-testid="${absent}"]`)).toBeNull();
				expect(host.querySelector('[data-state-primary]')?.textContent).toBe(
					state.received ? m.gift_received_badge() : m.gift_reserved_by_other_overlay(),
				);
				expect(host.textContent).not.toContain('Babička');

				if (!state.received) {
					const privateHost = await renderGift(view, 900, gift, WISHLIST_ROLES.recipient);
					expectBadgeMuted(privateHost, present, false);
					expect(privateHost.querySelector(`[data-testid="${absent}"]`)).toBeNull();
					expect(privateHost.querySelector('[data-state-primary]')).toBeNull();
					expect(privateHost.textContent).not.toContain('Babička');
				}
			}
		},
	);

	it.each(['card', 'list'] as const)(
		'restores available badge appearance after reservation and received transitions in %s',
		async (view) => {
			const host = document.createElement('div');
			host.style.width = view === 'card' ? '280px' : '640px';
			document.body.appendChild(host);
			fixedHosts.add(host);
			const component = view === 'card' ? GiftCardTestHost : GiftListItemTestHost;
			const availableGift = makeVisitorGift({
				...metadata,
				reservedCount: 0,
				myReservationId: null,
			});
			const props = {
				gift: availableGift,
				role: WISHLIST_ROLES.visitor,
				onreserve: () => {},
			};
			const screen = await render(component, props, { baseElement: host });
			expectSecondaryBadgesMuted(host, false);

			await screen.rerender({
				...props,
				gift: { ...availableGift, reservedCount: 1, isFullyReserved: true },
			});
			expectSecondaryBadgesMuted(host, true);
			await screen.rerender({ ...props, gift: availableGift });
			expectSecondaryBadgesMuted(host, false);
			await screen.rerender({ ...props, gift: { ...availableGift, received: true } });
			expectSecondaryBadgesMuted(host, true);
		},
	);

	it.each(['card', 'list'] as const)(
		'keeps badges optional and reservation identities capability-gated in %s',
		async (view) => {
			const bareGift = makeVisitorGift({
				received: true,
				isFullyReserved: true,
				myReservationId: null,
				reserverNames: ['Babička'],
			});
			const privateHost = await renderGift(view, 900, bareGift, WISHLIST_ROLES.recipient);
			expect(privateHost.querySelector('[data-testid="gift-category-badge"]')).toBeNull();
			expect(privateHost.querySelector('[data-testid="gift-priority-badge"]')).toBeNull();
			expect(privateHost.textContent).not.toContain('Babička');
			expect(privateHost.textContent).not.toContain(m.gift_reserved_by_other_overlay());

			const undisclosedHost = await renderGift(
				view,
				900,
				makeVisitorGift({
					...metadata,
					reservedCount: 1,
					isFullyReserved: true,
					myReservationId: null,
					reserverNames: ['Babička'],
				}),
				WISHLIST_ROLES.recipient,
			);
			expectSecondaryBadgesMuted(undisclosedHost, false);
			expect(undisclosedHost.querySelector('[data-state-primary]')).toBeNull();
			expect(undisclosedHost.textContent).not.toContain('Babička');

			const disclosedHost = await renderGift(
				view,
				900,
				makeVisitorGift({
					...metadata,
					received: false,
					isFullyReserved: true,
					myReservationId: null,
					reserverNames: ['Babička'],
				}),
				WISHLIST_ROLES.recipient,
				false,
			);
			expectSecondaryBadgesMuted(disclosedHost, true);
			expect(disclosedHost.textContent).not.toContain('Babička');
			expect(disclosedHost.querySelector('[data-state-primary]')?.textContent).toBe(
				m.gift_reserved_by_other_overlay(),
			);

			const moderatorHost = await renderGift(
				view,
				900,
				makeVisitorGift({
					...metadata,
					isFullyReserved: true,
					myReservationId: null,
					reserverNames: ['Babička'],
				}),
				WISHLIST_ROLES.moderator,
			);
			expectSecondaryBadgesMuted(moderatorHost, true);
			const identity = moderatorHost.querySelector<HTMLElement>('[data-reserver-identity]')!;
			expect(identity.textContent).toContain('Babička');
			expect(getComputedStyle(identity).opacity).toBe('1');
			expect(getComputedStyle(identity).filter).toBe('none');
		},
	);
});
