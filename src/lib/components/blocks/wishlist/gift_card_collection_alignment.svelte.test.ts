import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import {
	createPixelAssertions,
	DEFAULT_PIXEL_TOLERANCE,
} from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { ComponentProps } from 'svelte';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: WishlistGiftDisplay } = await import('./WishlistGiftDisplay.svelte');
const { default: WishlistGiftDisplayTestHost } =
	await import('./WishlistGiftDisplayTestHost.svelte');
const { IMAGE_URL, imageMeta } = await import('../gift/gift_card.test_fixtures.js');
const { expectPixelsNear, expectPixelsAtMost } = createPixelAssertions(expect);

function gift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
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
		...overrides,
	};
}

const defaultProps: ComponentProps<typeof WishlistGiftDisplay> = {
	sections: [],
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

function trackRects(track: string): DOMRect[] {
	return Array.from(
		document.querySelectorAll<HTMLElement>(`[data-gift-card-track="${track}"]`),
	).map((element) => element.getBoundingClientRect());
}

async function nextLayout(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

describe('GiftCard collection alignment', () => {
	it('measures categorized recipient cards without a Like control', async () => {
		await page.viewport(900, 900);
		const categorized = gift({
			category: {
				id: 'books',
				presetKey: null,
				customLabel: 'Knihy',
				color: '#0369A1',
				sortOrder: 0,
			},
		});
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			hideReservationState: true,
			sections: [
				{
					kind: GIFT_SECTION_KINDS.available,
					key: 'available',
					label: null,
					gifts: [categorized, gift({ id: 'peer' })],
				},
			],
		});
		await expect
			.poll(() => document.querySelector('[data-gift-card-tracks-aligned="true"]'))
			.not.toBeNull();
		expect(document.querySelector('[data-like-heart]')).toBeNull();
		await screen.unmount();
	});
	it('aligns title, description, link, price, and final action tracks across desktop groups', async () => {
		await page.viewport(1100, 1200);
		const sections: GiftSection[] = [
			{
				kind: GIFT_SECTION_KINDS.categoryGroup,
				key: 'category-lighting',
				label: 'Osvětlení',
				priorityKey: null,
				gifts: [
					gift({
						id: 'short',
						links: [{ url: 'https://example.com/lampa', label: 'Lampa' }],
						price: 1200,
						currency: 'CZK',
					}),
				],
			},
			{
				kind: GIFT_SECTION_KINDS.categoryGroup,
				key: 'category-books',
				label: 'Knihy',
				priorityKey: null,
				gifts: [
					gift({
						id: 'long',
						name: 'Mimořádně dlouhý název dárku, který potřebuje druhý řádek',
						description: 'Popis zůstává na desktopu v jednom viditelném řádku.',
						links: Array.from({ length: 3 }, (_, index) => ({
							url: `https://example.com/${index}`,
							label: `Delší odkaz ${index}`,
						})),
						price: 9999,
						currency: 'CZK',
					}),
				],
			},
		];
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections,
			hascontextactions: () => true,
			oncontextactions: () => true,
		});
		await nextLayout();

		for (const track of ['title', 'description', 'links', 'price', 'actions']) {
			const rects = trackRects(track);
			expect(rects).toHaveLength(2);
			expectPixelsNear(rects[1]!.height, rects[0]!.height);
		}
		const cards = Array.from(
			document.querySelectorAll<HTMLElement>('[data-testid="gift-card-surface"]'),
		);
		const firstOffsets = ['title', 'description', 'links', 'price', 'actions'].map(
			(track) =>
				cards[0]!
					.querySelector<HTMLElement>(`[data-gift-card-track="${track}"]`)!
					.getBoundingClientRect().top - cards[0]!.getBoundingClientRect().top,
		);
		const secondOffsets = ['title', 'description', 'links', 'price', 'actions'].map(
			(track) =>
				cards[1]!
					.querySelector<HTMLElement>(`[data-gift-card-track="${track}"]`)!
					.getBoundingClientRect().top - cards[1]!.getBoundingClientRect().top,
		);
		for (const [index, offset] of secondOffsets.entries()) {
			expectPixelsNear(offset, firstOffsets[index]!);
		}
		expect(getComputedStyle(cards[0]!.querySelector('h3')!).fontSize).toBe('24px');
		expect(cards[0]!.querySelector('[data-testid="gift-card-footer"]')).toBeTruthy();
		expect(
			getComputedStyle(cards[0]!.querySelector('[data-testid="gift-card-footer"]')!)
				.borderTopWidth,
		).toBe('0px');
		await screen.unmount();
	});

	it('clamps desktop titles to two painted lines and descriptions to one', async () => {
		await page.viewport(960, 900);
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [
				{
					kind: GIFT_SECTION_KINDS.available,
					key: 'available',
					label: null,
					gifts: [
						gift({
							id: 'long',
							name: 'Mimořádně dlouhý název dárku, který vyžaduje přesně dva viditelné řádky a další text skryje',
							description:
								'Dlouhý popis dárku se na desktopové kartě zobrazí pouze jako jednořádkový náhled bez roztažení sdílené stopy.',
						}),
						gift({ id: 'short' }),
					],
				},
			],
		});
		await nextLayout();

		const title = document.querySelector<HTMLElement>('[data-gift-id="long"] h3')!;
		const description = document.querySelector<HTMLElement>(
			'[data-gift-id="long"] [data-gift-card-track="description"]',
		)!;
		const titleLineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
		const descriptionParagraph = description.querySelector<HTMLElement>('p')!;
		const descriptionLineHeight = Number.parseFloat(
			getComputedStyle(descriptionParagraph).lineHeight,
		);
		expect(getComputedStyle(title).fontSize).toBe('24px');
		expect(title.getBoundingClientRect().height).toBeGreaterThan(titleLineHeight);
		expectPixelsAtMost(title.getBoundingClientRect().height, titleLineHeight * 2);
		expectPixelsAtMost(description.getBoundingClientRect().height, descriptionLineHeight + 2);
		expect(getComputedStyle(descriptionParagraph).webkitLineClamp).toBe('1');
		await screen.unmount();
	});

	it('keeps the latest description preview noninteractive and within two lines at 200% text', async () => {
		await page.viewport(390, 1000);
		const previousFontSize = document.documentElement.style.fontSize;
		document.documentElement.style.fontSize = '32px';
		try {
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [
					{
						kind: GIFT_SECTION_KINDS.available,
						key: 'available',
						label: null,
						gifts: [
							gift({
								id: 'appended',
								description: 'Původní popis',
								descriptionAppends: [
									{
										text: 'Starší doplnění',
										addedAt: '2026-01-02T00:00:00.000Z',
									},
									{
										text: 'Nejnovější velmi dlouhé doplnění zůstává čitelné pouze ve dvou viditelných řádcích.',
										addedAt: '2026-01-03T00:00:00.000Z',
									},
								],
							}),
							gift({ id: 'peer' }),
						],
					},
				],
			});
			await nextLayout();

			const track = document.querySelector<HTMLElement>(
				'[data-gift-id="appended"] [data-gift-card-track="description"]',
			)!;
			const preview = track.querySelector<HTMLElement>('p')!;
			const lineHeight = Number.parseFloat(getComputedStyle(preview).lineHeight);
			expect(preview.textContent).toContain('Nejnovější velmi dlouhé doplnění');
			expect(preview.textContent).not.toContain('Původní popis');
			expect(track.querySelector('button')).toBeNull();
			expectPixelsAtMost(preview.getBoundingClientRect().height, lineHeight * 2);
			await screen.unmount();
		} finally {
			document.documentElement.style.fontSize = previousFontSize;
		}
	});

	it('keeps one-column mobile cards natural and shares visible tracks in two columns', async () => {
		const mobileSections: GiftSection[] = [
			{
				kind: GIFT_SECTION_KINDS.available,
				key: 'available',
				label: null,
				gifts: [
					gift({ id: 'short' }),
					gift({
						id: 'long',
						name: 'Mimořádně dlouhý název dárku pro ověření dvou řádků',
						description: 'Dlouhý popis zůstane viditelný nejvýše ve dvou řádcích.',
						links: [{ url: 'https://example.com/long', label: 'Dlouhý odkaz' }],
					}),
				],
			},
		];
		await page.viewport(320, 1000);
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: mobileSections,
		});
		await nextLayout();
		let cards = Array.from(
			document.querySelectorAll<HTMLElement>('[data-testid="gift-card-surface"]'),
		);
		expect(document.querySelector('[data-gift-card-tracks-aligned="true"]')).toBeNull();
		expect(cards[0]!.getBoundingClientRect().height).toBeLessThan(
			cards[1]!.getBoundingClientRect().height,
		);

		await page.viewport(600, 1000);
		await nextLayout();
		cards = Array.from(
			document.querySelectorAll<HTMLElement>('[data-testid="gift-card-surface"]'),
		);
		for (const track of ['title', 'description', 'links', 'price', 'actions']) {
			const rects = trackRects(track);
			expectPixelsNear(rects[1]!.height, rects[0]!.height);
		}
		const title = cards[1]!.querySelector<HTMLElement>('h3')!;
		const description = cards[1]!.querySelector<HTMLElement>(
			'[data-gift-card-track="description"]',
		)!;
		expect(getComputedStyle(title).fontSize).toBe('16px');
		expectPixelsAtMost(
			title.getBoundingClientRect().height,
			Number.parseFloat(getComputedStyle(title).lineHeight) * 2,
		);
		expectPixelsAtMost(description.getBoundingClientRect().height, 42);
		await screen.unmount();
	});

	it('expands crowded two-column image zones around an unchanged 4:3 crop and shrinks again', async () => {
		await page.viewport(600, 1200);
		const previousFontSize = document.documentElement.style.fontSize;
		document.documentElement.style.fontSize = '32px';
		const crowded = gift({
			id: 'crowded',
			imageUrl: IMAGE_URL,
			imageMeta: imageMeta('#ffffff'),
			categoryId: 'category-crowded',
			category: {
				id: 'category-crowded',
				presetKey: null,
				customLabel: 'Mimořádně dlouhá kategorie sportovního vybavení',
				color: '#0369A1',
				sortOrder: 0,
			},
			priorityLabel: 'Vysoka',
			reservedCount: 1,
			isFullyReserved: true,
			reserverNames: ['Alexandra s velmi dlouhým jménem'],
		});
		const section = (items: GiftForVisitor[]): GiftSection[] => [
			{
				kind: GIFT_SECTION_KINDS.available,
				key: 'available',
				label: null,
				gifts: items,
			},
		];
		try {
			const screen = await render(WishlistGiftDisplayTestHost, {
				...defaultProps,
				role: WISHLIST_ROLES.moderator,
				hideReservationState: false,
				sections: section([
					crowded,
					gift({ id: 'peer', imageUrl: IMAGE_URL, imageMeta: imageMeta('#ffffff') }),
				]),
			});
			await expect
				.poll(() => {
					const images = Array.from(
						document.querySelectorAll<HTMLImageElement>(
							'[data-gift-item] [data-testid="gift-card-crop-composition"] img',
						),
					);
					return (
						images.length === 2 &&
						images.every((image) => image.complete && image.naturalWidth > 0)
					);
				})
				.toBe(true);
			await nextLayout();

			const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
			expectPixelsNear(
				cards[1]!.getBoundingClientRect().top,
				cards[0]!.getBoundingClientRect().top,
			);
			const crowdedImage = cards[0]!.querySelector<HTMLElement>(
				'[data-testid="gift-card-image-frame"]',
			)!;
			const peerImage = cards[1]!.querySelector<HTMLElement>(
				'[data-testid="gift-card-image-frame"]',
			)!;
			const imageRect = crowdedImage.getBoundingClientRect();
			const boxes = [
				cards[0]!.querySelector<HTMLElement>('[data-testid="gift-category-badge"]')!,
				cards[0]!.querySelector<HTMLElement>('[data-like-heart]')!.closest('button')!,
				cards[0]!.querySelector<HTMLElement>('[data-testid="gift-state-overlay"]')!
					.firstElementChild as HTMLElement,
				cards[0]!.querySelector<HTMLElement>('[data-reserver-identity]')!,
				cards[0]!.querySelector<HTMLElement>('[data-testid="gift-priority-badge"]')!,
			].map((element) => element.getBoundingClientRect());

			expect(imageRect.height).toBeGreaterThan(imageRect.width * 0.75);
			expectPixelsNear(peerImage.getBoundingClientRect().height, imageRect.height);
			for (const frame of [crowdedImage, peerImage]) {
				const frameRect = frame.getBoundingClientRect();
				const frameStyle = getComputedStyle(frame);
				const contentTop = frameRect.top + Number.parseFloat(frameStyle.borderTopWidth);
				const contentBottom =
					frame
						.querySelector<HTMLElement>('[data-testid="gift-card-image-separator"]')!
						.getBoundingClientRect().top + 1;
				const contentLeft = frameRect.left + Number.parseFloat(frameStyle.borderLeftWidth);
				const contentRight =
					frameRect.right - Number.parseFloat(frameStyle.borderRightWidth);
				const cropRect = frame
					.querySelector<HTMLElement>('[data-testid="gift-card-crop-composition"]')!
					.getBoundingClientRect();
				expect(frameStyle.backgroundColor).toBe('rgb(255, 255, 255)');
				expect(cropRect.width / cropRect.height).toBeCloseTo(4 / 3, 2);
				expect(cropRect.width - (contentRight - contentLeft)).toBeGreaterThan(0);
				expect(cropRect.width - (contentRight - contentLeft)).toBeLessThanOrEqual(3);
				expectPixelsNear(
					cropRect.left + cropRect.width / 2,
					(contentLeft + contentRight) / 2,
				);
				expectPixelsNear(
					cropRect.top + cropRect.height / 2,
					(contentTop + contentBottom) / 2,
				);
				expect(cropRect.top - contentTop).toBeGreaterThan(0);
				expect(contentBottom - cropRect.bottom).toBeGreaterThan(0);
			}
			for (let first = 0; first < boxes.length; first += 1) {
				for (let second = first + 1; second < boxes.length; second += 1) {
					const a = boxes[first]!;
					const b = boxes[second]!;
					const separatedOnAnAxis =
						a.right <= b.left + DEFAULT_PIXEL_TOLERANCE ||
						b.right <= a.left + DEFAULT_PIXEL_TOLERANCE ||
						a.bottom <= b.top + DEFAULT_PIXEL_TOLERANCE ||
						b.bottom <= a.top + DEFAULT_PIXEL_TOLERANCE;
					expect(
						separatedOnAnAxis,
						`overlay boxes ${first} and ${second} overlap: ${JSON.stringify(a.toJSON())} / ${JSON.stringify(b.toJSON())}`,
					).toBe(true);
				}
			}

			await page.viewport(1200, 1200);
			const collection = document.querySelector<HTMLElement>(
				'[data-wishlist-gift-collection]',
			)!;
			collection.style.width = '1000px';
			collection.querySelector<HTMLElement>(
				'[data-testid="wishlist-gift-card-grid"]',
			)!.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
			await nextLayout();
			expect(
				crowdedImage.clientWidth /
					(crowdedImage.clientHeight -
						Number.parseFloat(getComputedStyle(crowdedImage).paddingBottom)),
			).toBeCloseTo(4 / 3, 2);

			await screen.rerender({
				...defaultProps,
				role: WISHLIST_ROLES.recipient,
				hideReservationState: true,
				sections: section([gift({ id: 'short-1' }), gift({ id: 'short-2' })]),
			});
			await nextLayout();
			const restoredImage = document.querySelector<HTMLElement>(
				'[data-testid="gift-card-image-frame"]',
			)!;
			expect(
				restoredImage.clientWidth /
					(restoredImage.clientHeight -
						Number.parseFloat(getComputedStyle(restoredImage).paddingBottom)),
			).toBeCloseTo(4 / 3, 2);
			await screen.unmount();
		} finally {
			document.documentElement.style.fontSize = previousFontSize;
		}
	});

	it('remeasures from intrinsic visible content so returning to short content shrinks the collection', async () => {
		await page.viewport(900, 1000);
		const longGift = gift({
			id: 'long',
			name: 'Mimořádně dlouhý název dárku, který vyžaduje druhý řádek',
			description: 'Jednořádkový náhled popisu.',
			links: Array.from({ length: 3 }, (_, index) => ({
				url: `https://example.com/${index}`,
				label: `Odkaz ${index}`,
			})),
		});
		const section = (items: GiftForVisitor[]): GiftSection[] => [
			{
				kind: GIFT_SECTION_KINDS.available,
				key: 'available',
				label: null,
				gifts: items,
			},
		];
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: section([longGift, gift({ id: 'peer' })]),
		});
		await nextLayout();
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;
		const longHeight = collection.getBoundingClientRect().height;

		const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			'scrollHeight',
		);
		Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
			configurable: true,
			get: () => {
				throw new Error('collection alignment must measure the visible box');
			},
		});
		try {
			await screen.rerender({
				...defaultProps,
				sections: section([gift({ id: 'short-1' }), gift({ id: 'short-2' })]),
			});
			await nextLayout();
			expect(collection.getBoundingClientRect().height).toBeLessThan(longHeight);
			expectPixelsNear(
				collection
					.querySelector<HTMLElement>('[data-gift-card-track="description"]')!
					.getBoundingClientRect().height,
				0,
			);
		} finally {
			if (scrollHeightDescriptor === undefined) {
				Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
			} else {
				Object.defineProperty(
					HTMLElement.prototype,
					'scrollHeight',
					scrollHeightDescriptor,
				);
			}
		}
		await screen.unmount();
	});
});
