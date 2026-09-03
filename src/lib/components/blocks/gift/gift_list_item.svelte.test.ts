// Layout-invariant suite (issue #211): measures real computed geometry, so the compiled
// Tailwind utilities must be present (mirrors gift_detail_form.svelte.test.ts).
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';
import * as m from '$lib/paraglide/messages.js';

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

async function renderItem(
	gift: GiftForVisitor,
	role: (typeof WISHLIST_ROLES)[keyof typeof WISHLIST_ROLES],
) {
	const host = document.createElement('div');
	host.style.width = '640px';
	document.body.appendChild(host);
	await render(GiftListItemTestHost, { gift, role, isArchived: false }, { baseElement: host });
	return host;
}

describe('GiftListItem reserved-sticker parity (issue #224 REQ-7)', () => {
	it('does not render the grid-only category badge for a categorized gift (issue #265)', async () => {
		const host = await renderItem(
			makeVisitorGift({
				categoryId: 'category-sport',
				category: {
					id: 'category-sport',
					presetKey: null,
					customLabel: 'Sport',
					color: '#0369A1',
					sortOrder: 0,
				},
			}),
			WISHLIST_ROLES.visitor,
		);

		expect(host.querySelector('[data-testid="gift-category-badge"]')).toBeNull();
	});

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

describe('GiftListItem responsive image dimensions (issue #330)', () => {
	it('keeps the desktop image square when the responsive size grows', async () => {
		await page.viewport(800, 720);
		const host = await renderItem(makeVisitorGift(), WISHLIST_ROLES.visitor);
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const imageRect = image.getBoundingClientRect();

		expect(imageRect.width).toBeGreaterThanOrEqual(128);
		expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
	});

	it('renders one opaque 128px standalone card with a consolidated state overlay', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({ isFullyReserved: true, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);
		const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;

		expect(item.getBoundingClientRect().height).toBeCloseTo(128, 0);
		expect(image.getBoundingClientRect().width).toBeCloseTo(128, 0);
		expect(host.querySelectorAll('[data-testid="gift-state-overlay"]')).toHaveLength(1);
		expect(host.querySelector('[data-testid="gift-reserved-sticker"]')).toBeNull();
	});

	it('shows only Received directly for a mobile moderator while preserving Reserve on desktop', async () => {
		await page.viewport(390, 720);
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null }),
				role: WISHLIST_ROLES.moderator,
				isArchived: false,
				onreceived: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		const received = host.querySelector('[data-testid="gift-received-toggle"]') as HTMLElement;
		const more = host.querySelector(`[aria-label="${m.gift_more_actions()}"]`) as HTMLElement;
		const reserve = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
		expect(received).toBeTruthy();
		expect(more).toBeTruthy();
		expect(getComputedStyle(received).display).not.toBe('none');
		expect(getComputedStyle(more).display).not.toBe('none');
		expect(getComputedStyle(reserve).display).toBe('none');

		await page.viewport(800, 720);
		expect(getComputedStyle(reserve).display).not.toBe('none');
	});

	it('does not render Like for an archived visitor gift while preserving own cancellation', async () => {
		await page.viewport(390, 720);
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
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

	it('leaves no reservation, Like, or Purchased trace for recipients', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({
				isFullyReserved: true,
				myReservationId: 'private-reservation',
				myReservationPurchasedAt: new Date('2026-01-03'),
				reserverNames: ['Soukromá osoba'],
			}),
			WISHLIST_ROLES.recipient,
		);

		expect(host.querySelector('[data-testid="gift-state-overlay"]')).toBeNull();
		expect(host.querySelector('[aria-pressed]')).toBeNull();
		expect(host.textContent).not.toMatch(/rezerv|koupen|Soukromá osoba/i);
	});
});

