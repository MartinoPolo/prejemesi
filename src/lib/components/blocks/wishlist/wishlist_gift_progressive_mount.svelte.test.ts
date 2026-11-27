import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { GIFT_COLLECTION_MOUNTING_ATTRIBUTE } from './gift_card_collection_layout.js';
import { toGiftDisplayRows } from './gift_section_rows.js';
import { leadingGiftRows } from './progressive_gift_rows.svelte.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: WishlistGiftDisplayTestHost } =
	await import('./WishlistGiftDisplayTestHost.svelte');

const GIFT_COUNT = 40;
const MOUNT_TIMEOUT = { timeout: 10_000 };

function visitorGift(index: number): GiftForVisitor {
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
		images: [],
		quantity: 1,
		sortOrder: index,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		categoryIds: [],
		categories: [],
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		myReservationQuantity: 0,
		myReservationOnLinkedCopy: false,
		reservedOnLinkedCopiesCount: 0,
		linkedCopies: [],
	};
}

const giftIds = Array.from({ length: GIFT_COUNT }, (_, index) => `gift-${index}`);

const props: ComponentProps<typeof WishlistGiftDisplayTestHost> = {
	sections: [
		{
			kind: GIFT_SECTION_KINDS.available,
			key: 'available',
			label: null,
			gifts: Array.from({ length: GIFT_COUNT }, (_, index) => visitorGift(index)),
		} satisfies GiftSection,
	],
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
};

function mountedGiftIds(): string[] {
	return Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'), (item) =>
		item.getAttribute('data-gift-id'),
	).filter((id): id is string => id !== null);
}

describe('WishlistGiftDisplay progressive card mounting', () => {
	it('paints the gifts a phone can show first and mounts the rest, in order, after it', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistGiftDisplayTestHost, props);

		const initial = mountedGiftIds();
		expect(initial.length).toBeGreaterThanOrEqual(Math.ceil(720 / 200));
		expect(initial.length).toBeLessThan(GIFT_COUNT);
		expect(initial).toEqual(giftIds.slice(0, initial.length));

		await expect.poll(mountedGiftIds, MOUNT_TIMEOUT).toEqual(giftIds);
		await expect
			.poll(() => document.querySelector(`[${GIFT_COLLECTION_MOUNTING_ATTRIBUTE}]`))
			.toBeNull();

		const [section] = props.sections;
		await screen.rerender({
			...props,
			sections: [{ ...section!, gifts: [...section!.gifts].reverse() }],
		});
		expect(mountedGiftIds()).toEqual([...giftIds].reverse());
		await screen.unmount();
	});

	it('limits the first mount only where the grid has a single column', async () => {
		await page.viewport(559, 720);
		const screen = await render(WishlistGiftDisplayTestHost, props);
		expect(mountedGiftIds().length).toBeLessThan(GIFT_COUNT);

		await expect.poll(mountedGiftIds, MOUNT_TIMEOUT).toEqual(giftIds);
		const columnStarts = new Set(
			Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'), (item) =>
				Math.round(item.getBoundingClientRect().left),
			),
		);
		expect(columnStarts.size).toBe(1);
		await screen.unmount();
	});

	it('mounts every gift at once in a multi-column grid, whose tracks align across them', async () => {
		await page.viewport(1280, 720);
		const screen = await render(WishlistGiftDisplayTestHost, props);

		expect(mountedGiftIds()).toEqual(giftIds);
		await screen.unmount();
	});

	it('mounts every gift at once in selection mode, which acts on all of them', async () => {
		await page.viewport(390, 720);
		const screen = await render(WishlistGiftDisplayTestHost, {
			...props,
			selectionMode: true,
			oncontextactions: () => true,
		});

		expect(mountedGiftIds()).toEqual(giftIds);
		await screen.unmount();
	});
});

describe('leadingGiftRows', () => {
	it('keeps the headers of mounted gifts and leaves out a header whose gifts are not mounted yet', () => {
		const group = (key: string, gifts: GiftForVisitor[]): GiftSection => ({
			kind: GIFT_SECTION_KINDS.categoryGroup,
			key,
			label: key,
			gifts,
		});
		const rows = toGiftDisplayRows([
			group('first', [visitorGift(0), visitorGift(1)]),
			group('second', [visitorGift(2)]),
		]);

		expect(leadingGiftRows(rows, 2).map((row) => row.key)).toEqual([
			'header:first',
			'gift-0',
			'gift-1',
		]);
		expect(leadingGiftRows(rows, 3)).toEqual(rows);
	});
});
