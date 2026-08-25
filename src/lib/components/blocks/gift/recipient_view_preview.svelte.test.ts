import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: RecipientViewPreviewTestHost } =
	await import('./RecipientViewPreviewTestHost.svelte');

function makeReservedGift(): GiftForVisitor {
	return {
		id: 'gift-preview',
		wishlistId: 'wishlist-1',
		name: 'Tajný dárek',
		description: 'Popis dárku',
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: 100,
		priceMax: null,
		currency: 'CZK',
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 3,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 4,
		reservedCount: 2,
		isFullyReserved: true,
		reserverNames: ['Babička'],
		myReservationId: 'reservation-mine',
		myReservationPurchasedAt: new Date('2026-01-02T00:00:00Z'),
	};
}

describe('recipient-view preview reservation privacy (#241)', () => {
	it.each(['card', 'list', 'compact', 'detail'] as const)(
		'hides reservation presentation and controls on the %s surface',
		async (surface) => {
			const screen = await render(RecipientViewPreviewTestHost, {
				gift: makeReservedGift(),
				role: WISHLIST_ROLES.moderator,
				surface,
			});

			expect(document.body.textContent).toContain('Tajný dárek');
			expect(document.body.textContent).not.toContain('Rezervováno');
			expect(document.body.textContent).not.toContain('rezervováno');
			expect(document.body.textContent).not.toContain('Babička');
			expect(document.body.textContent).not.toContain('2 rezervováno');
			expect(document.querySelector('[data-testid="reserve-button"]')).toBeNull();
			expect(document.querySelector('[data-testid="release-reservation-button"]')).toBeNull();
			expect(document.querySelector('button')).toBeNull();

			await screen.unmount();
		},
	);

	it('restores normal reservation-aware presentation when the flag is disabled', async () => {
		const screen = await render(RecipientViewPreviewTestHost, {
			gift: makeReservedGift(),
			role: WISHLIST_ROLES.moderator,
			surface: 'card',
			hideReservationState: false,
		});

		expect(document.body.textContent).toContain('Rezervováno');
		expect(document.body.textContent).toContain('Babička');
		expect(document.querySelector('[data-testid="reserve-button"]')).not.toBeNull();

		await screen.unmount();
	});
});
