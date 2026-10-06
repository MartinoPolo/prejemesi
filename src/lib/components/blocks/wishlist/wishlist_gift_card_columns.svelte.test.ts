import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { ComponentProps } from 'svelte';
import { GIFT_CARD_COLUMN_OPTIONS, type GiftForVisitor } from '$lib/modules/gifts/types.js';
import { GIFT_SECTION_KINDS } from '$lib/modules/gifts/gift_ordering.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import {
	giftCardChosenColumnCount,
	isGiftCardColumnOptionAvailable,
} from './gift_card_grid_columns.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: WishlistGiftDisplayTestHost } =
	await import('./WishlistGiftDisplayTestHost.svelte');
const {
	IMAGE_URL,
	REALISTIC_LONG_NAME,
	expectRaisedActionShadowInside,
	expectRectanglesSeparated,
	imageMeta,
} = await import('../gift/gift_card.test_fixtures.js');
const { MORE_ACTION_SELECTOR, expectRightAlignedAdjacentActions, visibleAction, visibleActions } =
	await import('../gift/gift_action_geometry.test_fixtures.js');
const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

/** Desktop wishlist content container: 1200px max width minus two 16px page gutters. */
const WIDE_DESKTOP_COLLECTION_WIDTH = 1168;
/** 13.5rem at the default 16px root font size. */
const MINIMUM_CARD_WIDTH = 216;

function gift(index: number, overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: `gift-${index}`,
		wishlistId: 'wishlist-1',
		name: `Dárek ${index}`,
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
		sortOrder: index,
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
		...overrides,
	};
}

function displayProps(
	gifts: GiftForVisitor[],
	overrides: Partial<ComponentProps<typeof WishlistGiftDisplayTestHost>> = {},
): ComponentProps<typeof WishlistGiftDisplayTestHost> {
	return {
		sections: [{ kind: GIFT_SECTION_KINDS.available, key: 'available', label: null, gifts }],
		role: WISHLIST_ROLES.visitor,
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
		oncontextactions: () => true,
		hascontextactions: () => true,
		...overrides,
	};
}

