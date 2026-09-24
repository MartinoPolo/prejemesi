import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createPixelAssertions,
	DEFAULT_PIXEL_TOLERANCE,
} from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { ComponentProps } from 'svelte';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: WishlistGiftDisplay } = await import('./WishlistGiftDisplay.svelte');
const { default: WishlistGiftDisplayTestHost } =
	await import('./WishlistGiftDisplayTestHost.svelte');
const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

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

async function nextLayout(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

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

		expectPixelsAtLeast(gap, 8);
		expectPixelsAtMost(gap, 12);
		await screen.unmount();
	});

	it('uses one column when primary actions need the width and equal columns when two fit', async () => {
		const second = { ...visitorGift(), id: 'gift-2', name: 'Kávovar' };
		const responsiveSections = [{ ...sections[0]!, gifts: [visitorGift(), second] }];
		await page.viewport(390, 720);
		const screen = await render(WishlistGiftDisplayTestHost, {
			...defaultProps,
			role: WISHLIST_ROLES.visitor,
			sections: responsiveSections,
			viewMode: 'card',
		});
		let cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
		expect(cards[1]!.getBoundingClientRect().top).toBeGreaterThan(
			cards[0]!.getBoundingClientRect().top,
		);
		const reserveButton = Array.from(cards[0]!.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === m.reserve_button_reserve(),
		);
		expect(reserveButton).toBeDefined();
		expect(reserveButton!.closest('[inert], [aria-hidden="true"]')).toBeNull();
		expect(reserveButton!.getBoundingClientRect().width).toBeGreaterThan(0);
		expectPixelsAtMost(document.documentElement.scrollWidth, 390);

		for (const width of [600, 639]) {
			await page.viewport(width, 720);
			await nextLayout();
			cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
			const firstRect = cards[0]!.getBoundingClientRect();
			const secondRect = cards[1]!.getBoundingClientRect();
			expectPixelsNear(secondRect.top, firstRect.top);
			expectPixelsNear(secondRect.width, firstRect.width);
			expectPixelsNear(secondRect.left - firstRect.right, 8);
			expectPixelsAtMost(document.documentElement.scrollWidth, width);
		}
		await screen.unmount();
	});

	it.each(['card', 'list'] as const)(
		'wraps a long price below readable link metadata without overflow in %s view',
		async (viewMode) => {
			await page.viewport(320, 720);
			const gift = {
				...visitorGift(),
				links: [
					{
						url: 'https://example.com/extra-long-product-address',
						label: 'Velmi dlouhý čitelný název obchodu',
					},
				],
				price: 123456789,
				priceMax: 987654321,
				currency: 'CZK' as const,
			};
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts: [gift] }],
				viewMode,
			});
			const metadata = document.querySelector<HTMLElement>(
				viewMode === 'card'
					? '[data-testid="gift-card-surface"]'
					: '[data-testid="gift-list-content"]',
			)!;
			const link = metadata.querySelector<HTMLElement>('a')!;
			const price = metadata.querySelector<HTMLElement>(
				viewMode === 'card'
					? '[data-testid="gift-card-price"] span'
					: '[data-testid="gift-list-price"]',
			)!;
			const metadataRect = metadata.getBoundingClientRect();
			const linkRect = link.getBoundingClientRect();
			const priceRect = price.getBoundingClientRect();

			expectPixelsAtLeast(linkRect.width, 100);
			expectPixelsAtLeast(priceRect.top, linkRect.bottom);
			expectPixelsAtMost(priceRect.right, metadataRect.right);
			expectPixelsAtMost(document.documentElement.scrollWidth, 320);
			await screen.unmount();
		},
	);

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
				expectPixelsAtLeast(parseFloat(column), 280);
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

			expectPixelsNear(gridRect.right - rightmostEdge, 0);
			expectPixelsNear(gridRect.bottom - bottomEdge, viewportWidth >= 640 ? 20 : 0);
			expect(getComputedStyle(grid).overflowX).toBe('visible');
			expect(getComputedStyle(grid).overflowY).toBe('visible');
			expect(getComputedStyle(collection).zIndex).toBe('0');
			expectPixelsAtMost(document.documentElement.scrollWidth, viewportWidth);
			await screen.unmount();
		}
	});

	it.each([
		{ viewMode: 'card' as const, width: 390, surfaceTestId: 'gift-card-surface' },
		{
			viewMode: 'card' as const,
			width: 601,
			surfaceTestId: 'gift-card-surface',
			expectFractionalWidth: true,
		},
		{ viewMode: 'list' as const, width: 390, surfaceTestId: 'gift-list-item' },
		{ viewMode: 'card' as const, width: 768, surfaceTestId: 'gift-card-surface' },
		{ viewMode: 'list' as const, width: 768, surfaceTestId: 'gift-list-item' },
	])(
		'traces the real $viewMode surface at $width px while leaving focus distinct',
		async ({ viewMode, width, surfaceTestId, expectFractionalWidth }) => {
			await page.viewport(width, 720);
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				viewMode,
				selectionMode: true,
				selectedIds: ['gift-1'],
			});
			const wrapper = document.querySelector<HTMLElement>('[data-gift-item]')!;
			const interactionOwner = wrapper.querySelector<HTMLElement>(
				`[data-testid="${surfaceTestId}"]`,
			)!;
			const selectedSurface =
				viewMode === 'card'
					? interactionOwner.querySelector<HTMLElement>(
							':scope > .gift-card-painted-surface',
						)!
					: interactionOwner;
			const selectionPaint = getComputedStyle(selectedSurface, '::before');
			const surfaceStyle = getComputedStyle(selectedSurface);
			const surfaceRect = selectedSurface.getBoundingClientRect();
			const expectedPaddingWidth =
				surfaceRect.width -
				parseFloat(surfaceStyle.borderLeftWidth) -
				parseFloat(surfaceStyle.borderRightWidth);
			const expectedPaddingHeight =
				surfaceRect.height -
				parseFloat(surfaceStyle.borderTopWidth) -
				parseFloat(surfaceStyle.borderBottomWidth);
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
			expectPixelsNear(parseFloat(selectionPaint.width), expectedPaddingWidth);
			expectPixelsNear(parseFloat(selectionPaint.height), expectedPaddingHeight);
			if (expectFractionalWidth === true) {
				expect(Number.isInteger(expectedPaddingWidth)).toBe(false);
				expect(expectedPaddingWidth).not.toBe(selectedSurface.clientWidth);
			}
			for (const [
				radiusProperty,
				verticalBorderProperty,
				horizontalBorderProperty,
			] of corners) {
				const outerRadius = parseFloat(surfaceStyle[radiusProperty]);
				const verticalInset = parseFloat(surfaceStyle[verticalBorderProperty]);
				const horizontalInset = parseFloat(surfaceStyle[horizontalBorderProperty]);
				const selectedRadii = selectionPaint[radiusProperty].split(' ').map(parseFloat);

				expectPixelsNear(selectedRadii[0]!, outerRadius - horizontalInset);
				expectPixelsNear(selectedRadii.at(-1)!, outerRadius - verticalInset);
			}
			expect(selectionPaint.boxShadow).toContain('inset');
			expect(selectionPaint.boxShadow).toContain('3px');
			expect(selectionPaint.pointerEvents).toBe('none');
			expect(selectionPaint.zIndex).toBe('30');
			expect(surfaceStyle.overflow).toBe('visible');

			if (viewMode === 'card') {
				const ownerSelectionPaint = getComputedStyle(interactionOwner, '::before');
				const hoverBridge = getComputedStyle(interactionOwner, '::after');
				const ownerStyle = getComputedStyle(interactionOwner);
				const ordinaryOffset = parseFloat(
					ownerStyle.getPropertyValue('--elevation-ordinary-offset'),
				);

				expect(ownerSelectionPaint.content).toBe('none');
				expect(hoverBridge.position).toBe('absolute');
				expectPixelsNear(parseFloat(hoverBridge.top), interactionOwner.clientHeight);
				expectPixelsNear(parseFloat(hoverBridge.height), ordinaryOffset + 1);
				expectPixelsNear(parseFloat(hoverBridge.bottom), -parseFloat(hoverBridge.height));
				expect(hoverBridge.pointerEvents).toBe('auto');
			}

			if (viewMode === 'list' && width >= 640) {
				const wrapperRect = wrapper.getBoundingClientRect();
				const interactionRect = interactionOwner.getBoundingClientRect();
				expect(interactionRect.left).toBeGreaterThan(wrapperRect.left);
				expectPixelsNear(interactionRect.right, wrapperRect.right);
			}

			wrapper.focus();
			const focusPaint = getComputedStyle(wrapper, '::after');
			expect(focusPaint.boxShadow).toContain('inset');
			expect(focusPaint.boxShadow).toContain('2px');
			expect(focusPaint.boxShadow).not.toBe(selectionPaint.boxShadow);
			await screen.unmount();
		},
	);

	it.each(['selection', 'reorder'] as const)(
		'keeps real received and reservation overlays clear of the visible %s control',
		async (mode) => {
			const receivedReservedGift = {
				...visitorGift(),
				received: true,
				reservedCount: 1,
				isFullyReserved: true,
			};

			for (const { viewMode, width } of [
				{ viewMode: 'card' as const, width: 320 },
				{ viewMode: 'card' as const, width: 390 },
				{ viewMode: 'list' as const, width: 320 },
				{ viewMode: 'list' as const, width: 390 },
				{ viewMode: 'card' as const, width: 768 },
				{ viewMode: 'list' as const, width: 768 },
			]) {
				await page.viewport(width, 720);
				const screen = await render(WishlistGiftDisplay, {
					...defaultProps,
					sections: [{ ...sections[0]!, gifts: [receivedReservedGift] }],
					role: WISHLIST_ROLES.moderator,
					viewMode,
					selectionMode: mode === 'selection',
					selectedIds: mode === 'selection' ? [receivedReservedGift.id] : [],
					reorderMode: mode === 'reorder',
				});
				const wrapper = document.querySelector<HTMLElement>('[data-gift-item]')!;
				const image = wrapper.querySelector<HTMLElement>(
					viewMode === 'card'
						? '[data-testid="gift-card-image-frame"]'
						: '[data-testid="gift-list-image"]',
				)!;
				const controlSurfaces = Array.from(
					wrapper.querySelectorAll<HTMLElement>(
						mode === 'selection'
							? '[data-testid="gift-selection-control"] > [data-slot="checkbox-surface"]'
							: 'button[title] > [data-slot="elevation-surface"]',
					),
				);
				const pills = Array.from(
					image.querySelectorAll<HTMLElement>(
						'[data-testid="gift-state-overlay"] > span',
					),
				);

				expect(controlSurfaces).not.toHaveLength(0);
				expect(pills).toHaveLength(2);
				for (const controlSurface of controlSurfaces) {
					const gripRect = controlSurface.getBoundingClientRect();
					expect(gripRect.width).toBeGreaterThan(0);
					expect(gripRect.height).toBeGreaterThan(0);
					for (const pill of pills) {
						const pillRect = pill.getBoundingClientRect();
						expect(pillRect.width).toBeGreaterThan(0);
						expect(pillRect.height).toBeGreaterThan(0);
						const separatedOnAnAxis =
							gripRect.right <= pillRect.left + DEFAULT_PIXEL_TOLERANCE ||
							pillRect.right <= gripRect.left + DEFAULT_PIXEL_TOLERANCE ||
							gripRect.bottom <= pillRect.top + DEFAULT_PIXEL_TOLERANCE ||
							pillRect.bottom <= gripRect.top + DEFAULT_PIXEL_TOLERANCE;

						expect(
							separatedOnAnAxis,
							`${viewMode} ${width}px ${mode} control ${JSON.stringify(gripRect.toJSON())}, badge ${JSON.stringify(pillRect.toJSON())}`,
						).toBe(true);
					}
				}
				await screen.unmount();
			}
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
			const checkboxSurface = control.querySelector<HTMLElement>(
				'[data-slot="checkbox-surface"]',
			)!;

			expectPixelsNear(controlRect.width, 40);
			expectPixelsNear(controlRect.height, 40);
			expectPixelsNear(controlRect.left - wrapperRect.left, 9);
			expectPixelsNear(controlRect.top - wrapperRect.top, 9);
			expectPixelsNear(controlRect.left - imageRect.left, 7);
			expectPixelsAtMost(controlRect.right, imageRect.right);
			expectPixelsAtMost(controlRect.right, contentRect.left);
			expect(getComputedStyle(control).borderRadius).toBe(
				getComputedStyle(checkboxSurface).borderRadius,
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

			expectPixelsNear(controlRect.width, 32);
			expectPixelsNear(controlRect.height, 32);
			expectPixelsNear(surfaceRect.left - wrapperRect.left, 40);
			expectPixelsNear(surfaceRect.left - controlRect.right, 8);
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
				for (const badge of badges) {
					expect(badge.closest('[data-testid="gift-card-image-frame"]')).not.toBeNull();
				}
			}
			await screen.unmount();
		},
	);

	it('keeps price in its own left-aligned track below links without a footer separator', async () => {
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
			const links = card.querySelector<HTMLElement>('[data-testid="gift-card-links"]')!;
			const price = card.querySelector<HTMLElement>('[data-testid="gift-card-price"]')!;
			const footer = card.querySelector<HTMLElement>('[data-testid="gift-card-footer"]')!;
			expectPixelsAtLeast(
				price.getBoundingClientRect().top,
				links.getBoundingClientRect().bottom,
			);
			expectPixelsNear(
				price.getBoundingClientRect().left,
				links.getBoundingClientRect().left,
			);
			expect(getComputedStyle(footer).borderTopWidth).toBe('0px');
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
		expectPixelsNear(
			badges[0]!.getBoundingClientRect().top,
			badges[1]!.getBoundingClientRect().top,
		);
		expectPixelsNear(links[1]!.top, links[0]!.top);
		expectPixelsNear(links[2]!.top, links[0]!.top);
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
		await nextLayout();
		const cards = Array.from(
			document.querySelectorAll<HTMLElement>('[data-testid="gift-card-surface"]'),
		);
		const footers = cards.map((card) =>
			card
				.querySelector<HTMLElement>('[data-testid="gift-card-footer"]')!
				.getBoundingClientRect(),
		);

		expectPixelsNear(footers[1]!.top, footers[0]!.top);
		expectPixelsNear(footers[2]!.top, footers[0]!.top);
		expectPixelsNear(footers[1]!.bottom, footers[0]!.bottom);
		expectPixelsNear(footers[2]!.bottom, footers[0]!.bottom);
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

		expectPixelsNear(cardRects[2]!.top - cardRects[0]!.bottom, 20);
		expectPixelsNear(headers[1]!.top - cardRects[2]!.bottom, 20);
		expectPixelsNear(cardRects[0]!.top - headers[0]!.bottom, 20);
		expectPixelsNear(cardRects[4]!.top - headers[1]!.bottom, 20);
		expectPixelsNear(grid.getBoundingClientRect().bottom - cardRects[5]!.bottom, 20);
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
			{ width: 600, expectedGap: 8 },
		]) {
			await page.viewport(width, 1000);
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts }],
				viewMode: 'card',
			});
			const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
			const first = cards[0]!.getBoundingClientRect();
			const nextBand = cards
				.map((card) => card.getBoundingClientRect())
				.find((rect) => rect.top > first.top + DEFAULT_PIXEL_TOLERANCE);
			expect(nextBand).toBeDefined();
			expectPixelsNear(nextBand!.top - first.bottom, expectedGap);
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
		const body = document.querySelector<HTMLElement>(
			'[data-gift-card-track="title"]',
		)!.parentElement!;
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
		const badge = document.querySelector<HTMLElement>('[data-testid="gift-priority-badge"]')!;
		const image = document.querySelector<HTMLElement>('[data-testid="gift-list-image"]')!;
		const actions = document.querySelector<HTMLElement>('[data-testid="gift-list-actions"]')!;
		expect(image.contains(badge)).toBe(true);
		expect(actions.contains(badge)).toBe(false);
		await screen.unmount();
	});

	it('keeps crowded grouped desktop List frames full-height, aligned, and no wider than tall', async () => {
		const category = {
			id: 'category-long',
			presetKey: null,
			customLabel: 'Výpravné ilustrované edice a kompletní sběratelské kolekce',
			color: '#0369A1',
			sortOrder: 0,
		};
		const crowdedGift = {
			...visitorGift(),
			id: 'crowded',
			name: '1984 – George Orwell',
			categoryId: category.id,
			category,
			priorityLabel: 'Vysoka',
			reservedCount: 1,
			isFullyReserved: true,
			reserverNames: ['Jana Dvořáková'],
		};
		const longContentGift = {
			...visitorGift(),
			categoryId: category.id,
			category,
			id: 'tall-content',
			name: 'Kniha s dlouhým názvem, rozsáhlým popisem a více detaily',
			description: 'Podrobný popis dárku, který zabírá v seznamu více místa.',
			links: [{ url: 'https://example.com/book', label: 'Knihkupectví' }],
		};
		await page.viewport(1280, 900);
		const screen = await render(WishlistGiftDisplayTestHost, {
			...defaultProps,
			viewMode: 'list',
			role: WISHLIST_ROLES.moderator,
			grouping: 'category',
			sections: [
				{
					kind: GIFT_SECTION_KINDS.categoryGroup,
					key: 'category:long',
					label: category.customLabel,
					priorityKey: null,
					gifts: [crowdedGift, longContentGift],
				},
				{
					kind: GIFT_SECTION_KINDS.categoryGroup,
					key: 'category:other',
					label: 'Další knihy',
					priorityKey: null,
					gifts: [{ ...visitorGift(), id: 'short', name: 'Atlas' }],
				},
			],
		});
		await document.fonts.ready;
		const crowdedRow = document.querySelector<HTMLElement>('[data-gift-id="crowded"]')!;
		const crowdedImage = crowdedRow.querySelector<HTMLElement>(
			'[data-testid="gift-list-image"]',
		)!;
		expect(crowdedImage.querySelector('[data-testid="gift-category-badge"]')).not.toBeNull();
		expect(crowdedImage.querySelector('[data-testid="gift-priority-badge"]')).not.toBeNull();
		expect(crowdedImage.querySelector('[data-testid="gift-state-overlay"]')).not.toBeNull();
		expect(crowdedImage.textContent).toContain('Jana Dvořáková');
		expect(crowdedRow.querySelector('[data-testid="gift-list-actions"]')).not.toBeNull();

		const frames = () =>
			Array.from(
				document.querySelectorAll<HTMLElement>('[data-testid="gift-list-item"]'),
			).map((item) => {
				const image = item.querySelector<HTMLElement>('[data-testid="gift-list-image"]')!;
				const itemRect = item.getBoundingClientRect();
				const imageRect = image.getBoundingClientRect();
				const style = getComputedStyle(item);
				return {
					imageWidth: imageRect.width,
					imageHeight: imageRect.height,
					rowHeight: itemRect.height,
					verticalInset:
						itemRect.height -
						imageRect.height -
						parseFloat(style.borderTopWidth) -
						parseFloat(style.borderBottomWidth),
				};
			});
		const verify = (measurements: ReturnType<typeof frames>) => {
			expect(measurements).toHaveLength(3);
			for (const frame of measurements) {
				expectPixelsNear(frame.verticalInset, 0);
				expectPixelsAtMost(frame.imageWidth, frame.imageHeight);
			}
			for (const frame of measurements.slice(1)) {
				expectPixelsNear(frame.imageWidth, measurements[0]!.imageWidth);
			}
		};
		async function sampleIdle() {
			const samples = [frames()];
			for (let index = 0; index < 90; index += 1) {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				samples.push(frames());
			}
			for (const rowIndex of [0, 1, 2]) {
				for (const dimension of ['imageWidth', 'imageHeight', 'rowHeight'] as const) {
					const values = samples.map((sample) => sample[rowIndex]![dimension]);
					const changeCount = (from: number, to: number) =>
						values
							.slice(from + 1, to)
							.filter((value, index) => Math.abs(value - values[from + index]!) > 1)
							.length;
					expect(
						changeCount(0, 31),
						`${dimension} must converge after initial rendering`,
					).toBeLessThanOrEqual(5);
					expect(
						changeCount(30, samples.length),
						`${dimension} must stay stable while idle`,
					).toBe(0);
				}
			}
			for (const sample of samples.slice(-30)) {
				verify(sample);
			}
		}
		await sampleIdle();
		const settledRows = frames();
		expectPixelsNear(settledRows[2]!.imageWidth, settledRows[2]!.imageHeight);
		expect(
			Math.max(...settledRows.map((row) => row.rowHeight)) -
				Math.min(...settledRows.map((row) => row.rowHeight)),
		).toBeGreaterThan(8);
		const imageRect = crowdedImage.getBoundingClientRect();
		const categoryRect = crowdedImage
			.querySelector<HTMLElement>('[data-testid="gift-category-badge"]')!
			.getBoundingClientRect();
		const priorityRect = crowdedImage
			.querySelector<HTMLElement>('[data-testid="gift-priority-badge"]')!
			.getBoundingClientRect();
		const overlayItems = Array.from(
			crowdedImage.querySelectorAll<HTMLElement>('[data-testid="gift-state-overlay"] > span'),
		).map((item) => item.getBoundingClientRect());
		const actionRect = crowdedRow
			.querySelector<HTMLElement>('[data-testid="gift-list-actions"]')!
			.getBoundingClientRect();
		expectPixelsAtLeast(categoryRect.left, imageRect.left);
		expectPixelsAtMost(categoryRect.right, imageRect.right);
		expectPixelsAtLeast(overlayItems[0]!.top, categoryRect.bottom);
		expectPixelsAtMost(overlayItems.at(-1)!.bottom, priorityRect.top);
		expectPixelsAtMost(actionRect.bottom, crowdedRow.getBoundingClientRect().bottom);
		const wideImageWidth = settledRows[0]!.imageWidth;
		await page.viewport(1600, 900);
		await sampleIdle();
		expectPixelsNear(frames()[0]!.imageWidth, wideImageWidth);
		await page.viewport(640, 900);
		await sampleIdle();
		expect(frames()[0]!.imageWidth).toBeLessThan(wideImageWidth);
		await page.viewport(390, 900);
		await sampleIdle();
		expect(frames()[0]!.imageWidth).toBeLessThan(frames()[0]!.imageHeight);
		await screen.unmount();
	});

	it('uses equal mobile list image widths for mixed content and contains the footer', async () => {
		await page.viewport(390, 720);
		const second = {
			...visitorGift(),
			id: 'gift-2',
			name: 'Mimořádně dlouhý název dárku přes dva řádky',
			description: 'Krátký náhled popisu patří hned pod název.',
		};
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
		expectPixelsNear(imageRects[1]!.width, imageRects[0]!.width);
		for (const [index, imageRect] of imageRects.entries()) {
			const item = cards[index]!.querySelector<HTMLElement>(
				'[data-testid="gift-list-item"]',
			)!;
			const box = item.getBoundingClientRect();
			const style = getComputedStyle(item);
			expectPixelsNear(imageRect.width, Math.min(item.clientWidth * 0.35, 152));
			expectPixelsNear(imageRect.top, box.top + parseFloat(style.borderTopWidth));
			expectPixelsNear(imageRect.bottom, box.bottom - parseFloat(style.borderBottomWidth));
		}
		const description = cards[1]!.querySelector<HTMLElement>('.gift-list-description')!;
		const actions = cards[1]!.querySelector<HTMLElement>('[data-testid="gift-list-actions"]');
		expectPixelsAtLeast(
			description.getBoundingClientRect().top,
			cards[1]!.querySelector('h3')!.getBoundingClientRect().bottom,
		);
		if (actions !== null) {
			expectPixelsAtMost(actions.getBoundingClientRect().bottom, cardRects[1]!.bottom);
		}
		expectPixelsNear(cardRects[1]!.top - cardRects[0]!.bottom, 10);
		await screen.unmount();
	});
});
