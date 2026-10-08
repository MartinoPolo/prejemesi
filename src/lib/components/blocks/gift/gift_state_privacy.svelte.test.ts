import '../../../../app.css';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import { GiftCardTestHost, makeVisitorGift } from './gift_card.test_fixtures.js';
import { GiftListItemTestHost } from './gift_list_item.test_fixtures.js';

const RESERVER_NAME = 'Babička';
const hosts = new Set<HTMLElement>();

const surfaces = [
	{ surface: 'card', component: GiftCardTestHost },
	{ surface: 'list item', component: GiftListItemTestHost },
] as const;

afterEach(() => {
	for (const host of hosts) {
		host.remove();
	}
	hosts.clear();
});

async function renderSurface(
	component: (typeof surfaces)[number]['component'],
	gift: GiftForVisitor,
	role: WishlistRole,
): Promise<HTMLElement> {
	await page.viewport(1280, 800);
	const host = document.createElement('div');
	host.style.width = '360px';
	document.body.append(host);
	hosts.add(host);
	await render(
		component,
		{ gift, role, onreserve: () => {}, onunreserve: () => {}, onreceived: () => {} },
		{ baseElement: host },
	);
	return host;
}

function overlayText(host: HTMLElement): string {
	return host.querySelector('[data-testid="gift-state-overlay"]')?.textContent ?? '';
}

describe('gift state privacy (issue #442)', () => {
	it.each(surfaces)(
		'shows a visitor that the $surface is taken without naming who reserved it',
		async ({ component }) => {
			const host = await renderSurface(
				component,
				makeVisitorGift({
					reservedCount: 1,
					isFullyReserved: true,
					myReservationId: null,
					reserverNames: [RESERVER_NAME],
				}),
				WISHLIST_ROLES.visitor,
			);

			expect(overlayText(host)).toContain(m.gift_reserved_by_other_overlay());
			expect(host.textContent).not.toContain(RESERVER_NAME);
		},
	);

	it.each(surfaces)(
		'keeps other reservers anonymous on a $surface the visitor also reserved',
		async ({ component }) => {
			const host = await renderSurface(
				component,
				makeVisitorGift({
					quantity: 3,
					reservedCount: 2,
					isFullyReserved: false,
					myReservationId: 'reservation-1',
					reserverNames: [RESERVER_NAME, 'Petr Svoboda'],
				}),
				WISHLIST_ROLES.visitor,
			);

			expect(overlayText(host)).toContain(m.gift_reserved_by_me_overlay());
			expect(host.textContent).not.toContain(RESERVER_NAME);
			expect(host.textContent).not.toContain('Petr Svoboda');
		},
	);

	it.each(surfaces)(
		'never shows the recipient that a $surface was bought or by whom',
		async ({ component }) => {
			const host = await renderSurface(
				component,
				makeVisitorGift({
					quantity: 1,
					reservedCount: 1,
					isFullyReserved: true,
					myReservationId: 'reservation-1',
					myReservationPurchasedAt: new Date('2026-09-01T00:00:00Z'),
					reserverNames: [RESERVER_NAME],
				}),
				WISHLIST_ROLES.recipient,
			);

			expect(host.textContent).not.toContain(m.gift_bought());
			expect(host.textContent).not.toContain(RESERVER_NAME);
			for (const button of host.querySelectorAll('button')) {
				expect(button.textContent ?? '').not.toContain(m.gift_mark_bought());
				expect(button.getAttribute('aria-label') ?? '').not.toContain(m.gift_mark_bought());
			}
		},
	);
});
