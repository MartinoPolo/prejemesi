import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import * as m from '$lib/paraglide/messages.js';

const { default: ReserveButton } = await import('./ReserveButton.svelte');

function makeGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Kolo',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: null,
		priceMax: null,
		currency: null,
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 0,
		reservedCount: 1,
		isFullyReserved: true,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

describe('ReserveButton', () => {
	it('renders nothing when fully reserved by others', async () => {
		await render(ReserveButton, { gift: makeGift(), onreserve: vi.fn(), onunreserve: vi.fn() });
		expect(document.querySelector('[data-testid="reserve-button"]')).toBeNull();
	});

	it('preserves cancelling an own reservation on an archived wishlist', async () => {
		const onunreserve = vi.fn();
		await render(ReserveButton, {
			gift: makeGift({ myReservationId: 'reservation-1' }),
			isArchived: true,
			onunreserve,
		});

		await page
			.getByRole('button', { name: m.reserve_button_cancel_aria({ name: 'Kolo' }) })
			.click();
		expect(onunreserve).toHaveBeenCalledOnce();
	});

	it('preserves reserving an available gift on an active wishlist', async () => {
		const onreserve = vi.fn();
		const gift = makeGift({ reservedCount: 0, isFullyReserved: false });
		await render(ReserveButton, { gift, onreserve });

		await page
			.getByRole('button', { name: m.reserve_button_reserve_aria({ name: 'Kolo' }) })
			.click();
		expect(onreserve).toHaveBeenCalledWith(gift);
	});
});
