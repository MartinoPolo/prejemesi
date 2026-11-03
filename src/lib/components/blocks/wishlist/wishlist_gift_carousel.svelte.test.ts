import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { ComponentProps } from 'svelte';
import { GIFT_VIEW_MODES, type GiftForVisitor } from '$lib/modules/gifts/types.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import { formatGiftCount } from '$lib/modules/gifts/gift_display.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: WishlistGiftDisplayTestHost } =
	await import('./WishlistGiftDisplayTestHost.svelte');
const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

const PAGE_GUTTER = 12;
const CARD_GAP = 8;
const TOUCH_TARGET = 40;

function visitorGift(id: string, overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id,
		wishlistId: 'wishlist-1',
		name: `Dárek ${id}`,
		description: 'Popis, který Carousel karta nezobrazuje.',
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: 1200,
		priceMax: null,
		currency: 'CZK',
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		images: [],
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		categoryIds: ['category-electronics'],
		categories: [
			{
				id: 'category-electronics',
				presetKey: 'electronics',
				customLabel: null,
				color: '#0F766E',
				sortOrder: 0,
			},
		],
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

const groupedSections: GiftSection[] = [
	{
		kind: GIFT_SECTION_KINDS.categoryGroup,
		key: 'category:electronics',
		label: 'Elektronika',
		gifts: ['a', 'b', 'c', 'd', 'e'].map((id) => visitorGift(id)),
	},
	{
		kind: GIFT_SECTION_KINDS.categoryGroup,
		key: 'category:books',
		label: 'Knihy',
		gifts: ['f', 'g'].map((id) => visitorGift(id)),
	},
];

const defaultProps: ComponentProps<typeof WishlistGiftDisplayTestHost> = {
	sections: groupedSections,
	role: WISHLIST_ROLES.visitor,
	isArchived: false,
	hideReservationState: false,
	viewMode: GIFT_VIEW_MODES.carousel,
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

const hosts = new Set<HTMLElement>();

/** Mirrors the page content column: full width with the page gutter as inline padding. */
async function renderCarousel(
	width: number,
	overrides: Partial<ComponentProps<typeof WishlistGiftDisplayTestHost>> = {},
) {
	await page.viewport(width, 800);
	const host = document.createElement('div');
	host.style.paddingInline = 'var(--page-gutter)';
	document.body.style.margin = '0';
	document.body.appendChild(host);
	hosts.add(host);
	const screen = await render(
		WishlistGiftDisplayTestHost,
		{ ...defaultProps, ...overrides },
		{ baseElement: host },
	);
	await settledLayout();
	return screen;
}

/** Waits for layout and for the collection's entrance motion to finish. */
async function settledLayout(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
	await Promise.all(
		document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
	);
}

function rows(): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>('[data-testid="gift-carousel-row"]'));
}

function cardsOf(row: HTMLElement): HTMLElement[] {
	return Array.from(row.querySelectorAll<HTMLElement>('[data-testid="gift-card-surface"]'));
}

afterEach(async () => {
	for (const host of hosts) {
		host.remove();
	}
	hosts.clear();
	document.body.style.margin = '';
	await page.viewport(1280, 800);
});

