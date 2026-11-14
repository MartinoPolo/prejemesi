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
import * as m from '$lib/paraglide/messages.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: WishlistGiftDisplayTestHost } =
	await import('./WishlistGiftDisplayTestHost.svelte');
const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

const PAGE_GUTTER = 12;
const CARD_GAP = 8;
const TOUCH_TARGET = 40;
/** A chip jump scrolls smoothly, which a loaded machine can stretch well past the poll default. */
const SMOOTH_SCROLL_TIMEOUT = 5000;

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
	window.scrollTo({ top: 0, behavior: 'instant' });
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
		{ width: 359, fullCards: 1, peek: 0.5 },
		{ width: 360, fullCards: 2, peek: 0.2 },
		{ width: 375, fullCards: 2, peek: 0.2 },
		{ width: 430, fullCards: 2, peek: 0.2 },
		{ width: 539, fullCards: 2, peek: 0.2 },
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

	it.each([
		{ width: 375, faceHeight: 26 },
		{ width: 430, faceHeight: 32 },
	])(
		'fits the compact cancel label on one line beside More at $width px (REQ-6)',
		async ({ width, faceHeight }) => {
			const reservedGift = visitorGift('a', {
				reservedCount: 1,
				isFullyReserved: true,
				myReservationId: 'reservation-a',
			});
			const screen = await renderCarousel(width, {
				sections: [
					{
						kind: GIFT_SECTION_KINDS.ownReservation,
						key: 'own-reservations',
						label: null,
						gifts: [reservedGift, visitorGift('b')],
					},
				],
				hascontextactions: () => true,
				oncontextactions: () => true,
			});
			const card = rows()[0].querySelector<HTMLElement>('[data-gift-card-density]')!;
			const footer = card.querySelector<HTMLElement>('[data-testid="gift-card-footer"]')!;
			const cancel = card.querySelector<HTMLElement>('[data-testid="reserve-button"]')!;
			const label = cancel.querySelector<HTMLElement>(
				'[data-testid="reservation-button-content"]',
			)!;
			const more = card.querySelector<HTMLElement>('[data-testid="gift-more-actions"]')!;
			expect(cancel).toHaveAttribute(
				'aria-label',
				m.reserve_button_cancel_aria({ name: reservedGift.name }),
			);
			expectPixelsNear(cancel.getBoundingClientRect().height, faceHeight);
			expectPixelsAtMost(
				label.getBoundingClientRect().height,
				parseFloat(getComputedStyle(label).lineHeight),
			);
			expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
			expectPixelsAtMost(
				cancel.getBoundingClientRect().right,
				more.getBoundingClientRect().left,
			);
			const footerRect = footer.getBoundingClientRect();
			const footerStyle = getComputedStyle(footer);
			expectPixelsAtLeast(
				cancel.getBoundingClientRect().left,
				footerRect.left + parseFloat(footerStyle.paddingLeft),
			);
			expectPixelsAtMost(
				more.getBoundingClientRect().right,
				footerRect.right - parseFloat(footerStyle.paddingRight),
			);
			expect(label.textContent?.trim()).toBe(m.cancel());
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

	it.each([359, 375, 430])(
		'insets the category badge equally from the top and start of the card at %i px (REQ-6)',
		async (width) => {
			const screen = await renderCarousel(width);
			const card = rows()[0].querySelector<HTMLElement>('[data-gift-card-density]')!;
			const surface = card.querySelector<HTMLElement>('[data-slot="elevation-surface"]')!;
			const badge = card.querySelector<HTMLElement>('[data-testid="gift-category-badge"]')!;
			const surfaceRect = surface.getBoundingClientRect();
			const badgeRect = badge.getBoundingClientRect();
			const topInset = badgeRect.top - (surfaceRect.top + surface.clientTop);
			const startInset = badgeRect.left - (surfaceRect.left + surface.clientLeft);
			expectPixelsAtLeast(startInset, 4);
			expectPixelsNear(topInset, startInset, undefined, 1);
			await screen.unmount();
		},
	);

	it.each([
		{ width: 320, truncatesDomain: false },
		{ width: 359, truncatesDomain: false },
		{ width: 375, truncatesDomain: true },
		{ width: 400, truncatesDomain: true },
		{ width: 430, truncatesDomain: true },
		{ width: 540, truncatesDomain: true },
	])(
		'keeps the square image, a long link domain and the footer inside the card at $width px (REQ-6)',
		async ({ width, truncatesDomain }) => {
			const longDomainGift = visitorGift('a', {
				links: [{ url: 'https://store.steampowered.com/app/1145360/Hades/' }],
			});
			const screen = await renderCarousel(width, {
				sections: [
					{
						kind: GIFT_SECTION_KINDS.available,
						key: 'available',
						label: null,
						gifts: [longDomainGift, visitorGift('b'), visitorGift('c')],
					},
				],
				hascontextactions: () => true,
				oncontextactions: () => true,
			});
			const card = rows()[0].querySelector<HTMLElement>('[data-gift-card-density]')!;
			const surface = card.querySelector<HTMLElement>('[data-slot="elevation-surface"]')!;
			const contentLeft = surface.getBoundingClientRect().left + surface.clientLeft;
			const contentRight = contentLeft + surface.clientWidth;
			const image = card.querySelector<HTMLElement>('[data-testid="gift-card-image-frame"]')!;
			const imageRect = image.getBoundingClientRect();
			expectPixelsNear(imageRect.width, surface.clientWidth);
			expectPixelsNear(
				imageRect.height - parseFloat(getComputedStyle(image).paddingBottom),
				imageRect.width,
			);
			const linkLabel = card.querySelector<HTMLElement>('a[href*="steampowered"] > span')!;
			expect(linkLabel.scrollWidth > linkLabel.clientWidth).toBe(truncatesDomain);
			expect(getComputedStyle(linkLabel).textOverflow).toBe('ellipsis');
			const contained = [
				image,
				card.querySelector<HTMLElement>('[data-testid="gift-card-body"]')!,
				card.querySelector<HTMLElement>('a[href*="steampowered"]')!,
				card.querySelector<HTMLElement>('[data-testid="reserve-button"]')!,
				card.querySelector<HTMLElement>('[data-testid="gift-more-actions"]')!,
			];
			for (const element of contained) {
				const rect = element.getBoundingClientRect();
				expectPixelsAtLeast(rect.left, contentLeft);
				expectPixelsAtMost(rect.right, contentRight);
			}
			await screen.unmount();
		},
	);

	it('shows an ungrouped list as a single row with a count-only header and a descriptive label (REQ-3)', async () => {
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
		expect(rows()[0]).toHaveAttribute(
			'aria-label',
			`${m.gift_carousel_ungrouped_label()}, ${formatGiftCount(3)}`,
		);
		expect(chipBar()).toBeNull();
		await screen.unmount();
	});
});

