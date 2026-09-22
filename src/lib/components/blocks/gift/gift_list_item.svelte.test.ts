import '../../../../app.css';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	IMAGE_URL,
	imageMeta,
	makeVisitorGift,
	renderItem,
	expectRectanglesSeparated,
	textOutsideOverlay,
	GiftListItemTestHost,
} from './gift_list_item.test_fixtures.js';

const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

describe('GiftListItem centralized state overlay parity (issue #224 REQ-7)', () => {
	it('previews the latest post-share description append instead of stale base text', async () => {
		const host = await renderItem(
			makeVisitorGift({
				description: 'Původní popis',
				descriptionAppends: [
					{ text: 'Starší doplnění', addedAt: '2026-01-02T00:00:00.000Z' },
					{ text: 'Nejnovější důležitá informace', addedAt: '2026-01-03T00:00:00.000Z' },
				],
			}),
			WISHLIST_ROLES.visitor,
		);
		const description = host.querySelector('.gift-list-description') as HTMLElement;

		expect(description.textContent).toContain('Nejnovější důležitá informace');
		expect(description.textContent).not.toContain('Původní popis');
		expect(description.querySelector('button')).toBeNull();
		host.remove();
	});

	it('renders the assigned category over the list image', async () => {
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

		const badge = host.querySelector('[data-testid="gift-category-badge"]') as HTMLElement;
		expect(badge.textContent).toContain('Sport');
		expect(host.querySelector('[data-testid="gift-list-image"]')?.contains(badge)).toBe(true);
	});

	it('separates category and priority from the centered state and identity group', async () => {
		await page.viewport(344, 800);
		const host = await renderItem(
			makeVisitorGift({
				categoryId: 'category-sport',
				category: {
					id: 'category-sport',
					presetKey: null,
					customLabel: 'Sportovní vybavení',
					color: '#0369A1',
					sortOrder: 0,
				},
				priorityLabel: 'Vysoka',
				isFullyReserved: true,
				reservedCount: 1,
				reserverNames: ['Alexandra Nováková'],
				myReservationId: null,
			}),
			WISHLIST_ROLES.moderator,
			null,
			320,
		);
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);
		const category = host.querySelector('[data-testid="gift-category-badge"]') as HTMLElement;
		const priority = host.querySelector('[data-testid="gift-priority-badge"]') as HTMLElement;
		const overlayItems = host.querySelectorAll<HTMLElement>(
			'[data-testid="gift-state-overlay"] > span',
		);

		for (const overlayItem of overlayItems) {
			expectRectanglesSeparated(
				category.getBoundingClientRect(),
				overlayItem.getBoundingClientRect(),
			);
			expectRectanglesSeparated(
				priority.getBoundingClientRect(),
				overlayItem.getBoundingClientRect(),
			);
		}
		host.remove();
	});

	it('keeps a full long category clear of state, identity, and priority at 200% text', async () => {
		await page.viewport(344, 1000);
		const previousFontSize = document.documentElement.style.fontSize;
		document.documentElement.style.fontSize = '32px';
		const categoryLabel = 'Sportovní vybavení pro dlouhé zimní výpravy celé rodiny';
		try {
			const host = await renderItem(
				makeVisitorGift({
					categoryId: 'category-sport',
					category: {
						id: 'category-sport',
						presetKey: null,
						customLabel: categoryLabel,
						color: '#0369A1',
						sortOrder: 0,
					},
					priorityLabel: 'Vysoka',
					isFullyReserved: true,
					reservedCount: 1,
					reserverNames: ['Alexandra Nováková'],
					myReservationId: null,
				}),
				WISHLIST_ROLES.moderator,
				null,
				320,
			);
			await document.fonts.ready;
			const category = host.querySelector(
				'[data-testid="gift-category-badge"]',
			) as HTMLElement;
			const priority = host.querySelector(
				'[data-testid="gift-priority-badge"]',
			) as HTMLElement;
			const overlayItems = host.querySelectorAll<HTMLElement>(
				'[data-testid="gift-state-overlay"] > span',
			);

			expect(category.textContent?.trim()).toBe(categoryLabel);
			// Enlarged text needs the ResizeObserver-driven clearance layout to settle.
			await vi.waitFor(() => {
				expectPixelsAtMost(category.scrollHeight, category.clientHeight);
				for (const overlayItem of overlayItems) {
					expectRectanglesSeparated(
						category.getBoundingClientRect(),
						overlayItem.getBoundingClientRect(),
					);
					expectRectanglesSeparated(
						priority.getBoundingClientRect(),
						overlayItem.getBoundingClientRect(),
					);
				}
			});
			host.remove();
		} finally {
			document.documentElement.style.fontSize = previousFontSize;
		}
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

	it('shows the full-text reservation overlay and a veil on the thumb for a fully-reserved gift', async () => {
		await renderItem(
			makeVisitorGift({ isFullyReserved: true, reservedCount: 1, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);

		const thumb = document.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		expect(thumb.querySelector('[data-testid="gift-reserved-veil"]')).toBeTruthy();

		const overlayBadge = Array.from(document.querySelectorAll('span')).find((element) =>
			element.textContent?.includes('Rezervováno'),
		);
		expect(overlayBadge).toBeTruthy();
		// The overlay lives on the thumb, not buried in the content column.
		expect(thumb.contains(overlayBadge!)).toBe(true);
	});

	it('keeps reserved content colors legible while the image overlay carries state', async () => {
		await renderItem(
			makeVisitorGift({ isFullyReserved: true, reservedCount: 1, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);

		const row = document.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		// Row root no longer carries the dim — it moved to the content column (card semantics).
		expect(row.className).not.toContain('opacity-55');

		const dimmed = document.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
		expect(dimmed.className).not.toContain('grayscale-50');
		expect(dimmed.className).not.toContain('opacity-55');

		const overlayBadge = Array.from(document.querySelectorAll('span')).find((element) =>
			element.textContent?.includes('Rezervováno'),
		);
		expect(dimmed.contains(overlayBadge!)).toBe(false);
	});

	it('visitors receive no standalone reserver line', async () => {
		await renderItem(
			makeVisitorGift({ isFullyReserved: true, reservedCount: 1, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);
		// The visitor never gets reserver names anywhere.
		expect(document.body.textContent).not.toContain('rezervoval');
	});

	it('groups moderator reserver names with state on the image overlay', async () => {
		await renderItem(
			makeVisitorGift({
				isFullyReserved: true,
				reservedCount: 1,
				reserverNames: ['Babička'],
				myReservationId: null,
			}),
			WISHLIST_ROLES.moderator,
		);
		const image = document.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const content = document.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
		expect(content.textContent).not.toContain('Babička');
		expect(image.textContent).toContain('Babička');
		expect(image.textContent).toContain('Rezervováno');

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

describe('GiftListItem unified state presentation (issue #328)', () => {
	it('uses the shared centered state overlay on desktop without an inline Received badge', async () => {
		await page.viewport(800, 720);
		const host = await renderItem(
			makeVisitorGift({ received: true, isFullyReserved: true }),
			WISHLIST_ROLES.visitor,
		);

		expect(host.querySelectorAll('[data-testid="gift-state-overlay"]')).toHaveLength(1);
		expect(host.querySelector('[data-testid="gift-reserved-sticker"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-received-sticker"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-state-overlay"]')?.textContent).toContain(
			m.gift_received_badge(),
		);
	});

	it('keeps moderator reserver names with state during contextual mode', async () => {
		const host = document.createElement('div');
		host.style.width = '320px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ reserverNames: ['Babička'], isFullyReserved: true }),
				role: WISHLIST_ROLES.moderator,
				contextualMode: true,
				onreceived: () => {},
				onreserve: () => {},
			},
			{ baseElement: host },
		);

		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		expect(host.querySelector('[data-testid="gift-list-content"]')?.textContent).not.toContain(
			'Babička',
		);
		expect(image.textContent).toContain('Babička');
		expect(host.querySelector('[data-like-heart]')).toBeNull();
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	});

	it('derives received with partial-capacity support through the public list component', async () => {
		const host = await renderItem(
			makeVisitorGift({
				received: true,
				quantity: 3,
				reservedCount: 1,
				isFullyReserved: false,
				myReservationId: null,
			}),
			WISHLIST_ROLES.visitor,
		);
		const overlays = host.querySelectorAll('[data-testid="gift-state-overlay"]');
		const overlay = overlays[0] as HTMLElement;

		expect(overlays).toHaveLength(1);
		expect(overlay.querySelector('[data-state-primary]')?.textContent).toBe(
			m.gift_received_badge(),
		);
		expect(overlay.querySelector('[data-reservation-support]')?.textContent).toBe(
			m.gift_remaining_capacity({ remaining: 2, total: 3 }),
		);
	});

	it('shows received with own-reservation support in the unified list overlay', async () => {
		const host = await renderItem(
			makeVisitorGift({ received: true, isFullyReserved: true, myReservationId: 'mine' }),
			WISHLIST_ROLES.visitor,
		);
		const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;

		expect(overlay.textContent).toContain(m.gift_received_badge());
		expect(overlay.querySelector('[data-reservation-support]')?.textContent).toBe(
			m.gift_reserved_by_me_overlay(),
		);
	});

	it('keeps received recipient DOM and relative geometry identical across private reservation states', async () => {
		const states: Partial<GiftForVisitor>[] = [
			{
				received: true,
				quantity: 3,
				reservedCount: 0,
				isFullyReserved: false,
				myReservationId: null,
			},
			{
				received: true,
				quantity: 3,
				reservedCount: 1,
				isFullyReserved: false,
				myReservationId: null,
			},
			{
				received: true,
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
			},
			{
				received: true,
				quantity: 3,
				reservedCount: 1,
				isFullyReserved: false,
				myReservationId: 'private',
			},
		];
		const hosts = await Promise.all(
			states.map((state) =>
				renderItem(
					makeVisitorGift({ ...state, reserverNames: ['Soukromá osoba'] }),
					WISHLIST_ROLES.recipient,
				),
			),
		);
		const snapshots = hosts.map((host) => {
			const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const overlayRect = overlay.getBoundingClientRect();
			const imageRect = image.getBoundingClientRect();
			expect(overlay.querySelector('[data-state-primary]')?.textContent).toBe(
				m.gift_received_badge(),
			);
			expect(overlay.querySelector('[data-reservation-support]')).toBeNull();
			expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
			expect(host.querySelector('[aria-pressed]')).toBeNull();
			expect(host.textContent).not.toMatch(/rezerv|koupen|Soukromá osoba/i);
			return {
				html: overlay.innerHTML,
				left: overlayRect.left - imageRect.left,
				top: overlayRect.top - imageRect.top,
				width: overlayRect.width,
				height: overlayRect.height,
				rowHeight: host.firstElementChild!.getBoundingClientRect().height,
			};
		});
		const baseline = snapshots[0]!;
		for (const snapshot of snapshots.slice(1)) {
			expect(snapshot.html).toBe(baseline.html);
			expectPixelsNear(snapshot.left, baseline.left);
			expectPixelsNear(snapshot.top, baseline.top);
			expectPixelsNear(snapshot.width, baseline.width);
			expectPixelsNear(snapshot.height, baseline.height);
			expectPixelsNear(snapshot.rowHeight, baseline.rowHeight);
		}
	});

	it('shows two pills but no reservation actions or identity to a self-promoted recipient', async () => {
		const host = document.createElement('div');
		host.style.width = '640px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({
					received: true,
					quantity: 3,
					reservedCount: 1,
					myReservationId: null,
					reserverNames: ['Soukromá osoba'],
				}),
				role: WISHLIST_ROLES.recipient,
				hideReservationState: false,
				onreceived: () => {},
			},
			{ baseElement: host },
		);

		const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
		expect(overlay.children).toHaveLength(2);
		expect(overlay.querySelector('[data-reservation-support]')?.textContent).toBe(
			m.gift_remaining_capacity({ remaining: 2, total: 3 }),
		);
		expect(host.textContent).not.toContain('Soukromá osoba');
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
		expect(host.querySelector('[data-like-heart]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-received-toggle"]')).toBeTruthy();
		host.remove();
	});

	it.each([
		{
			label: 'own reservation',
			gift: { quantity: 3, reservedCount: 1, isFullyReserved: false },
			requiredLabels: [m.gift_reserved_by_me_overlay()],
		},
		{
			label: 'received plus unavailable',
			gift: {
				received: true,
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
			},
			requiredLabels: [m.gift_received_badge(), m.gift_reserved_by_other_overlay()],
		},
	])(
		'keeps $label overlay on the image while Like stays in the title lane',
		async ({ gift, requiredLabels }) => {
			await page.viewport(390, 720);
			const host = await renderItem(makeVisitorGift(gift), WISHLIST_ROLES.visitor, null, 360);
			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
			const likeButton = host.querySelector('[data-like-heart]')
				?.parentElement as HTMLElement;

			const imageRect = image.getBoundingClientRect();
			expectPixelsNear(imageRect.width, item.clientWidth * 0.35);
			expect(imageRect.width).toBeLessThan(imageRect.height);
			for (const requiredLabel of requiredLabels) {
				expect(overlay.textContent).toContain(requiredLabel);
			}
			expectPixelsAtLeast(likeButton.getBoundingClientRect().width, 40);
			for (const pill of overlay.querySelectorAll<HTMLElement>(':scope > span')) {
				expectRectanglesSeparated(
					pill.getBoundingClientRect(),
					likeButton.getBoundingClientRect(),
				);
			}
		},
	);

	it('keeps a long unavailable overlay clear of the visible Like control on a mobile portrait thumbnail', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
			}),
			WISHLIST_ROLES.visitor,
			null,
			360,
		);
		const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const badge = host.querySelector(
			'[data-testid="gift-state-overlay"] > span',
		) as HTMLElement;
		const likeButton = host.querySelector('[data-like-heart]')?.parentElement as HTMLElement;

		await expect
			.element(page.getByText(m.gift_reserved_by_other_overlay(), { exact: true }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /Přidat do oblíbených/ }))
			.toBeVisible();
		const imageRect = image.getBoundingClientRect();
		expectPixelsNear(imageRect.width, item.clientWidth * 0.35);
		expect(imageRect.width).toBeLessThan(imageRect.height);
		expectPixelsAtLeast(likeButton.getBoundingClientRect().width, 40);
		expectRectanglesSeparated(
			badge.getBoundingClientRect(),
			likeButton.getBoundingClientRect(),
		);
	});

	it.each([
		{
			dark: false,
			received: false,
			primary: m.gift_reserved_by_other_overlay(),
			support: null,
		},
		{
			dark: true,
			received: true,
			primary: m.gift_received_badge(),
			support: m.gift_reserved_by_me_overlay(),
		},
	])(
		'keeps no-image dimmed overlay text visible in a $dark dark host',
		async ({ dark, received, primary, support }) => {
			await page.viewport(390, 720);
			await renderItem(
				makeVisitorGift({
					received,
					isFullyReserved: true,
					myReservationId: support === null ? null : 'mine',
				}),
				WISHLIST_ROLES.visitor,
				{ palette: 'sky', dark },
			);

			await expect.element(page.getByText(primary, { exact: true })).toBeVisible();
			if (support !== null) {
				await expect.element(page.getByText(support, { exact: true })).toBeVisible();
			}
		},
	);

	it.each([
		{
			label: 'fully reserved',
			gift: { quantity: 3, reservedCount: 3, isFullyReserved: true, myReservationId: null },
			overlay: m.gift_reserved_by_other_overlay(),
		},
		{
			label: 'partially reserved',
			gift: { quantity: 3, reservedCount: 1, isFullyReserved: false, myReservationId: null },
			overlay: m.gift_remaining_capacity({ remaining: 2, total: 3 }),
		},
	])('centralizes $label quantity status in the overlay', async ({ gift, overlay }) => {
		await page.viewport(800, 720);
		const host = await renderItem(makeVisitorGift(gift), WISHLIST_ROLES.visitor);
		const primary = host.querySelector('[data-state-primary]') as HTMLElement;
		const pieceCount = host.querySelector('[data-testid="gift-piece-count"]') as HTMLElement;
		const outsideText = textOutsideOverlay(host);

		expect(primary.textContent).toBe(overlay);
		expect(pieceCount.textContent?.trim()).toBe('3 kusy');
		expect(outsideText).not.toMatch(/Volné|Plně rezervováno|\d+\s+rezervováno/i);
	});
});