async function nextLayout(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

function collection(): HTMLElement {
	return document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;
}

function renderedColumnWidths(): number[] {
	const grid = collection().querySelector<HTMLElement>(
		'[data-testid="wishlist-gift-card-grid"]',
	)!;
	return getComputedStyle(grid).gridTemplateColumns.split(' ').map(Number.parseFloat);
}

function cardsInFirstRow(): number {
	const tops = Array.from(
		collection().querySelectorAll<HTMLElement>('[data-gift-item]'),
		(item) => item.offsetTop,
	);
	return tops.filter((top) => top === tops[0]).length;
}

afterEach(() => {
	delete document.documentElement.dataset.depth;
	overwriteGetLocale(() => 'cs');
});

describe('WishlistGiftDisplay card column choice', () => {
	it.each([
		{ collectionWidth: WIDE_DESKTOP_COLLECTION_WIDTH, automatic: 3, four: 4, five: 5 },
		{ collectionWidth: 1000, automatic: 3, four: 4, five: 4 },
		{ collectionWidth: 700, automatic: 2, four: 3, five: 3 },
	])(
		'renders the chosen count or the largest fitting fallback at $collectionWidth px',
		async ({ collectionWidth, ...expectedColumns }) => {
			await page.viewport(1280, 900);
			const gifts = Array.from({ length: 10 }, (_, index) => gift(index + 1));
			const screen = await render(WishlistGiftDisplayTestHost, displayProps(gifts));
			collection().style.width = `${collectionWidth}px`;

			for (const option of Object.values(GIFT_CARD_COLUMN_OPTIONS)) {
				await screen.rerender({ cardColumnOption: option });
				const columnWidths = renderedColumnWidths();
				expect(columnWidths, option).toHaveLength(expectedColumns[option]);
				expect(cardsInFirstRow(), option).toBe(expectedColumns[option]);
				if (option !== GIFT_CARD_COLUMN_OPTIONS.automatic) {
					for (const columnWidth of columnWidths) {
						expectPixelsAtLeast(columnWidth, MINIMUM_CARD_WIDTH);
					}
				}
			}
			await screen.unmount();
		},
	);

	it('keeps the responsive mobile layout below the desktop breakpoint', async () => {
		await page.viewport(600, 900);
		const gifts = Array.from({ length: 4 }, (_, index) => gift(index + 1));
		const screen = await render(
			WishlistGiftDisplayTestHost,
			displayProps(gifts, { cardColumnOption: GIFT_CARD_COLUMN_OPTIONS.five }),
		);
		const chosenColumns = renderedColumnWidths();
		await screen.rerender({ cardColumnOption: GIFT_CARD_COLUMN_OPTIONS.automatic });
		expect(chosenColumns).toEqual(renderedColumnWidths());
		await screen.unmount();
	});

	it('reports the largest fitting column count as the collection width changes', async () => {
		await page.viewport(1280, 900);
		const oncardcolumncapacitychange = vi.fn();
		const gifts = Array.from({ length: 3 }, (_, index) => gift(index + 1));
		const screen = await render(
			WishlistGiftDisplayTestHost,
			displayProps(gifts, { oncardcolumncapacitychange }),
		);
		for (const { collectionWidth, capacity } of [
			{ collectionWidth: WIDE_DESKTOP_COLLECTION_WIDTH, capacity: 5 },
			{ collectionWidth: 1000, capacity: 4 },
			{ collectionWidth: 700, capacity: 3 },
		]) {
			collection().style.width = `${collectionWidth}px`;
			await expect.poll(() => oncardcolumncapacitychange.mock.lastCall?.[0]).toBe(capacity);
		}

		await screen.rerender({ viewMode: 'list' });
		await expect.poll(() => oncardcolumncapacitychange.mock.lastCall?.[0]).toBeNull();
		await screen.unmount();
	});

	it.each([
		{ collectionWidth: 1160, capacity: 5, five: 5, four: 4 },
		{ collectionWidth: 1159.6, capacity: 4, five: 4, four: 4 },
		{ collectionWidth: 924, capacity: 4, five: 4, four: 4 },
		{ collectionWidth: 923.6, capacity: 3, five: 3, four: 3 },
	])(
		'reports the capacity the grid renders at a fractional $collectionWidth px boundary',
		async ({ collectionWidth, capacity, ...expectedColumns }) => {
			await page.viewport(1280, 900);
			const oncardcolumncapacitychange = vi.fn();
			const gifts = Array.from({ length: 10 }, (_, index) => gift(index + 1));
			const screen = await render(
				WishlistGiftDisplayTestHost,
				displayProps(gifts, { oncardcolumncapacitychange }),
			);
			collection().style.width = `${collectionWidth}px`;
			await expect.poll(() => oncardcolumncapacitychange.mock.lastCall?.[0]).toBe(capacity);

			for (const option of [GIFT_CARD_COLUMN_OPTIONS.five, GIFT_CARD_COLUMN_OPTIONS.four]) {
				await screen.rerender({ cardColumnOption: option });
				await nextLayout();
				const renderedColumnCount = renderedColumnWidths().length;
				expect(renderedColumnCount, option).toBe(expectedColumns[option]);
				expect(cardsInFirstRow(), option).toBe(expectedColumns[option]);
				expect(renderedColumnCount, option).toBe(
					isGiftCardColumnOptionAvailable(option, capacity)
						? giftCardChosenColumnCount(option)
						: capacity,
				);
			}
			await screen.unmount();
		},
	);

	it('keeps rich card content clamped, separated and inside the narrowest five-column cards', async () => {
		await page.viewport(1280, 900);
		const richGift = (index: number, overrides: Partial<GiftForVisitor> = {}) =>
			gift(index, {
				name: REALISTIC_LONG_NAME,
				description:
					'Ideálně v tmavě modré barvě a velikosti M, s kapucí a kapsou na zip. Případně poslouží jakákoli podobná varianta z udržitelné bavlny.',
				links: [{ url: 'https://example.com/obchod', label: 'Obchod s dlouhým názvem' }],
				price: 12990,
				priceMax: 15990,
				currency: 'CZK',
				imageUrl: IMAGE_URL,
				imageMeta: imageMeta('#ffffff'),
				categoryId: 'category-sport',
				category: {
					id: 'category-sport',
					presetKey: null,
					customLabel: 'Sportovní vybavení a oblečení',
					color: '#0369A1',
					sortOrder: 0,
				},
				priorityLabel: 'Vysoka',
				...overrides,
			});
		const gifts = [
			richGift(1, { myReservationId: 'mine', reservedCount: 1, isFullyReserved: true }),
			richGift(2, {
				reservedCount: 1,
				isFullyReserved: true,
				reserverNames: ['Alexandra Nováková'],
			}),
			richGift(3, { quantity: 3, reservedCount: 1 }),
			richGift(4, {
				myReservationId: 'mine',
				myReservationPurchasedAt: new Date('2026-02-01T00:00:00Z'),
				reservedCount: 1,
				isFullyReserved: true,
			}),
			richGift(5, { quantity: 2, reservedCount: 1 }),
		];
		const screen = await render(
			WishlistGiftDisplayTestHost,
			displayProps(gifts, { cardColumnOption: GIFT_CARD_COLUMN_OPTIONS.five }),
		);
		collection().style.width = `${WIDE_DESKTOP_COLLECTION_WIDTH}px`;
		await document.fonts.ready;
		await expect.poll(() => collection().dataset.giftCardTracksAligned).toBe('true');
		await nextLayout();
		await nextLayout();
		expect(renderedColumnWidths()).toHaveLength(5);
		expect(cardsInFirstRow()).toBe(5);

		const paintedLineCount = (element: HTMLElement) =>
			Math.round(
				element.getBoundingClientRect().height /
					Number.parseFloat(getComputedStyle(element).lineHeight),
			);
		const expectInside = (inner: DOMRect, outer: DOMRect, message: string) => {
			expectPixelsAtLeast(inner.left, outer.left, message);
			expectPixelsAtLeast(inner.top, outer.top, message);
			expectPixelsAtMost(inner.right, outer.right, message);
			expectPixelsAtMost(inner.bottom, outer.bottom, message);
		};

		const surfaces = collection().querySelectorAll<HTMLElement>('.gift-card-painted-surface');
		expect(surfaces).toHaveLength(gifts.length);
		for (const [cardIndex, surface] of surfaces.entries()) {
			const card = `card ${cardIndex + 1}`;
			const surfaceRect = surface.getBoundingClientRect();

			const title = surface.querySelector<HTMLElement>('h3')!;
			expect(title.scrollHeight, `${card} title is clamped`).toBeGreaterThan(
				title.clientHeight,
			);
			expect(paintedLineCount(title), `${card} title lines`).toBeLessThanOrEqual(2);
			const description = surface.querySelector<HTMLElement>(
				'[data-testid="gift-card-description-stack"] p',
			)!;
			expect(description.scrollHeight, `${card} description is clamped`).toBeGreaterThan(
				description.clientHeight,
			);
			expect(paintedLineCount(description), `${card} description lines`).toBe(1);

			const labelledRects = [
				['category', '[data-testid="gift-category-badge"]'],
				['priority', '[data-testid="gift-priority-badge"]'],
				['state', '[data-testid="gift-state-overlay"] > span'],
				['price', '[data-testid="gift-card-price"] > span'],
			].flatMap(([label, selector]) => {
				const elements = surface.querySelectorAll<HTMLElement>(selector!);
				expect(elements.length, `${card} ${label}`).toBeGreaterThan(0);
				return Array.from(elements, (element) => ({
					label: `${card} ${label}`,
					rect: element.getBoundingClientRect(),
				}));
			});
			for (const [index, { label, rect }] of labelledRects.entries()) {
				expectInside(rect, surfaceRect, `${label} inside the card`);
				for (const other of labelledRects.slice(index + 1)) {
					expectRectanglesSeparated(rect, other.rect, `${label} clear of ${other.label}`);
				}
			}

			const row = surface.querySelector<HTMLElement>('[data-testid="gift-action-row"]')!;
			const actionContentRect = surface
				.querySelector<HTMLElement>('[data-testid="gift-card-reservation-actions"]')!
				.getBoundingClientRect();
			const actions = visibleActions(row);
			expectRightAlignedAdjacentActions(row, actions, actionContentRect.right);
			for (const action of actions) {
				expectInside(
					action.getBoundingClientRect(),
					surfaceRect,
					`${card} action inside the card`,
				);
			}
		}
		await screen.unmount();
	});

	it('re-measures shared image heights when the chosen count narrows the cards', async () => {
		await page.viewport(1280, 900);
		const gifts = Array.from({ length: 5 }, (_, index) => gift(index + 1));
		const screen = await render(WishlistGiftDisplayTestHost, displayProps(gifts));
		collection().style.width = `${WIDE_DESKTOP_COLLECTION_WIDTH}px`;
		const imageFrame = () =>
			collection().querySelector<HTMLElement>('[data-testid="gift-card-image-frame"]')!;
		const expectNaturalImageHeight = () => {
			const frame = imageFrame();
			const style = getComputedStyle(frame);
			const contentWidth =
				frame.offsetWidth -
				Number.parseFloat(style.borderLeftWidth) -
				Number.parseFloat(style.borderRightWidth);
			expectPixelsNear(Number.parseFloat(style.height), contentWidth * 0.75, undefined, 1);
		};
		await expect.poll(() => collection().dataset.giftCardTracksAligned).toBe('true');
		await nextLayout();
		expectNaturalImageHeight();

		await screen.rerender({ cardColumnOption: GIFT_CARD_COLUMN_OPTIONS.five });
		await nextLayout();
		await nextLayout();
		expect(cardsInFirstRow()).toBe(5);
		expectNaturalImageHeight();
		await screen.unmount();
	});

	it.each<{ role: WishlistRole; gifts: GiftForVisitor[] }>([
		{
			role: WISHLIST_ROLES.visitor,
			gifts: [
				gift(1),
				gift(2, { myReservationId: 'mine', reservedCount: 1, isFullyReserved: true }),
				gift(3),
				gift(4, { myReservationId: 'mine', reservedCount: 1, isFullyReserved: true }),
				gift(5),
			],
		},
		{
			role: WISHLIST_ROLES.recipient,
			gifts: [gift(1), gift(2, { received: true }), gift(3), gift(4), gift(5)],
		},
		{
			role: WISHLIST_ROLES.moderator,
			gifts: [
				gift(1),
				gift(2, { reservedCount: 1, isFullyReserved: true, received: true }),
				gift(3, { myReservationId: 'mine', reservedCount: 1, isFullyReserved: true }),
				gift(4),
				gift(5),
			],
		},
	])(
		'keeps $role actions visible on one line in five English columns with Ink depth',
		async ({ role, gifts }) => {
			overwriteGetLocale(() => 'en');
			document.documentElement.dataset.depth = 'ink';
			await page.viewport(1280, 900);
			const screen = await render(
				WishlistGiftDisplayTestHost,
				displayProps(gifts, { role, cardColumnOption: GIFT_CARD_COLUMN_OPTIONS.five }),
			);
			collection().style.width = `${WIDE_DESKTOP_COLLECTION_WIDTH}px`;
			await document.fonts.ready;
			await expect.poll(() => collection().dataset.giftCardTracksAligned).toBe('true');
			await nextLayout();
			expect(cardsInFirstRow()).toBe(5);

			for (const surface of collection().querySelectorAll<HTMLElement>(
				'.gift-card-painted-surface',
			)) {
				const row = surface.querySelector<HTMLElement>('[data-testid="gift-action-row"]')!;
				const footerContentRect = surface
					.querySelector<HTMLElement>('[data-testid="gift-card-reservation-actions"]')!
					.getBoundingClientRect();
				const primary = visibleAction(
					row,
					'[data-testid="reserve-button"], [data-testid="gift-received-toggle"]',
				);
				const more = visibleAction(row, MORE_ACTION_SELECTOR);
				const primaryRect = primary.getBoundingClientRect();
				expectPixelsNear(primaryRect.top, more.getBoundingClientRect().top);
				expectPixelsAtLeast(primaryRect.left, footerContentRect.left);
				expectRaisedActionShadowInside(more, surface);
			}
			await screen.unmount();
		},
	);

	it('widens the page so chosen-count cards keep the Automatic card width', async () => {
		await page.viewport(2400, 900);
		const gifts = Array.from({ length: 10 }, (_, index) => gift(index + 1));
		const screen = await render(WishlistGiftDisplayTestHost, displayProps(gifts));
		const pageContent = screen.container;
		Object.assign(pageContent.style, {
			maxWidth: 'var(--content-max-width)',
			marginInline: 'auto',
			paddingInline: 'var(--page-gutter)',
		});
		const pageWidth = () => pageContent.getBoundingClientRect().width;
		const defaultPageWidth = pageWidth();
		const [automaticCardWidth] = renderedColumnWidths();
		expect(renderedColumnWidths()).toHaveLength(3);

		for (const option of [GIFT_CARD_COLUMN_OPTIONS.four, GIFT_CARD_COLUMN_OPTIONS.five]) {
			await screen.rerender({ cardColumnOption: option });
			await nextLayout();
			const columnWidths = renderedColumnWidths();
			expect(columnWidths, option).toHaveLength(giftCardChosenColumnCount(option)!);
			for (const columnWidth of columnWidths) {
				expectPixelsNear(columnWidth, automaticCardWidth!, option, 1);
			}
		}

		await page.viewport(1440, 900);
		await nextLayout();
		const availableWidth = pageContent.parentElement!.clientWidth;
		expect(pageWidth(), 'the viewport caps the widened page').toBe(availableWidth);
		expect(renderedColumnWidths()).toHaveLength(5);

		await screen.rerender({ viewMode: 'list' });
		await expect.poll(pageWidth).toBe(defaultPageWidth);
		await screen.rerender({ viewMode: 'card' });
		await expect.poll(pageWidth).toBe(availableWidth);
		await screen.unmount();
		expect(
			document.documentElement.style.getPropertyValue('--gift-card-chosen-column-count'),
		).toBe('');
	});
});