function chipBar(): HTMLElement | null {
	return document.querySelector<HTMLElement>(`nav[aria-label="${m.gift_carousel_jump_aria()}"]`);
}

function chips(): HTMLAnchorElement[] {
	return Array.from(chipBar()?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
}

function positionOf(groupIndex: number): HTMLElement | null {
	const group = document.querySelectorAll('[data-testid="gift-carousel-group"]')[groupIndex];
	return group.querySelector<HTMLElement>('[data-testid="gift-section-position"]');
}

function categorySection(key: string, label: string, giftIds: string[]): GiftSection {
	return {
		kind: GIFT_SECTION_KINDS.categoryGroup,
		key,
		label,
		gifts: giftIds.map((id) => visitorGift(id)),
	};
}

describe('WishlistGiftCarousel group chip bar (#640)', () => {
	it('hides the chip bar for a single group row', async () => {
		const screen = await renderCarousel(375, {
			sections: [categorySection('category:books', 'Knihy', ['a', 'b', 'c'])],
		});
		expect(rows()).toHaveLength(1);
		expect(chipBar()).toBeNull();
		await screen.unmount();
	});

	it('hides the chip bar when an empty group leaves a single row', async () => {
		const screen = await renderCarousel(375, {
			sections: [
				categorySection('category:books', 'Knihy', ['a', 'b', 'c']),
				categorySection('category:empty', 'Prázdná', []),
			],
		});
		expect(rows()).toHaveLength(1);
		expect(chipBar()).toBeNull();
		await screen.unmount();
	});

	it('shows one in-page chip per row in row order, skipping empty groups', async () => {
		const ownReservation = visitorGift('own', {
			reservedCount: 1,
			isFullyReserved: true,
			myReservationId: 'reservation-own',
		});
		const screen = await renderCarousel(375, {
			sections: [
				{
					kind: GIFT_SECTION_KINDS.ownReservation,
					key: 'own-reservations',
					label: null,
					gifts: [ownReservation],
				},
				categorySection('category:electronics', 'Elektronika', ['a', 'b', 'c', 'd', 'e']),
				categorySection('category:empty', 'Prázdná', []),
				categorySection('category:books', 'Knihy', ['f', 'g']),
				{
					kind: GIFT_SECTION_KINDS.received,
					key: 'received',
					label: null,
					gifts: [visitorGift('r', { received: true })],
				},
			],
		});
		const groups = Array.from(
			document.querySelectorAll<HTMLElement>('[data-testid="gift-carousel-group"]'),
		);
		expect(groups).toHaveLength(4);
		expect(chips().map((chip) => chip.getAttribute('aria-label'))).toEqual([
			`${m.gift_band_own_reservations()}, ${formatGiftCount(1)}`,
			`Elektronika, ${formatGiftCount(5)}`,
			`Knihy, ${formatGiftCount(2)}`,
			`${m.gift_band_received()}, ${formatGiftCount(1)}`,
		]);
		chips().forEach((chip, index) => {
			expect(chip.getAttribute('href')).toBe(`#${groups[index].id}`);
		});
		expect(new Set(groups.map((group) => group.id)).size).toBe(4);
		expect(chipBar()!.querySelectorAll('[aria-current="location"]')).toHaveLength(1);
		expect(chips()[0]).toHaveAttribute('aria-current', 'location');
		expect(groups[2].querySelector('[data-slot="carousel"]')).toHaveAttribute(
			'aria-label',
			`Knihy, ${formatGiftCount(2)}`,
		);
		await screen.unmount();
	});

	it('moves focus to the section heading when a chip is activated', async () => {
		const screen = await renderCarousel(375);
		chips()[1].click();
		const heading = document.activeElement as HTMLElement;
		expect(heading.tagName).toBe('H2');
		expect(heading).toHaveTextContent('Knihy');
		expect(heading).toHaveAttribute('tabindex', '-1');
		expect(window.location.hash).toBe('');
		await screen.unmount();
	});

	it('moves focus to the row of a count-only section', async () => {
		const screen = await renderCarousel(375, {
			sections: [
				{
					kind: GIFT_SECTION_KINDS.available,
					key: 'available',
					label: null,
					gifts: ['a', 'b'].map((id) => visitorGift(id)),
				},
				{
					kind: GIFT_SECTION_KINDS.received,
					key: 'received',
					label: null,
					gifts: [visitorGift('r', { received: true })],
				},
			],
		});
		expect(chips()[0]).toHaveAttribute(
			'aria-label',
			`${m.gift_carousel_ungrouped_label()}, ${formatGiftCount(2)}`,
		);
		chips()[0].click();
		expect(document.activeElement).toBe(rows()[0]);
		await screen.unmount();
	});

	it('marks the chip of the section whose header passed the chip bar, and the last one at the page bottom', async () => {
		const screen = await renderCarousel(375, {
			sections: [
				categorySection('category:one', 'Jedna', ['a', 'b', 'c']),
				categorySection('category:two', 'Dvě', ['d', 'e', 'f']),
				categorySection('category:three', 'Tři', ['g', 'h', 'i']),
				categorySection('category:four', 'Čtyři', ['j']),
			],
		});
		const groups = Array.from(
			document.querySelectorAll<HTMLElement>('[data-testid="gift-carousel-group"]'),
		);
		// Without a sticky toolbar above it, the stuck chip bar's bottom edge is the line.
		const stuckChipBarBottom = chipBar()!.getBoundingClientRect().height;
		window.scrollTo({
			top: groups[1].getBoundingClientRect().top + window.scrollY - stuckChipBarBottom + 4,
			behavior: 'instant',
		});
		await expect.poll(() => chipBar()!.getBoundingClientRect().top).toBe(0);
		await expect.poll(() => chips()[1].getAttribute('aria-current')).toBe('location');
		expect(chipBar()!.querySelectorAll('[aria-current="location"]')).toHaveLength(1);
		window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
		await expect.poll(() => chips()[3].getAttribute('aria-current')).toBe('location');
		await screen.unmount();
	});

	it('aligns a jumped-to section below the chip bar and marks its chip', async () => {
		const screen = await renderCarousel(375, {
			sections: [
				categorySection('category:one', 'Jedna', ['a', 'b', 'c']),
				categorySection('category:two', 'Dvě', ['d', 'e', 'f']),
				categorySection('category:three', 'Tři', ['g', 'h', 'i']),
				categorySection('category:four', 'Čtyři', ['j', 'k', 'l']),
			],
		});
		const target = document.querySelectorAll<HTMLElement>(
			'[data-testid="gift-carousel-group"]',
		)[1];
		chips()[1].click();
		await vi.waitFor(
			() =>
				expectPixelsNear(
					target.getBoundingClientRect().top,
					chipBar()!.getBoundingClientRect().bottom,
				),
			{ timeout: SMOOTH_SCROLL_TIMEOUT },
		);
		await expect
			.poll(() => chips()[1].getAttribute('aria-current'), { timeout: SMOOTH_SCROLL_TIMEOUT })
			.toBe('location');
		await screen.unmount();
	});

	it('scrolls the current chip into view inside the chip bar', async () => {
		const screen = await renderCarousel(320, {
			sections: [
				categorySection('category:one', 'Elektronika a hry', ['a', 'b']),
				categorySection('category:two', 'Knihy a časopisy', ['c', 'd']),
				categorySection('category:three', 'Sport a outdoor', ['e', 'f']),
				categorySection('category:four', 'Domácnost a zahrada', ['g', 'h']),
			],
		});
		const bar = chipBar()!;
		expect(bar.scrollWidth).toBeGreaterThan(bar.clientWidth);
		window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
		await expect.poll(() => chips()[3].getAttribute('aria-current')).toBe('location');
		await expect.poll(() => bar.scrollLeft).toBeGreaterThan(0);
		const barRect = bar.getBoundingClientRect();
		const lastChip = chips()[3].getBoundingClientRect();
		expectPixelsAtLeast(lastChip.left, barRect.left);
		expectPixelsAtMost(lastChip.right, barRect.right);
		await screen.unmount();
	});
});

describe('WishlistGiftCarousel row position (#640)', () => {
	it('shows the visible card range of a row as hidden header text', async () => {
		const screen = await renderCarousel(375);
		const position = positionOf(0)!;
		expect(position).toHaveTextContent('1–2 z 5');
		expect(position).toHaveAttribute('aria-hidden', 'true');
		const header = position.parentElement!;
		expect(header.lastElementChild).toBe(position);
		expect(rows()[0]).toHaveAttribute('aria-label', `Elektronika, ${formatGiftCount(5)}`);
		await screen.unmount();
	});

	it('updates the position as the row scrolls', async () => {
		const screen = await renderCarousel(375);
		const viewport = rows()[0].querySelector<HTMLElement>('[data-slot="carousel-content"]')!;
		viewport.scrollLeft = viewport.scrollWidth;
		await expect
			.poll(() => positionOf(0)?.textContent?.trim())
			.toBe(m.gift_carousel_position({ first: 4, last: 5, total: 5 }));
		await screen.unmount();
	});

	it('omits the position when every card of the row fits', async () => {
		const screen = await renderCarousel(375);
		expect(positionOf(1)).toBeNull();
		await screen.unmount();
	});
});