describe('GiftListItem Like geometry (issue #330 follow-up)', () => {
	it('contains a long centered state label beside the 40px Like on the 128px image', async () => {
		await page.viewport(390, 720);
		const host = document.createElement('div');
		host.style.width = '366px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({
					likeCount: 12,
					isFullyReserved: true,
					myReservationId: 'mine',
				}),
				role: WISHLIST_ROLES.visitor,
				isArchived: false,
				showLikeCount: false,
			},
			{ baseElement: host },
		);
		await document.fonts.ready;

		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const like = host.querySelector('[data-like-heart]')?.closest('button') as HTMLElement;
		const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
		const sticker = overlay.firstElementChild as HTMLElement;
		const label = sticker.firstElementChild as HTMLElement;
		const imageRect = image.getBoundingClientRect();
		const likeRect = like.getBoundingClientRect();
		const overlayRect = overlay.getBoundingClientRect();
		const stickerRect = sticker.getBoundingClientRect();
		const labelRange = document.createRange();
		labelRange.selectNodeContents(label);
		const labelRect = labelRange.getBoundingClientRect();

		expect(imageRect.width).toBeCloseTo(128, 0);
		expect(likeRect.width).toBeCloseTo(40, 0);
		expect(overlayRect.right).toBeLessThanOrEqual(imageRect.right - 40);
		expect(stickerRect.left + stickerRect.width / 2).toBeCloseTo(
			overlayRect.left + overlayRect.width / 2,
			0,
		);
		expect(stickerRect.right).toBeLessThanOrEqual(likeRect.left);
		expect(labelRect.left).toBeGreaterThanOrEqual(stickerRect.left);
		expect(labelRect.right).toBeLessThanOrEqual(stickerRect.right);
		expect(labelRect.top).toBeGreaterThanOrEqual(stickerRect.top);
		expect(labelRect.bottom).toBeLessThanOrEqual(stickerRect.bottom);
		expect(sticker.scrollWidth).toBeLessThanOrEqual(sticker.clientWidth);
		host.remove();
	});

	it('keeps the counted variant 40px square on mobile and allows growth only on desktop', async () => {
		await page.viewport(390, 720);
		const mobileHost = document.createElement('div');
		mobileHost.style.width = '640px';
		document.body.appendChild(mobileHost);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ likeCount: 12 }),
				role: WISHLIST_ROLES.visitor,
				isArchived: false,
				showLikeCount: true,
			},
			{ baseElement: mobileHost },
		);
		const mobileLike = mobileHost
			.querySelector('[data-like-heart]')
			?.closest('button') as HTMLElement;
		expect(mobileLike.getBoundingClientRect().width).toBeCloseTo(40, 0);
		expect(mobileLike.getBoundingClientRect().height).toBeCloseTo(40, 0);
		expect(mobileHost.querySelector('[data-like-count]')).toBeNull();

		await page.viewport(800, 720);
		const desktopHost = document.createElement('div');
		desktopHost.style.width = '640px';
		document.body.appendChild(desktopHost);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ id: 'desktop-like', likeCount: 12 }),
				role: WISHLIST_ROLES.visitor,
				isArchived: false,
				showLikeCount: true,
			},
			{ baseElement: desktopHost },
		);
		const desktopLike = desktopHost
			.querySelector('[data-like-heart]')
			?.closest('button') as HTMLElement;
		expect(desktopLike.getBoundingClientRect().width).toBeGreaterThanOrEqual(40);
		expect(desktopLike.getBoundingClientRect().height).toBeCloseTo(40, 0);
		expect(desktopHost.querySelector('[data-like-count]')).not.toBeNull();
		mobileHost.remove();
		desktopHost.remove();
	});

	it('keeps the centered state label clear of the top-right Like on the 128px image', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({
				likeCount: 12,
				received: true,
				isFullyReserved: true,
				myReservationId: 'mine',
			}),
			WISHLIST_ROLES.visitor,
		);
		const like = host.querySelector('[data-like-heart]')?.closest('button') as HTMLElement;
		const label = host.querySelector(
			'[data-testid="gift-state-overlay"] > span',
		) as HTMLElement;
		const likeRect = like.getBoundingClientRect();
		const labelRect = label.getBoundingClientRect();
		const overlaps =
			likeRect.left < labelRect.right &&
			likeRect.right > labelRect.left &&
			likeRect.top < labelRect.bottom &&
			likeRect.bottom > labelRect.top;
		expect(overlaps).toBe(false);
		host.remove();
	});
});

describe('GiftListItem reservation-action layout (issue #211)', () => {
	it('stacks the mark-as-bought and cancel-reservation actions vertically at equal width', async () => {
		await page.viewport(800, 720);
		const host = document.createElement('div');
		host.style.width = '400px';
		document.body.appendChild(host);

		await render(
			GiftListItemTestHost,
			{ gift: makeVisitorGift(), role: WISHLIST_ROLES.visitor, isArchived: false },
			{ baseElement: host },
		);

		const reserveButtonEl = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
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
