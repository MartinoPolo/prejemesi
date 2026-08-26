// Layout-invariant suite (issue #211): measures real computed geometry, so the compiled
// Tailwind utilities must be present (mirrors gift_detail_form.svelte.test.ts).
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';

// GiftImage transitively imports the images module barrel, which reads `$env/dynamic/public`.
// vitest-browser-svelte mounts without SvelteKit's page bootstrap, so the virtual module
// throws unless stubbed (same workaround as gift_detail_form.svelte.test.ts).
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftCardTestHost } = await import('./GiftCardTestHost.svelte');

// Realistic long multi-word Czech name (issue #211 REQ-2 fixture) – long enough to stress
// the footer/name rows in a way that mirrors real content. (An unbroken 90-char run is
// also safe here: `name`'s `line-clamp-2` implies `overflow: hidden`, which per the CSS
// Sizing spec zeroes the grid item's automatic minimum size on that axis, so it can't drag
// the card wider either — see GiftCard.stories.svelte's hostile-name fixture.)
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
		// REQ-1/2): both PurchasedToggle ("mark as bought") and ReserveButton ("cancel
		// reservation") render together – the exact case that overflowed.
		myReservationId: 'reservation-1',
		myReservationPurchasedAt: null,
		...overrides,
	};
}

/** Renders `GiftCardTestHost` inside a fixed-width host that mirrors the real
 *  `WishlistGiftCardGrid` column (`minmax(280px, 1fr)`), so the card sits in a
 *  constrained track the same way it does on the wishlist page. */
async function renderCardInGridColumn(gift: GiftForVisitor) {
	const host = document.createElement('div');
	host.style.display = 'grid';
	host.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
	host.style.width = '300px';
	document.body.appendChild(host);

	await render(
		GiftCardTestHost,
		{ gift, role: WISHLIST_ROLES.visitor, isArchived: false },
		{ baseElement: host },
	);

	return host;
}

describe('GiftCard image background fill (issue #252)', () => {
	it('paints the visible outer card frame with explicit black and removes the pattern', async () => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#000000') }),
		);

		const cardFrame = host.querySelector(
			'[data-testid="gift-card-image-frame"]',
		) as HTMLElement;
		const imageFrame = cardFrame.querySelector('[data-testid="image-frame"]') as HTMLElement;

		expect(cardFrame).toBeTruthy();
		expect(imageFrame).toBeTruthy();
		expect(getComputedStyle(cardFrame).backgroundColor).toBe('rgb(0, 0, 0)');
		expect(getComputedStyle(imageFrame).backgroundColor).toBe('rgb(0, 0, 0)');
		expect(cardFrame.querySelector('[data-testid="gift-card-image-pattern"]')).toBeNull();
	});

	it('keeps the pattern for legacy null fill', async () => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta(null) }),
		);

		const cardFrame = host.querySelector(
			'[data-testid="gift-card-image-frame"]',
		) as HTMLElement;
		expect(cardFrame).toBeTruthy();
		expect(cardFrame.querySelector('[data-testid="gift-card-image-pattern"]')).toBeTruthy();
	});
});

describe('GiftCard reservation-action layout (issue #211)', () => {
	it('renders a stored gift image key without replacing the persisted source URL', async () => {
		await renderCardInGridColumn(
			makeVisitorGift({
				imageUrl: null,
				imageKey: 'gifts/cam.jpg',
			}),
		);

		expect(document.querySelector('img')?.getAttribute('src')).toBe(
			'/api/upload/gifts/cam.jpg',
		);
	});

	it('stacks the mark-as-bought and cancel-reservation actions vertically at equal width', async () => {
		await renderCardInGridColumn(makeVisitorGift());

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

		// Stacked: the reserve/cancel button sits below the purchased-toggle button,
		// not beside it (no vertical overlap).
		expect(reserveRect.top).toBeGreaterThanOrEqual(purchasedRect.bottom);
		// Equal width: both actions get `w-full` inside the shared `reservationActions`
		// column, rather than each sizing to its own (differently-localized) label.
		expect(reserveRect.width).toBeCloseTo(purchasedRect.width, 1);
	});

	it('keeps the footer within the rendered card width, even with a long name', async () => {
		await renderCardInGridColumn(makeVisitorGift());

		const cardEl = document
			.querySelector('[data-testid="reserve-button"]')
			?.closest('[class*="rounded-panel"]') as HTMLElement;
		const footerEl = cardEl.querySelector('.row-start-7') as HTMLElement;

		// The card's own box never exceeds its grid track (it already carries
		// `overflow-hidden` for the rounded corners/sticker, unrelated to this fix), so
		// checking the card against its host would pass whether or not the footer fix is
		// present. The footer-vs-card check below is what the fix actually protects:
		// before it, the unstacked button pair's min-content width dragged the footer
		// wider than the card (clipped invisibly by that pre-existing `overflow-hidden`,
		// but still a real layout defect internally).
		expect(footerEl.getBoundingClientRect().width).toBeLessThanOrEqual(
			cardEl.getBoundingClientRect().width + 0.5,
		);
	});
});
