// Layout-invariant suite (issue #211): measures real computed geometry, so the compiled
// Tailwind utilities must be present (mirrors gift_detail_form.svelte.test.ts).
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftListItemTestHost } = await import('./GiftListItemTestHost.svelte');

const REALISTIC_LONG_NAME =
	'Bezdrátová herní myš s RGB podsvícením a vyměnitelnými tlačítky pro praváky i leváky';
const IMAGE_URL =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="64"/>');

function imageMeta(bgColor: string | null): ImageMetadata {
	return {
		fitMode: IMAGE_FIT_MODES.containPadded,
		cropRect: null,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor,
	};
}

function makeVisitorGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: REALISTIC_LONG_NAME,
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
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 0,
		reservedCount: 1,
		isFullyReserved: false,
		reserverNames: [],
		// Non-null myReservationId puts the visitor in the "reserved by me" state (#211
		// REQ-1/2): both PurchasedToggle and ReserveButton render together.
		myReservationId: 'reservation-1',
		myReservationPurchasedAt: null,
		...overrides,
	};
}

describe('GiftListItem reserved-sticker parity (issue #224 REQ-7)', () => {
	async function renderItem(
		gift: GiftForVisitor,
		role: (typeof WISHLIST_ROLES)[keyof typeof WISHLIST_ROLES],
	) {
		const host = document.createElement('div');
		host.style.width = '640px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{ gift, role, isArchived: false },
			{ baseElement: host },
		);
		return host;
	}

	it('paints the visible list thumbnail frame with explicit black', async () => {
		const host = await renderItem(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#000000') }),
			WISHLIST_ROLES.visitor,
		);

		const imageFrame = host.querySelector('[data-testid="image-frame"]') as HTMLElement;
		expect(imageFrame).toBeTruthy();
		expect(getComputedStyle(imageFrame).backgroundColor).toBe('rgb(0, 0, 0)');
	});

	it.each([null, 'transparent'])(
		'uses the theme fallback for default %s metadata',
		async (bgColor) => {
			const root = document.documentElement;
			const previousValue = root.style.getPropertyValue('--secondary');
			const previousPriority = root.style.getPropertyPriority('--secondary');
			root.style.setProperty('--secondary', 'rgb(12, 34, 56)');

			try {
				const host = await renderItem(
					makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta(bgColor) }),
					WISHLIST_ROLES.visitor,
				);
				const imageFrame = host.querySelector('[data-testid="image-frame"]') as HTMLElement;
				expect(imageFrame).toBeTruthy();
				expect(getComputedStyle(imageFrame).backgroundColor).toBe('rgb(12, 34, 56)');
			} finally {
				if (previousValue) {
					root.style.setProperty('--secondary', previousValue, previousPriority);
				} else {
					root.style.removeProperty('--secondary');
				}
			}
		},
	);

	it('shows the full-text reserved sticker and a veil on the thumb for a fully-reserved gift', async () => {
		await renderItem(
			makeVisitorGift({ isFullyReserved: true, reservedCount: 1, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);

		const thumb = document.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		expect(thumb.querySelector('[data-testid="gift-reserved-veil"]')).toBeTruthy();

		const sticker = Array.from(document.querySelectorAll('span')).find((el) =>
			el.textContent?.includes('Rezervováno'),
		);
		expect(sticker).toBeTruthy();
		// Sticker lives on the thumb, not buried in the content column.
		expect(thumb.contains(sticker!)).toBe(true);
	});

	it('dims the content column but keeps the sticker crisp (not inside a dimmed wrapper)', async () => {
		await renderItem(
			makeVisitorGift({ isFullyReserved: true, reservedCount: 1, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);

		const row = document.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		// Row root no longer carries the dim — it moved to the content column (card semantics).
		expect(row.className).not.toContain('opacity-55');

		const dimmed = document.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
		expect(dimmed.className).toContain('opacity-55');

		const sticker = Array.from(document.querySelectorAll('span')).find((el) =>
			el.textContent?.includes('Rezervováno'),
		);
		expect(dimmed.contains(sticker!)).toBe(false);
	});

	it('does not render the standalone inline reserver line (names moved into the sticker)', async () => {
		await renderItem(
			makeVisitorGift({ isFullyReserved: true, reservedCount: 1, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);
		// The visitor never gets reserver names anywhere.
		expect(document.body.textContent).not.toContain('rezervoval');
	});

	it('shows reserver names inside the sticker for a moderator, but not for a visitor', async () => {
		await renderItem(
			makeVisitorGift({
				isFullyReserved: true,
				reservedCount: 1,
				reserverNames: ['Babička'],
				myReservationId: null,
			}),
			WISHLIST_ROLES.moderator,
		);
		expect(document.body.textContent).toContain('Babička');
		expect(document.body.textContent).toContain('Rezervováno');

		document.body.innerHTML = '';

		await renderItem(
			makeVisitorGift({
				isFullyReserved: true,
				reservedCount: 1,
				reserverNames: ['Babička'],
				myReservationId: null,
			}),
			WISHLIST_ROLES.visitor,
		);
		expect(document.body.textContent).not.toContain('Babička');
	});
});

describe('GiftListItem reservation-action layout (issue #211)', () => {
	it('stacks the mark-as-bought and cancel-reservation actions vertically at equal width', async () => {
		const host = document.createElement('div');
		host.style.width = '400px';
		document.body.appendChild(host);

		await render(
			GiftListItemTestHost,
			{ gift: makeVisitorGift(), role: WISHLIST_ROLES.visitor, isArchived: false },
			{ baseElement: host },
		);

		const reserveButtonEl = document.querySelector(
			'[data-testid="reserve-button"]',
		) as HTMLElement;
		const purchasedButtonEl = reserveButtonEl.parentElement!.querySelector(
			'button:not([data-testid])',
		) as HTMLElement;

		expect(reserveButtonEl).toBeTruthy();
		expect(purchasedButtonEl).toBeTruthy();

		const reserveRect = reserveButtonEl.getBoundingClientRect();
		const purchasedRect = purchasedButtonEl.getBoundingClientRect();

		// Stacked: no vertical overlap between the two actions.
		expect(reserveRect.top).toBeGreaterThanOrEqual(purchasedRect.bottom);
		// Equal width: both get `w-full` inside the stacked column, matching the
		// widest label instead of each shrink-wrapping to its own text.
		expect(reserveRect.width).toBeCloseTo(purchasedRect.width, 1);
	});
});
