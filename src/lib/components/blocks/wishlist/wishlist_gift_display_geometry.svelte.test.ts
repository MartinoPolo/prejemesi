import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: WishlistGiftDisplay } = await import('./WishlistGiftDisplay.svelte');

function visitorGift(): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Stolní lampa',
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
		categoryId: null,
		category: null,
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
	};
}

const sections: GiftSection[] = [
	{
		kind: GIFT_SECTION_KINDS.available,
		key: 'available',
		label: null,
		gifts: [visitorGift()],
	},
];

const defaultProps: ComponentProps<typeof WishlistGiftDisplay> = {
	sections,
	role: WISHLIST_ROLES.recipient,
	isArchived: false,
	hideReservationState: false,
	viewMode: 'card',
	isEmpty: false,
	isFilteredEmpty: false,
	reorderMode: false,
	onedit: () => {},
	onreserve: () => {},
	onunreserve: () => {},
	onreceived: () => {},
	onaddgift: () => {},
	onclearfilters: () => {},
	onreorderpreview: () => {},
	onreordercommit: () => {},
	onreordercancel: () => {},
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('WishlistGiftDisplay mobile collection geometry (issue #336)', () => {
	it.each([
		{
			kind: GIFT_SECTION_KINDS.priorityGroup,
			key: 'priority:high',
			label: 'Vysoká priorita',
			priorityKey: null,
		},
		{
			kind: GIFT_SECTION_KINDS.categoryGroup,
			key: 'category:kitchen',
			label: 'Kuchyně',
			priorityKey: null,
		},
	])('keeps a short $kind heading close to its first card on mobile', async (section) => {
		await page.viewport(390, 720);
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [{ ...section, gifts: [visitorGift()] }],
			viewMode: 'card',
		});
		const heading = screen.getByRole('heading', { name: section.label }).element();
		const card = document.querySelector<HTMLElement>('[data-gift-item]')!;
		const gap = card.getBoundingClientRect().top - heading.getBoundingClientRect().bottom;

		expect(gap).toBeGreaterThanOrEqual(8);
		expect(gap).toBeLessThanOrEqual(12);
		await screen.unmount();
	});

	it('uses one card column at 320px and exactly two equal columns from 321px through 639px', async () => {
		const second = { ...visitorGift(), id: 'gift-2', name: 'Kávovar' };
		const responsiveSections = [{ ...sections[0]!, gifts: [visitorGift(), second] }];
		await page.viewport(320, 720);
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: responsiveSections,
			viewMode: 'card',
		});
		let cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
		expect(cards[1]!.getBoundingClientRect().top).toBeGreaterThan(
			cards[0]!.getBoundingClientRect().top,
		);

		await page.viewport(321, 720);
		cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
		const firstRect = cards[0]!.getBoundingClientRect();
		const secondRect = cards[1]!.getBoundingClientRect();
		expect(secondRect.top).toBeCloseTo(firstRect.top, 0);
		expect(secondRect.width).toBeCloseTo(firstRect.width, 0);
		expect(secondRect.left - firstRect.right).toBeCloseTo(8, 0);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(321);

		await page.viewport(639, 720);
		cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
		const firstAt639 = cards[0]!.getBoundingClientRect();
		const secondAt639 = cards[1]!.getBoundingClientRect();
		expect(secondAt639.top).toBeCloseTo(firstAt639.top, 0);
		expect(secondAt639.width).toBeCloseTo(firstAt639.width, 0);
		expect(secondAt639.left - firstAt639.right).toBeCloseTo(8, 0);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(639);
		await screen.unmount();
	});

	it('uses adaptive minmax columns at every desktop and tablet acceptance width', async () => {
		const gifts = Array.from({ length: 6 }, (_, index) => ({
			...visitorGift(),
			id: `gift-${index + 1}`,
			name: `Dárek ${index + 1}`,
		}));

		for (const { viewportWidth, collectionWidth } of [
			{ viewportWidth: 640, collectionWidth: 560 },
			{ viewportWidth: 768, collectionWidth: 688 },
			{ viewportWidth: 1024, collectionWidth: 944 },
			{ viewportWidth: 1280, collectionWidth: 1152 },
		]) {
			await page.viewport(viewportWidth, 900);
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts }],
				viewMode: 'card',
			});
			const collection = document.querySelector<HTMLElement>(
				'[data-wishlist-gift-collection]',
			)!;
			collection.style.width = `${collectionWidth}px`;
			const grid = collection.querySelector<HTMLElement>(
				'[data-testid="wishlist-gift-card-grid"]',
			)!;
			const columns = getComputedStyle(grid).gridTemplateColumns.split(' ');
			const expectedColumnCount = Math.floor((collectionWidth + 20) / 300);

			expect(columns).toHaveLength(expectedColumnCount);
			for (const column of columns) {
				expect(parseFloat(column)).toBeGreaterThanOrEqual(280);
			}
			await screen.unmount();
		}
	});

	it('keeps horizontal edges exact and leaves card paint plus desktop band clearance unclipped', async () => {
		const gifts = Array.from({ length: 4 }, (_, index) => ({
			...visitorGift(),
			id: `gift-${index + 1}`,
			name: `Dárek ${index + 1}`,
		}));

		for (const { viewportWidth, collectionWidth } of [
			{ viewportWidth: 390, collectionWidth: 390 },
			{ viewportWidth: 639, collectionWidth: 639 },
			{ viewportWidth: 640, collectionWidth: 560 },
			{ viewportWidth: 768, collectionWidth: 688 },
			{ viewportWidth: 1280, collectionWidth: 1152 },
		]) {
			await page.viewport(viewportWidth, 900);
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts }],
				viewMode: 'card',
				selectionMode: true,
				selectedIds: ['gift-4'],
			});
			const collection = document.querySelector<HTMLElement>(
				'[data-wishlist-gift-collection]',
			)!;
			collection.style.width = `${collectionWidth}px`;
			const grid = collection.querySelector<HTMLElement>(
				'[data-testid="wishlist-gift-card-grid"]',
			)!;
			const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-gift-item]'));
			const gridRect = grid.getBoundingClientRect();
			const cardRects = cards.map((card) => card.getBoundingClientRect());
			const rightmostEdge = Math.max(...cardRects.map((rect) => rect.right));
			const bottomEdge = Math.max(...cardRects.map((rect) => rect.bottom));

			expect(gridRect.right - rightmostEdge).toBeCloseTo(0, 0);
			expect(gridRect.bottom - bottomEdge).toBeCloseTo(viewportWidth >= 640 ? 20 : 0, 0);
			expect(getComputedStyle(grid).overflowX).toBe('visible');
			expect(getComputedStyle(grid).overflowY).toBe('visible');
			expect(getComputedStyle(collection).zIndex).toBe('0');
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(viewportWidth);
			await screen.unmount();
		}
	});

	it.each([
		{ viewMode: 'card' as const, width: 390, surfaceTestId: 'gift-card-surface' },
		{ viewMode: 'list' as const, width: 390, surfaceTestId: 'gift-list-item' },
		{ viewMode: 'card' as const, width: 768, surfaceTestId: 'gift-card-surface' },
		{ viewMode: 'list' as const, width: 768, surfaceTestId: 'gift-list-item' },
	])(
		'traces the real $viewMode surface at $width px while leaving focus distinct',
		async ({ viewMode, width, surfaceTestId }) => {
			await page.viewport(width, 720);
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				viewMode,
				selectionMode: true,
				selectedIds: ['gift-1'],
			});
			const wrapper = document.querySelector<HTMLElement>('[data-gift-item]')!;
			const surface = wrapper.querySelector<HTMLElement>(`[data-testid="${surfaceTestId}"]`)!;
			const selectionPaint = getComputedStyle(surface, '::before');
			const surfaceStyle = getComputedStyle(surface);
			const corners = [
				['borderTopLeftRadius', 'borderTopWidth', 'borderLeftWidth'],
				['borderTopRightRadius', 'borderTopWidth', 'borderRightWidth'],
				['borderBottomRightRadius', 'borderBottomWidth', 'borderRightWidth'],
				['borderBottomLeftRadius', 'borderBottomWidth', 'borderLeftWidth'],
			] as const;

			expect(wrapper.dataset.selected).toBe('true');
			expect(getComputedStyle(wrapper).outlineStyle).toBe('none');
			expect(selectionPaint.position).toBe('absolute');
			expect(selectionPaint.inset).toBe('0px');
			expect(parseFloat(selectionPaint.width)).toBeCloseTo(surface.clientWidth, 0);
			expect(parseFloat(selectionPaint.height)).toBeCloseTo(surface.clientHeight, 0);
			for (const [
				radiusProperty,
				verticalBorderProperty,
				horizontalBorderProperty,
			] of corners) {
				const outerRadius = parseFloat(surfaceStyle[radiusProperty]);
				const verticalInset = parseFloat(surfaceStyle[verticalBorderProperty]);
				const horizontalInset = parseFloat(surfaceStyle[horizontalBorderProperty]);
				const selectedRadii = selectionPaint[radiusProperty].split(' ').map(parseFloat);

				expect(selectedRadii[0]).toBeCloseTo(outerRadius - horizontalInset, 5);
				expect(selectedRadii.at(-1)).toBeCloseTo(outerRadius - verticalInset, 5);
			}
			expect(selectionPaint.boxShadow).toContain('inset');
			expect(selectionPaint.boxShadow).toContain('3px');
			expect(selectionPaint.pointerEvents).toBe('none');
			expect(selectionPaint.zIndex).toBe('30');
			expect(surfaceStyle.overflow).toBe('visible');

			if (viewMode === 'card') {
				const hoverBridge = getComputedStyle(surface, '::after');
				const ordinaryOffset = parseFloat(
					surfaceStyle.getPropertyValue('--elevation-ordinary-offset'),
				);

				expect(hoverBridge.position).toBe('absolute');
				expect(parseFloat(hoverBridge.top)).toBeCloseTo(surface.clientHeight, 0);
				expect(parseFloat(hoverBridge.height)).toBeCloseTo(ordinaryOffset + 1, 5);
				expect(parseFloat(hoverBridge.bottom)).toBeCloseTo(
					-parseFloat(hoverBridge.height),
					5,
				);
				expect(hoverBridge.pointerEvents).toBe('auto');
			}

			if (viewMode === 'list' && width >= 640) {
				const wrapperRect = wrapper.getBoundingClientRect();
				const surfaceRect = surface.getBoundingClientRect();
				expect(surfaceRect.left).toBeGreaterThan(wrapperRect.left);
				expect(surfaceRect.right).toBeCloseTo(wrapperRect.right, 0);
			}

			wrapper.focus();
			const focusPaint = getComputedStyle(wrapper, '::after');
			expect(focusPaint.boxShadow).toContain('inset');
			expect(focusPaint.boxShadow).toContain('2px');
			expect(focusPaint.boxShadow).not.toBe(selectionPaint.boxShadow);
			await screen.unmount();
		},
	);

	it('keeps the mobile List selection control inside the image and the desktop control in its gutter', async () => {
		for (const width of [320, 390]) {
			await page.viewport(width, 720);
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				viewMode: 'list',
				selectionMode: true,
				selectedIds: ['gift-1'],
			});
			const wrapper = document.querySelector<HTMLElement>('[data-gift-item]')!;
			const image = wrapper.querySelector<HTMLElement>('[data-testid="gift-list-image"]')!;
			const content = wrapper.querySelector<HTMLElement>(
				'[data-testid="gift-list-content"]',
			)!;
			const control = wrapper.querySelector<HTMLElement>(
				'[data-testid="gift-selection-control"]',
			)!;
			const wrapperRect = wrapper.getBoundingClientRect();
			const imageRect = image.getBoundingClientRect();
			const contentRect = content.getBoundingClientRect();
			const controlRect = control.getBoundingClientRect();
			const outerRadius = parseFloat(
				getComputedStyle(wrapper).getPropertyValue('--radius-panel'),
			);

			expect(controlRect.width).toBeCloseTo(40, 0);
			expect(controlRect.height).toBeCloseTo(40, 0);
			expect(controlRect.left - wrapperRect.left).toBeCloseTo(6, 0);
			expect(controlRect.top - wrapperRect.top).toBeCloseTo(6, 0);
			expect(controlRect.left - imageRect.left).toBeCloseTo(4, 0);
			expect(controlRect.right).toBeLessThanOrEqual(imageRect.right);
			expect(controlRect.right).toBeLessThanOrEqual(contentRect.left);
			expect(parseFloat(getComputedStyle(control).borderRadius)).toBeCloseTo(
				outerRadius - 6,
				5,
			);
			await screen.unmount();
		}

		for (const width of [640, 768]) {
			await page.viewport(width, 720);
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				viewMode: 'list',
				selectionMode: true,
				selectedIds: ['gift-1'],
			});
			const wrapper = document.querySelector<HTMLElement>('[data-gift-item]')!;
			const surface = wrapper.querySelector<HTMLElement>('[data-testid="gift-list-item"]')!;
			const control = wrapper.querySelector<HTMLElement>(
				'[data-testid="gift-selection-control"]',
			)!;
			const wrapperRect = wrapper.getBoundingClientRect();
			const surfaceRect = surface.getBoundingClientRect();
			const controlRect = control.getBoundingClientRect();

			expect(controlRect.width).toBeCloseTo(28, 0);
			expect(controlRect.height).toBeCloseTo(28, 0);
			expect(surfaceRect.left - wrapperRect.left).toBeCloseTo(36, 0);
			expect(surfaceRect.left - controlRect.right).toBeCloseTo(8, 0);
			await screen.unmount();
		}
	});

	it.each([
		{ viewMode: 'card' as const, width: 320 },
		{ viewMode: 'list' as const, width: 320 },
		{ viewMode: 'compact' as const, width: 320 },
		{ viewMode: 'card' as const, width: 768 },
		{ viewMode: 'list' as const, width: 768 },
		{ viewMode: 'compact' as const, width: 768 },
	])(
		'shows localized high and low priority badges in $viewMode at $width px',
		async ({ viewMode, width }) => {
			await page.viewport(width, 720);
			const high = { ...visitorGift(), id: 'gift-high', priorityLabel: 'Vysoka' };
			const low = { ...visitorGift(), id: 'gift-low', priorityLabel: 'Nizka' };
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts: [high, low] }],
				viewMode,
				grouping: 'none',
			});

			const badges = Array.from(
				document.querySelectorAll<HTMLElement>('[data-testid="gift-priority-badge"]'),
			);
			expect(badges.map((badge) => badge.dataset.priority)).toEqual(['Vysoka', 'Nizka']);
			const expectedLabels = {
				Vysoka: m.gift_priority_high(),
				Nizka: m.gift_priority_low(),
			};
			for (const badge of badges) {
				expect(badge.getBoundingClientRect().width).toBeGreaterThan(0);
				expect(getComputedStyle(badge).display).not.toBe('none');
				expect(badge.textContent?.trim()).toBe(
					expectedLabels[badge.dataset.priority as keyof typeof expectedLabels],
				);
			}
			if (viewMode === 'card' && width >= 640) {
				expect(badges[0]!.getBoundingClientRect().top).toBeCloseTo(
					badges[1]!.getBoundingClientRect().top,
					0,
				);
				expect(getComputedStyle(badges[0]!).gridRowStart).toBe('3');
			}
			await screen.unmount();
		},
	);

	it('collapses the shared priority track when every desktop card hides its badge', async () => {
		await page.viewport(768, 900);
		const gifts = [
			{
				...visitorGift(),
				id: 'gift-with-price',
				price: 1299,
				currency: 'CZK' as const,
				links: [{ url: 'https://example.com/lampa', label: 'Lampa' }],
			},
			{
				...visitorGift(),
				id: 'gift-without-price',
				links: [{ url: 'https://example.com/kniha', label: 'Kniha' }],
			},
		];
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [{ ...sections[0]!, gifts }],
			viewMode: 'card',
			grouping: 'priority',
		});

		for (const card of document.querySelectorAll<HTMLElement>(
			'[data-testid="gift-card-surface"]',
		)) {
			const body = card.querySelector<HTMLElement>(':scope > .row-start-2')!;
			const price = body.querySelector<HTMLElement>(':scope > .row-start-2')!;
			const link = body.querySelector<HTMLElement>('a')!;
			expect(
				link.getBoundingClientRect().top - price.getBoundingClientRect().bottom,
			).toBeCloseTo(8, 0);
		}
		expect(document.querySelector('[data-testid="gift-priority-badge"]')).toBeNull();
		await screen.unmount();
	});

	it('preserves the shared priority slot for peers when a desktop band has visible badges', async () => {
		await page.viewport(1280, 900);
		const base = {
			...visitorGift(),
			price: 1299,
			currency: 'CZK' as const,
			links: [{ url: 'https://example.com/darek', label: 'Dárek' }],
		};
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [
				{
					...sections[0]!,
					gifts: [
						{ ...base, id: 'gift-high', priorityLabel: 'Vysoka' },
						{ ...base, id: 'gift-none', priorityLabel: null },
						{ ...base, id: 'gift-low', priorityLabel: 'Nizka' },
					],
				},
			],
			viewMode: 'card',
			grouping: 'none',
		});
		const cards = Array.from(
			document.querySelectorAll<HTMLElement>('[data-testid="gift-card-surface"]'),
		);
		const links = cards.map((card) =>
			card.querySelector<HTMLElement>('a')!.getBoundingClientRect(),
		);
		const badges = Array.from(
			document.querySelectorAll<HTMLElement>('[data-testid="gift-priority-badge"]'),
		);

		expect(badges.map((badge) => badge.dataset.priority)).toEqual(['Vysoka', 'Nizka']);
		expect(badges[0]!.getBoundingClientRect().top).toBeCloseTo(
			badges[1]!.getBoundingClientRect().top,
			0,
		);
		expect(links[1]!.top).toBeCloseTo(links[0]!.top, 0);
		expect(links[2]!.top).toBeCloseTo(links[0]!.top, 0);
		await screen.unmount();
	});

	it('keeps desktop footers aligned across missing prices, wrapped links, long descriptions, and mixed actions', async () => {
		await page.viewport(1280, 1000);
		const longLinks = Array.from({ length: 3 }, (_, index) => ({
			url: `https://example.com/very-long-product-address-${index}`,
			label: `Velmi dlouhý odkaz na variantu produktu ${index}`,
		}));
		const gifts = [
			{
				...visitorGift(),
				id: 'gift-missing-price',
				links: longLinks,
				priorityLabel: 'Vysoka',
			},
			{
				...visitorGift(),
				id: 'gift-description',
				price: 2999,
				currency: 'CZK' as const,
				links: longLinks.slice(0, 1),
				description:
					'Dlouhý popis dárku, který se zalomí přes několik řádků a ověří společné zarovnání patiček.',
			},
			{
				...visitorGift(),
				id: 'gift-reserved',
				price: 499,
				currency: 'CZK' as const,
				links: longLinks.slice(0, 2),
				reservedCount: 1,
				isFullyReserved: true,
			},
		];
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [{ ...sections[0]!, gifts }],
			role: WISHLIST_ROLES.moderator,
			hideReservationState: true,
			hascontextactions: (gift) => gift.id !== 'gift-reserved',
			oncontextactions: () => true,
			viewMode: 'card',
			grouping: 'none',
		});
		const cards = Array.from(
			document.querySelectorAll<HTMLElement>('[data-testid="gift-card-surface"]'),
		);
		const footers = cards.map((card) =>
			card
				.querySelector<HTMLElement>('[data-testid="gift-card-footer"]')!
				.getBoundingClientRect(),
		);

		expect(footers[1]!.top).toBeCloseTo(footers[0]!.top, 0);
		expect(footers[2]!.top).toBeCloseTo(footers[0]!.top, 0);
		expect(footers[1]!.bottom).toBeCloseTo(footers[0]!.bottom, 0);
		expect(footers[2]!.bottom).toBeCloseTo(footers[0]!.bottom, 0);
		await screen.unmount();
	});

	it('keeps 20px between desktop card bands and priority-group headers without trailing overlap', async () => {
		await page.viewport(768, 1400);
		const gifts = Array.from({ length: 6 }, (_, index) => ({
			...visitorGift(),
			id: `gift-${index + 1}`,
			links: [{ url: `https://example.com/${index + 1}`, label: `Dárek ${index + 1}` }],
		}));
		const groupedSections: GiftSection[] = [
			{
				kind: GIFT_SECTION_KINDS.priorityGroup,
				key: 'priority:high',
				label: 'Vysoká priorita',
				priorityKey: 'Vysoka',
				gifts: gifts.slice(0, 4),
			},
			{
				kind: GIFT_SECTION_KINDS.priorityGroup,
				key: 'priority:low',
				label: 'Nízká priorita',
				priorityKey: 'Nizka',
				gifts: gifts.slice(4),
			},
		];
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: groupedSections,
			viewMode: 'card',
			grouping: 'priority',
		});
		const grid = document.querySelector<HTMLElement>(
			'[data-testid="wishlist-gift-card-grid"]',
		)!;
		const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-gift-item]'));
		const headers = Array.from(
			grid.querySelectorAll<HTMLElement>(':scope > .col-span-full'),
		).map((wrapper) => wrapper.firstElementChild!.getBoundingClientRect());
		const cardRects = cards.map((card) => card.getBoundingClientRect());

		expect(cardRects[2]!.top - cardRects[0]!.bottom).toBeCloseTo(20, 0);
		expect(headers[1]!.top - cardRects[2]!.bottom).toBeCloseTo(20, 0);
		expect(cardRects[0]!.top - headers[0]!.bottom).toBeCloseTo(20, 0);
		expect(cardRects[4]!.top - headers[1]!.bottom).toBeCloseTo(20, 0);
		expect(grid.getBoundingClientRect().bottom - cardRects[5]!.bottom).toBeCloseTo(20, 0);
		expect(getComputedStyle(grid).overflowY).toBe('visible');
		await screen.unmount();
	});

	it('leaves mobile card-band spacing unchanged', async () => {
		const gifts = Array.from({ length: 3 }, (_, index) => ({
			...visitorGift(),
			id: `mobile-gift-${index + 1}`,
		}));
		for (const { width, expectedGap } of [
			{ width: 320, expectedGap: 10 },
			{ width: 390, expectedGap: 8 },
		]) {
			await page.viewport(width, 1000);
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts }],
				viewMode: 'card',
			});
			const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
			const first = cards[0]!.getBoundingClientRect();
			const nextBand = cards[width === 320 ? 1 : 2]!.getBoundingClientRect();
			expect(nextBand.top - first.bottom).toBeCloseTo(expectedGap, 0);
			await screen.unmount();
		}
	});

	it('does not render an empty card priority spacing element for hidden or unrecognized priorities', async () => {
		const unknown = { ...visitorGift(), priorityLabel: 'Neznama' };
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [{ ...sections[0]!, gifts: [unknown] }],
			viewMode: 'card',
			grouping: 'none',
		});
		const body = document.querySelector('[data-testid="gift-card-surface"] > .row-start-2')!;
		expect(body.querySelector('[data-testid="gift-priority-badge"]')).toBeNull();
		expect(body.querySelector('.row-start-3')).toBeNull();

		await screen.rerender({
			...defaultProps,
			sections: [{ ...sections[0]!, gifts: [{ ...unknown, priorityLabel: 'Vysoka' }] }],
			viewMode: 'card',
			grouping: 'priority',
		});
		expect(body.querySelector('[data-testid="gift-priority-badge"]')).toBeNull();
		expect(body.querySelector('.row-start-3')).toBeNull();
		await screen.unmount();
	});

	it('shows priority for category grouping, hides it for priority grouping, and reacts to changes', async () => {
		const high = { ...visitorGift(), priorityLabel: 'Vysoka' };
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [{ ...sections[0]!, gifts: [high] }],
			grouping: 'category',
		});
		expect(document.querySelector('[data-priority="Vysoka"]')).not.toBeNull();

		await screen.rerender({
			...defaultProps,
			sections: [{ ...sections[0]!, gifts: [high] }],
			grouping: 'priority',
		});
		expect(document.querySelector('[data-testid="gift-priority-badge"]')).toBeNull();

		const low = { ...high, priorityLabel: 'Nizka' };
		await screen.rerender({
			...defaultProps,
			sections: [{ ...sections[0]!, gifts: [low] }],
			grouping: 'none',
		});
		expect(document.querySelector('[data-priority="Vysoka"]')).toBeNull();
		expect(document.querySelector('[data-priority="Nizka"]')).not.toBeNull();
		await screen.unmount();
	});

	it('keeps manager priority badges outside the action lane', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			role: WISHLIST_ROLES.moderator,
			hideReservationState: true,
			viewMode: 'list',
			sections: [{ ...sections[0]!, gifts: [{ ...visitorGift(), priorityLabel: 'Vysoka' }] }],
			onreceived: () => {},
		});
		const badgeRect = document
			.querySelector<HTMLElement>('[data-testid="gift-priority-badge"]')!
			.getBoundingClientRect();
		const actionsRect = document
			.querySelector<HTMLElement>('[data-testid="gift-list-actions"]')!
			.getBoundingClientRect();
		expect(badgeRect.bottom).toBeLessThanOrEqual(actionsRect.top);
		await screen.unmount();
	});

	it('uses standalone equal-height list cards with full-height square images and a 10px gap', async () => {
		await page.viewport(390, 720);
		const second = { ...visitorGift(), id: 'gift-2', name: 'Kávovar' };
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [{ ...sections[0]!, gifts: [visitorGift(), second] }],
			viewMode: 'list',
		});
		const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
		const cardRects = cards.map((card) => card.getBoundingClientRect());
		const imageRects = cards.map((card) =>
			(
				card.querySelector('[data-testid="gift-list-image"]') as HTMLElement
			).getBoundingClientRect(),
		);
		expect(cardRects[1]!.height).toBeCloseTo(cardRects[0]!.height, 0);
		for (const [index, imageRect] of imageRects.entries()) {
			expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
			expect(imageRect.height).toBeCloseTo(cardRects[index]!.height - 4, 0);
		}
		expect(cardRects[1]!.top - cardRects[0]!.bottom).toBeCloseTo(10, 0);
		await screen.unmount();
	});
});