describe('WishlistGiftCarousel (#580)', () => {
	it('renders one horizontal row per group under a header with its gift count (REQ-4)', async () => {
		const screen = await renderCarousel(375);
		const groups = document.querySelectorAll('[data-testid="gift-carousel-group"]');
		expect(groups).toHaveLength(2);
		expect(groups[0]).toHaveTextContent('Elektronika');
		expect(groups[0].querySelector('[data-testid="gift-section-count"]')).toHaveTextContent(
			formatGiftCount(5),
		);
		expect(groups[1].querySelector('[data-testid="gift-section-count"]')).toHaveTextContent(
			formatGiftCount(2),
		);
		const [firstRow] = rows();
		const cards = cardsOf(firstRow);
		expect(cards).toHaveLength(5);
		expectPixelsNear(
			cards[4].getBoundingClientRect().top,
			cards[0].getBoundingClientRect().top,
		);
		expect(firstRow).toHaveAttribute('aria-label', `Elektronika, ${formatGiftCount(5)}`);
		expect(firstRow).toHaveAttribute('tabindex', '0');
		expect(firstRow.querySelector('[data-testid="gift-card-description-stack"]')).toBeNull();
		await screen.unmount();
	});

	it.each([
		{ width: 320, fullCards: 1, peek: 0.5 },
		{ width: 375, fullCards: 2, peek: 0.2 },
		{ width: 430, fullCards: 2, peek: 0.2 },
		{ width: 540, fullCards: 3, peek: 0.2 },
	])(
		'peeks the next card at the right edge at $width px (REQ-5)',
		async ({ width, fullCards, peek }) => {
			const screen = await renderCarousel(width);
			const cards = cardsOf(rows()[0]);
			const expectedCardWidth =
				(width - PAGE_GUTTER - fullCards * CARD_GAP) / (fullCards + peek);
			expectPixelsNear(cards[0].getBoundingClientRect().width, expectedCardWidth);
			expectPixelsNear(cards[0].getBoundingClientRect().left, PAGE_GUTTER);
			const lastFullCard = cards[fullCards - 1].getBoundingClientRect();
			expectPixelsAtMost(lastFullCard.right, width);
			const peekingCard = cards[fullCards].getBoundingClientRect();
			expectPixelsNear(width - peekingCard.left, peek * expectedCardWidth);
			await screen.unmount();
		},
	);

	it('keeps the last card and every shadow inside the scroller (REQ-6, REQ-7)', async () => {
		const screen = await renderCarousel(375);
		const [firstRow] = rows();
		const viewport = firstRow.querySelector<HTMLElement>('[data-slot="carousel-content"]')!;
		expect(getComputedStyle(viewport).overflowX).toBe('auto');
		viewport.scrollLeft = viewport.scrollWidth;
		await settledLayout();
		const cards = cardsOf(firstRow);
		const lastCard = cards.at(-1)!.getBoundingClientRect();
		const viewportRect = viewport.getBoundingClientRect();
		const shadowOffset = parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue(
				'--elevation-ordinary-offset',
			),
		);
		expectPixelsNear(lastCard.right, 375 - PAGE_GUTTER);
		expectPixelsAtLeast(viewportRect.right - lastCard.right, shadowOffset);
		expectPixelsAtLeast(viewportRect.bottom - lastCard.bottom, shadowOffset);
		expectPixelsAtLeast(lastCard.top - viewportRect.top, 2);
		await screen.unmount();
	});

	it.each([
		{ width: 375, faceHeight: 26 },
		{ width: 430, faceHeight: 32 },
	])(
		'uses $faceHeight px footer faces with 40px touch targets at $width px (REQ-6)',
		async ({ width, faceHeight }) => {
			const screen = await renderCarousel(width);
			const card = rows()[0].querySelector<HTMLElement>('[data-gift-card-density]')!;
			const reserve = card.querySelector<HTMLElement>('[data-testid="reserve-button"]')!;
			const more = card.querySelector<HTMLElement>('[data-testid="gift-more-actions"]');
			expectPixelsNear(reserve.getBoundingClientRect().height, faceHeight);
			const hitArea = getComputedStyle(reserve, '::before');
			expectPixelsNear(
				reserve.getBoundingClientRect().height -
					parseFloat(hitArea.top) -
					parseFloat(hitArea.bottom),
				TOUCH_TARGET,
			);
			if (more !== null) {
				expectPixelsNear(
					more.getBoundingClientRect().top,
					reserve.getBoundingClientRect().top,
				);
			}
			await screen.unmount();
		},
	);

	it('keeps a one-word category on one line on narrow cards (REQ-6)', async () => {
		const screen = await renderCarousel(375);
		const badge = rows()[0].querySelector<HTMLElement>('[data-testid="gift-category-badge"]')!;
		const lineHeight = parseFloat(getComputedStyle(badge).lineHeight);
		expectPixelsAtMost(badge.scrollHeight, lineHeight + 8);
		expect(badge.scrollWidth).toBeLessThanOrEqual(badge.clientWidth);
		await screen.unmount();
	});

	it('shows an ungrouped list as a single row with a count-only header (REQ-3)', async () => {
		const screen = await renderCarousel(375, {
			sections: [
				{
					kind: GIFT_SECTION_KINDS.available,
					key: 'available',
					label: null,
					gifts: ['a', 'b'].map((id) => visitorGift(id, { categories: [] })),
				},
				{
					kind: GIFT_SECTION_KINDS.reserved,
					key: 'reserved',
					label: null,
					gifts: [visitorGift('c', { categories: [], isFullyReserved: true })],
				},
			],
		});
		expect(rows()).toHaveLength(1);
		expect(cardsOf(rows()[0])).toHaveLength(3);
		expect(rows()[0]).toHaveAttribute('aria-label', formatGiftCount(3));
		await screen.unmount();
	});
});
