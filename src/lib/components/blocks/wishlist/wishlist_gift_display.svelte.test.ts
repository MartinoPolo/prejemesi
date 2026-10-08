import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createPixelAssertions,
	DEFAULT_PIXEL_TOLERANCE,
} from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { ComponentProps } from 'svelte';
import {
	GIFT_GROUPING_OPTIONS,
	type GiftForVisitor,
	type GiftReorderGroupField,
} from '$lib/modules/gifts/types.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import {
	GIFT_REORDER_MOVE_SOURCES,
	applyReorderPlacement,
	buildReorderSections,
	categoryReorderGroups,
	giftReorderGroupKey,
	priorityReorderGroups,
	withReorderGroup,
	type GiftReorderGroup,
	type GiftReorderPlacement,
} from '$lib/modules/gifts/gift_grouped_reorder.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

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

const defaultProps: ComponentProps<typeof WishlistGiftDisplayTestHost> = {
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

describe('WishlistGiftDisplay received pending state', () => {
	it.each(['card', 'list', 'compact'] as const)(
		'forwards the route-owned pending state through the %s view',
		async (viewMode) => {
			const screen = await render(WishlistGiftDisplayTestHost, {
				...defaultProps,
				viewMode,
				receivedPendingGiftIds: new Set(['gift-1']),
			});
			const action = page.getByRole('button', { name: m.gift_mark_received() });

			await expect.element(action).toBeDisabled();
			await expect.element(action).toHaveAttribute('data-pending', 'true');
			await screen.unmount();
		},
	);
});

describe('WishlistGiftDisplay selection accessibility', () => {
	it('uses group and independently tabbable checkbox semantics', async () => {
		const screen = await render(WishlistGiftDisplayTestHost, {
			...defaultProps,
			selectionMode: true,
			selectedIds: ['gift-1'],
		});
		const collection = document.querySelector('[data-wishlist-gift-collection]')!;
		const gift = document.querySelector('[data-gift-item]')!;

		expect(collection.getAttribute('role')).toBe('group');
		expect(collection.hasAttribute('aria-multiselectable')).toBe(false);
		expect(gift.getAttribute('role')).toBe('checkbox');
		expect(gift.getAttribute('aria-checked')).toBe('true');
		expect(gift.getAttribute('tabindex')).toBe('0');
		await screen.unmount();
	});
});

function expectNoContextualCardActions(gift: Element) {
	expect(gift.querySelector('[data-like-heart]')).toBeNull();
	expect(gift.querySelector('[data-testid="reserve-button"]')).toBeNull();
	expect(gift.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	expect(gift.querySelector(`[aria-label="${m.gift_more_actions()}"]`)).toBeNull();
	expect(gift.querySelector(`[aria-label="${m.gift_mark_bought()}"]`)).toBeNull();
}

function rectanglesIntersect(first: DOMRect, second: DOMRect): boolean {
	const horizontallySeparated =
		first.right <= second.left + DEFAULT_PIXEL_TOLERANCE ||
		second.right <= first.left + DEFAULT_PIXEL_TOLERANCE;
	const verticallySeparated =
		first.bottom <= second.top + DEFAULT_PIXEL_TOLERANCE ||
		second.bottom <= first.top + DEFAULT_PIXEL_TOLERANCE;
	return !horizontallySeparated && !verticallySeparated;
}

function expectContextualOverlayClearOf(gift: Element, controls: readonly HTMLElement[]): void {
	const overlays = gift.querySelectorAll<HTMLElement>('[data-testid="gift-state-overlay"]');
	expect(overlays).toHaveLength(1);
	const overlay = overlays[0]!;
	expect(overlay.querySelector('[data-state-primary]')?.textContent).toBe(
		m.gift_received_badge(),
	);
	expect(overlay.querySelector('[data-reservation-support]')?.textContent).toBe(
		m.gift_reserved_by_overlay({ name: 'Soukromá osoba' }),
	);

	const badge = overlay.querySelector(':scope > span') as HTMLElement;
	for (const control of controls) {
		expect(
			rectanglesIntersect(badge.getBoundingClientRect(), control.getBoundingClientRect()),
		).toBe(false);
	}
}

describe('WishlistGiftDisplay contextual gift presentation', () => {
	it.each(['card', 'list'] as const)(
		'renders only the image checkbox control in selection mode for the %s path',
		async (viewMode) => {
			await page.viewport(390, 720);
			const privateGift = {
				...visitorGift(),
				received: true,
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
				reserverNames: ['Soukromá osoba'],
			};
			const screen = await render(WishlistGiftDisplayTestHost, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts: [privateGift] }],
				role: WISHLIST_ROLES.moderator,
				viewMode,
				selectionMode: true,
				oncontextactions: () => true,
			});
			const gift = document.querySelector('[data-gift-item]')!;
			const checkboxSurface = gift.querySelector(
				'[data-testid="gift-selection-control"]',
			) as HTMLElement;

			expect(checkboxSurface).toBeTruthy();
			expectPixelsNear(checkboxSurface.getBoundingClientRect().width, 40);
			expectPixelsNear(checkboxSurface.getBoundingClientRect().height, 40);
			expect(checkboxSurface.querySelector('[data-slot="checkbox"]')).toBeNull();
			const imageRegion = gift.querySelector(
				viewMode === 'card'
					? '[data-testid="gift-card-image-frame"]'
					: '[data-testid="gift-list-image"]',
			) as HTMLElement;
			const checkboxRect = checkboxSurface.getBoundingClientRect();
			const imageRect = imageRegion.getBoundingClientRect();
			const giftRect = gift.getBoundingClientRect();
			expectPixelsAtLeast(checkboxRect.top, giftRect.top + 4);
			expectPixelsAtMost(checkboxRect.right, giftRect.right - 4);
			expectPixelsAtMost(checkboxRect.right, imageRect.right);
			expectPixelsAtMost(checkboxRect.bottom, imageRect.bottom);
			expectNoContextualCardActions(gift);
			expectContextualOverlayClearOf(gift, [checkboxSurface]);
			expect(gift.querySelectorAll('button, a, input, textarea, select')).toHaveLength(0);
			await screen.unmount();
		},
	);

	it.each([
		{ viewMode: 'card' as const, directionalControlsVisible: false },
		{ viewMode: 'list' as const, directionalControlsVisible: true },
	])(
		'renders layout-aware reorder controls in the $viewMode path',
		async ({ viewMode, directionalControlsVisible }) => {
			await page.viewport(390, 720);
			const privateGift = {
				...visitorGift(),
				received: true,
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
				reserverNames: ['Soukromá osoba'],
			};
			const screen = await render(WishlistGiftDisplayTestHost, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts: [privateGift] }],
				role: WISHLIST_ROLES.moderator,
				viewMode,
				reorderMode: true,
				oncontextactions: () => true,
			});
			const gift = document.querySelector('[data-gift-item]')!;
			const grip = gift.querySelector(
				`button[aria-label="${m.gift_reorder_grip_label()}"]`,
			) as HTMLButtonElement;
			const moveUp = gift.querySelector(
				`button[aria-label="${m.gift_reorder_move_up({ name: privateGift.name })}"]`,
			) as HTMLButtonElement;
			const moveDown = gift.querySelector(
				`button[aria-label="${m.gift_reorder_move_down({ name: privateGift.name })}"]`,
			) as HTMLButtonElement;

			expect(grip).toBeTruthy();
			expectPixelsNear(grip.getBoundingClientRect().width, 60);
			expectPixelsNear(grip.getBoundingClientRect().height, 60);
			expect(moveUp).toBeTruthy();
			expect(moveDown).toBeTruthy();
			const directionalActions = moveUp.parentElement as HTMLElement;
			expect(getComputedStyle(directionalActions).display === 'none').toBe(
				!directionalControlsVisible,
			);
			if (directionalControlsVisible) {
				expectPixelsNear(moveUp.getBoundingClientRect().width, 40);
				expectPixelsNear(moveUp.getBoundingClientRect().height, 40);
				expectPixelsNear(moveDown.getBoundingClientRect().width, 40);
				expectPixelsNear(moveDown.getBoundingClientRect().height, 40);
				expect(moveUp.disabled).toBe(true);
				expect(moveDown.disabled).toBe(true);
			}
			expectNoContextualCardActions(gift);
			const gripSurface = grip.firstElementChild as HTMLElement;
			expectPixelsNear(gripSurface.getBoundingClientRect().width, 40);
			expectPixelsNear(gripSurface.getBoundingClientRect().height, 40);
			expectContextualOverlayClearOf(
				gift,
				directionalControlsVisible ? [gripSurface, moveUp, moveDown] : [gripSurface],
			);
			const visibleInteractiveElements = Array.from(
				gift.querySelectorAll<HTMLElement>('button, a, input, textarea, select'),
			).filter((element) => element.getClientRects().length > 0);
			expect(visibleInteractiveElements).toHaveLength(directionalControlsVisible ? 3 : 1);
			await screen.unmount();
		},
	);
});

describe('WishlistGiftDisplay recipient privacy structure (issue #336)', () => {
	it.each(['card', 'list'] as const)(
		'keeps reserved and unreserved recipient %s presentations structurally and geometrically identical',
		async (viewMode) => {
			await page.viewport(390, 720);
			const capture = async (gift: GiftForVisitor) => {
				const screen = await render(WishlistGiftDisplayTestHost, {
					...defaultProps,
					sections: [{ ...sections[0]!, gifts: [gift] }],
					role: WISHLIST_ROLES.recipient,
					viewMode,
				});
				const item = document.querySelector('[data-gift-item]') as HTMLElement;
				const snapshot = {
					html: item.innerHTML,
					width: item.getBoundingClientRect().width,
					height: item.getBoundingClientRect().height,
					text: item.textContent ?? '',
				};
				await screen.unmount();
				return snapshot;
			};
			const available = await capture(visitorGift());
			const privatelyReserved = await capture({
				...visitorGift(),
				reservedCount: 1,
				isFullyReserved: true,
				myReservationId: 'private-reservation',
				myReservationPurchasedAt: new Date('2026-01-03'),
				reserverNames: ['Soukromá osoba'],
				likeCount: 9,
			});

			expect(privatelyReserved.html).toBe(available.html);
			expectPixelsNear(privatelyReserved.width, available.width);
			expectPixelsNear(privatelyReserved.height, available.height);
			expect(privatelyReserved.text).not.toMatch(/rezerv|koupen|Soukromá osoba|9/i);
		},
	);
});

describe('WishlistGiftDisplay primary-link middle click wiring', () => {
	it.each(['card', 'list'] as const)(
		'opens the real primary link from the %s view on middle-click',
		async (viewMode) => {
			const open = vi.spyOn(window, 'open').mockImplementation(() => null);
			const giftWithPrimaryLink: GiftForVisitor = {
				...visitorGift(),
				links: [{ url: 'https://example.com/gift' }],
			};
			const linkedSections: GiftSection[] = [
				{
					...sections[0]!,
					gifts: [giftWithPrimaryLink],
				},
			];
			const screen = await render(WishlistGiftDisplayTestHost, {
				...defaultProps,
				sections: linkedSections,
				viewMode,
			});
			const wrapper = document.querySelector('[data-gift-item]') as HTMLElement;

			wrapper.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

			expect(open).toHaveBeenCalledWith(
				'https://example.com/gift',
				'_blank',
				'noopener,noreferrer',
			);
			await screen.unmount();
		},
	);
});

describe('WishlistGiftDisplay keyboard reorder announcements', () => {
	it.each(['card', 'list'] as const)(
		'announces successful moves but not boundary no-ops in %s view',
		async (viewMode) => {
			const first = visitorGift();
			const second = { ...visitorGift(), id: 'gift-2', name: 'Kávovar', sortOrder: 1 };
			const reorderSections: GiftSection[] = [{ ...sections[0]!, gifts: [first, second] }];
			const screen = await render(WishlistGiftDisplayTestHost, {
				...defaultProps,
				sections: reorderSections,
				viewMode,
				reorderMode: true,
			});
			const grips = screen.getByRole('button', { name: m.gift_reorder_grip_label() }).all();

			grips[0]!.element().focus();
			await userEvent.keyboard('{ArrowDown}');
			await expect
				.element(screen.getByRole('status'))
				.toHaveTextContent(
					m.gift_reorder_move_success({ name: first.name, position: 2, total: 2 }),
				);
			await screen.unmount();

			const boundaryScreen = await render(WishlistGiftDisplayTestHost, {
				...defaultProps,
				sections: reorderSections,
				viewMode,
				reorderMode: true,
			});
			const boundaryGrips = boundaryScreen
				.getByRole('button', { name: m.gift_reorder_grip_label() })
				.all();
			boundaryGrips[1]!.element().focus();
			await userEvent.keyboard('{ArrowDown}');
			await expect.element(boundaryScreen.getByRole('status')).toHaveTextContent('');
			await boundaryScreen.unmount();
		},
	);

	it.each(['card', 'list'] as const)(
		'does not announce a keyboard move rejected during a pointer reorder in %s view',
		async (viewMode) => {
			const first = visitorGift();
			const second = { ...visitorGift(), id: 'gift-2', name: 'Kávovar', sortOrder: 1 };
			const screen = await render(WishlistGiftDisplayTestHost, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts: [first, second] }],
				viewMode,
				reorderMode: true,
			});
			const grip = screen
				.getByRole('button', { name: m.gift_reorder_grip_label() })
				.all()[0]!
				.element();

			grip.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					button: 0,
					pointerId: 1,
					pointerType: 'mouse',
				}),
			);
			grip.focus();
			await userEvent.keyboard('{ArrowDown}');

			await expect.element(screen.getByRole('status')).toHaveTextContent('');
			await screen.unmount();
		},
	);
});

describe('WishlistGiftDisplay grouped reorder (#454)', () => {
	const LEVELS = [
		{ id: 'level-now', label: 'Vysoka', sortOrder: 0 },
		{ id: 'level-soon', label: 'Stredni', sortOrder: 1 },
	];

	function giftWithLevel(
		id: string,
		name: string,
		level: (typeof LEVELS)[number] | null,
	): GiftForVisitor {
		return {
			...visitorGift(),
			id,
			name,
			priorityLevelId: level?.id ?? null,
			priorityLabel: level?.label ?? null,
			prioritySortOrder: level?.sortOrder ?? null,
		};
	}

	const lamp = giftWithLevel('gift-lamp', 'Lampa', LEVELS[0]!);
	const kettle = giftWithLevel('gift-kettle', 'Konvice', LEVELS[0]!);
	const book = giftWithLevel('gift-book', 'Kniha', null);
	const groupedSections = buildReorderSections(
		[lamp, kettle, book],
		GIFT_GROUPING_OPTIONS.priority,
		priorityReorderGroups(LEVELS),
	);
	const groupedProps = {
		...defaultProps,
		sections: groupedSections,
		grouping: GIFT_GROUPING_OPTIONS.priority,
	};

	it.each(['card', 'list'] as const)(
		'shows an empty level as a drop zone only while reordering in %s view',
		async (viewMode) => {
			const screen = await render(WishlistGiftDisplayTestHost, {
				...groupedProps,
				viewMode,
				reorderMode: true,
			});
			await expect
				.element(screen.getByRole('heading', { name: m.gift_priority_medium() }))
				.toBeVisible();
			await expect
				.element(screen.getByTestId('gift-reorder-drop-zone'))
				.toHaveTextContent(m.gift_reorder_drop_zone());
			await screen.unmount();

			const browseScreen = await render(WishlistGiftDisplayTestHost, {
				...groupedProps,
				viewMode,
				reorderMode: false,
			});
			await expect.element(browseScreen.getByText('Lampa').first()).toBeVisible();
			expect(browseScreen.getByTestId('gift-reorder-drop-zone').elements()).toHaveLength(0);
			expect(
				browseScreen.getByRole('heading', { name: m.gift_priority_medium() }).elements(),
			).toHaveLength(0);
			await browseScreen.unmount();
		},
	);

	it.each(['card', 'list'] as const)(
		'moves across a group edge from the keyboard and names the new group in %s view',
		async (viewMode) => {
			const onreorderplacementcommit = vi.fn(() => true);
			const screen = await render(WishlistGiftDisplayTestHost, {
				...groupedProps,
				viewMode,
				reorderMode: true,
				onreorderplacementcommit,
			});

			// Card directional buttons only show on very narrow screens, so query them directly.
			const directionalButton = (label: string) =>
				screen.container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
			await expect.element(screen.getByText('Lampa').first()).toBeVisible();
			expect(directionalButton(m.gift_reorder_move_up({ name: 'Lampa' }))?.disabled).toBe(
				true,
			);
			expect(directionalButton(m.gift_reorder_move_down({ name: 'Kniha' }))?.disabled).toBe(
				true,
			);
			expect(directionalButton(m.gift_reorder_move_up({ name: 'Kniha' }))?.disabled).toBe(
				false,
			);

			const grips = screen.getByRole('button', { name: m.gift_reorder_grip_label() }).all();
			grips[1]!.element().focus();
			await userEvent.keyboard('{ArrowDown}');

			expect(onreorderplacementcommit).toHaveBeenCalledWith(
				{ giftId: 'gift-kettle', groupKey: 'priority:level-soon', index: 0 },
				GIFT_REORDER_MOVE_SOURCES.keyboard,
			);
			await expect.element(screen.getByRole('status')).toHaveTextContent(
				m.gift_reorder_move_group_success({
					name: 'Konvice',
					group: m.gift_priority_medium(),
					position: 1,
					total: 1,
				}),
			);
			await screen.unmount();
		},
	);

	it.each(['card', 'list'] as const)(
		'announces nothing when the page rejects a keyboard group move in %s view',
		async (viewMode) => {
			const onreorderplacementcommit = vi.fn(() => false);
			const screen = await render(WishlistGiftDisplayTestHost, {
				...groupedProps,
				viewMode,
				reorderMode: true,
				onreorderplacementcommit,
			});
			await expect.element(screen.getByText('Lampa').first()).toBeVisible();

			const grips = screen.getByRole('button', { name: m.gift_reorder_grip_label() }).all();
			grips[1]!.element().focus();
			await userEvent.keyboard('{ArrowDown}');

			expect(onreorderplacementcommit).toHaveBeenCalledOnce();
			await expect.element(screen.getByRole('status')).toHaveTextContent('');
			await screen.unmount();
		},
	);

	const books = {
		id: 'category-books',
		presetKey: null,
		customLabel: 'Knihy',
		color: '#2563eb',
		sortOrder: 0,
	};
	const categorySections = buildReorderSections(
		[
			{
				...visitorGift(),
				id: 'gift-lamp',
				name: 'Lampa',
				categoryId: books.id,
				category: books,
			},
			{
				...visitorGift(),
				id: 'gift-kettle',
				name: 'Konvice',
				categoryId: books.id,
				category: books,
			},
			{ ...visitorGift(), id: 'gift-book', name: 'Kniha' },
		],
		GIFT_GROUPING_OPTIONS.category,
		categoryReorderGroups([books], 'cs'),
	);

	it.each([
		['card', GIFT_GROUPING_OPTIONS.priority],
		['list', GIFT_GROUPING_OPTIONS.priority],
		['card', GIFT_GROUPING_OPTIONS.category],
		['list', GIFT_GROUPING_OPTIONS.category],
	] as const)(
		'shows the live grouping badge only on the dragged gift in %s view grouped by %s',
		async (viewMode, grouping) => {
			const screen = await render(WishlistGiftDisplayTestHost, {
				...groupedProps,
				...(grouping === GIFT_GROUPING_OPTIONS.category
					? { sections: categorySections, grouping }
					: {}),
				viewMode,
				reorderMode: true,
			});
			const badgeTestId =
				grouping === GIFT_GROUPING_OPTIONS.category
					? 'gift-category-badge'
					: 'gift-priority-badge';
			const groupingBadges = () =>
				Array.from(
					screen.container.querySelectorAll<HTMLElement>(
						`[data-gift-item] [data-testid="${badgeTestId}"]`,
					),
					(badge) => badge.closest<HTMLElement>('[data-gift-item]')?.dataset.giftId,
				);
			await expect.element(screen.getByText('Lampa').first()).toBeVisible();
			expect(groupingBadges()).toEqual([]);

			const grip = screen
				.getByRole('button', { name: m.gift_reorder_grip_label() })
				.all()[0]!
				.element();
			grip.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					button: 0,
					pointerId: 1,
					pointerType: 'mouse',
				}),
			);
			await expect.poll(groupingBadges).toEqual(['gift-lamp']);

			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			await expect.poll(groupingBadges).toEqual([]);
			await screen.unmount();
		},
	);

	const tools = {
		id: 'category-tools',
		presetKey: null,
		customLabel: 'Nářadí',
		color: '#059669',
		sortOrder: 1,
	};
	const categoryGroups = categoryReorderGroups([books, tools], 'cs');
	const categoryGifts: GiftForVisitor[] = [
		{ ...visitorGift(), id: 'gift-lamp', name: 'Lampa', categoryId: books.id, category: books },
		{
			...visitorGift(),
			id: 'gift-kettle',
			name: 'Konvice',
			categoryId: books.id,
			category: books,
		},
		{ ...visitorGift(), id: 'gift-book', name: 'Kniha' },
	];

	it.each(['card', 'list'] as const)(
		'shows an empty enabled category as a drop zone only while reordering in %s view',
		async (viewMode) => {
			const categoryProps = {
				...defaultProps,
				sections: buildReorderSections(
					categoryGifts,
					GIFT_GROUPING_OPTIONS.category,
					categoryGroups,
				),
				grouping: GIFT_GROUPING_OPTIONS.category,
				viewMode,
			};
			const screen = await render(WishlistGiftDisplayTestHost, {
				...categoryProps,
				reorderMode: true,
			});
			await expect.element(screen.getByRole('heading', { name: 'Nářadí' })).toBeVisible();
			await expect
				.element(screen.getByTestId('gift-reorder-drop-zone'))
				.toHaveTextContent(m.gift_reorder_drop_zone());
			await screen.unmount();

			const browseScreen = await render(WishlistGiftDisplayTestHost, {
				...categoryProps,
				reorderMode: false,
			});
			await expect.element(browseScreen.getByText('Lampa').first()).toBeVisible();
			expect(browseScreen.getByTestId('gift-reorder-drop-zone').elements()).toHaveLength(0);
			expect(browseScreen.getByRole('heading', { name: 'Nářadí' }).elements()).toHaveLength(
				0,
			);
			await browseScreen.unmount();
		},
	);

	/** What the page renders while a drag previews `placement`: the moved gift joins its group. */
	function previewSections(
		gifts: readonly GiftForVisitor[],
		field: GiftReorderGroupField,
		groups: readonly GiftReorderGroup[],
		placement: GiftReorderPlacement,
	): GiftSection[] {
		const giftsById = new Map(gifts.map((giftItem) => [giftItem.id, giftItem]));
		const targetGroup = groups.find((group) => group.key === placement.groupKey)!;
		const previewOrder = applyReorderPlacement(
			gifts.map((giftItem) => giftItem.id),
			(giftId) => giftReorderGroupKey(giftsById.get(giftId)!, field),
			placement,
		);
		return buildReorderSections(
			previewOrder.map((giftId) =>
				giftId === placement.giftId
					? withReorderGroup(giftsById.get(giftId)!, targetGroup)
					: giftsById.get(giftId)!,
			),
			field,
			groups,
		);
	}

	const liveBadgeCases = [
		{
			field: GIFT_GROUPING_OPTIONS.priority,
			gifts: [lamp, kettle, book],
			groups: priorityReorderGroups(LEVELS),
			badgeTestId: 'gift-priority-badge',
			targetGroupKey: 'priority:level-soon',
			targetLabel: m.gift_priority_medium(),
			noneGroupKey: 'priority:none',
		},
		{
			field: GIFT_GROUPING_OPTIONS.category,
			gifts: categoryGifts,
			groups: categoryGroups,
			badgeTestId: 'gift-category-badge',
			targetGroupKey: 'category:category-tools',
			targetLabel: 'Nářadí',
			noneGroupKey: 'category:none',
		},
	] as const;

	it.each(
		(['card', 'list'] as const).flatMap((viewMode) =>
			liveBadgeCases.map((liveBadgeCase) => ({ viewMode, ...liveBadgeCase })),
		),
	)(
		'moves the dragged gift badge to the previewed $field group in $viewMode view',
		async ({
			viewMode,
			field,
			gifts,
			groups,
			badgeTestId,
			targetGroupKey,
			targetLabel,
			noneGroupKey,
		}) => {
			const screen = await render(WishlistGiftDisplayTestHost, {
				...defaultProps,
				sections: buildReorderSections(gifts, field, groups),
				grouping: field,
				viewMode,
				reorderMode: true,
			});
			const groupingBadges = () =>
				Array.from(
					screen.container.querySelectorAll<HTMLElement>(
						`[data-gift-item] [data-testid="${badgeTestId}"]`,
					),
					(badge) => ({
						giftId: badge.closest<HTMLElement>('[data-gift-item]')?.dataset.giftId,
						label: badge.textContent?.trim(),
					}),
				);
			await expect.element(screen.getByText('Lampa').first()).toBeVisible();

			screen
				.getByRole('button', { name: m.gift_reorder_grip_label() })
				.all()[0]!
				.element()
				.dispatchEvent(
					new PointerEvent('pointerdown', {
						bubbles: true,
						button: 0,
						pointerId: 1,
						pointerType: 'mouse',
					}),
				);

			await screen.rerender({
				sections: previewSections(gifts, field, groups, {
					giftId: 'gift-lamp',
					groupKey: targetGroupKey,
					index: 0,
				}),
			});
			await expect
				.poll(groupingBadges)
				.toEqual([{ giftId: 'gift-lamp', label: targetLabel }]);

			await screen.rerender({
				sections: previewSections(gifts, field, groups, {
					giftId: 'gift-lamp',
					groupKey: noneGroupKey,
					index: 0,
				}),
			});
			await expect.poll(groupingBadges).toEqual([]);

			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			await screen.unmount();
		},
	);

	it.each(
		(['card', 'list'] as const).flatMap((viewMode) =>
			[1280, 390].map((viewportWidth) => ({ viewMode, viewportWidth })),
		),
	)(
		'keeps the dragged gift category badge clear of the reorder grip in $viewMode view at $viewportWidth px',
		async ({ viewMode, viewportWidth }) => {
			await page.viewport(viewportWidth, 720);
			const screen = await render(WishlistGiftDisplayTestHost, {
				...defaultProps,
				sections: buildReorderSections(
					categoryGifts,
					GIFT_GROUPING_OPTIONS.category,
					categoryGroups,
				),
				grouping: GIFT_GROUPING_OPTIONS.category,
				viewMode,
				reorderMode: true,
			});
			await expect.element(screen.getByText('Lampa').first()).toBeVisible();
			const draggedGift = screen.container.querySelector<HTMLElement>(
				'[data-gift-item][data-gift-id="gift-lamp"]',
			)!;
			const grip = draggedGift.querySelector<HTMLElement>(
				`button[aria-label="${m.gift_reorder_grip_label()}"]`,
			)!;
			grip.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					button: 0,
					pointerId: 1,
					pointerType: 'mouse',
				}),
			);
			await expect
				.poll(() => draggedGift.querySelector('[data-testid="gift-category-badge"]'))
				.not.toBeNull();

			const badgeRect = draggedGift
				.querySelector<HTMLElement>('[data-testid="gift-category-badge"]')!
				.getBoundingClientRect();
			const gripSurfaceRect = (grip.firstElementChild as HTMLElement).getBoundingClientRect();
			const imageRect = draggedGift
				.querySelector<HTMLElement>(
					viewMode === 'card'
						? '[data-testid="gift-card-image-frame"]'
						: '[data-testid="gift-list-image"]',
				)!
				.getBoundingClientRect();
			expect(rectanglesIntersect(badgeRect, gripSurfaceRect)).toBe(false);
			expectPixelsAtLeast(badgeRect.left, gripSurfaceRect.right);
			expectPixelsAtMost(badgeRect.right, imageRect.right);
			expectPixelsAtLeast(badgeRect.top, imageRect.top);

			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			await screen.unmount();
		},
	);

	/** Renders priority-grouped reorder whose page applies every accepted keyboard placement. */
	async function renderAppliedKeyboardReorder(viewMode: 'card' | 'list') {
		const field = GIFT_GROUPING_OPTIONS.priority;
		const groups = priorityReorderGroups(LEVELS);
		const pen = giftWithLevel('gift-pen', 'Pero', LEVELS[1]!);
		let currentGifts: GiftForVisitor[] = [lamp, kettle, pen, book];
		const screen = await render(WishlistGiftDisplayTestHost, {
			...defaultProps,
			sections: buildReorderSections(currentGifts, field, groups),
			grouping: field,
			viewMode,
			reorderMode: true,
			onreorderplacementcommit: (placement: GiftReorderPlacement) => {
				const sections = previewSections(currentGifts, field, groups, placement);
				currentGifts = sections.flatMap((section) => section.gifts as GiftForVisitor[]);
				void screen.rerender({ sections });
				return true;
			},
		});
		await expect.element(screen.getByText('Konvice').first()).toBeVisible();
		const giftItem = (giftId: string) =>
			screen.container.querySelector<HTMLElement>(
				`[data-gift-item][data-gift-id="${giftId}"]`,
			)!;
		const displayedOrder = () =>
			Array.from(
				screen.container.querySelectorAll<HTMLElement>('[data-gift-item]'),
				(item) => `${item.dataset.giftReorderGroup}/${item.dataset.giftId}`,
			);
		return { screen, giftItem, kettleItem: () => giftItem('gift-kettle'), displayedOrder };
	}

	const moveButtonLabel: Record<string, typeof m.gift_reorder_move_down> = {
		'{ArrowDown}': m.gift_reorder_move_down,
		'{ArrowUp}': m.gift_reorder_move_up,
	};

	const kettleKeyboardJourney = [
		{
			key: '{ArrowDown}',
			order: [
				'priority:level-now/gift-lamp',
				'priority:level-soon/gift-kettle',
				'priority:level-soon/gift-pen',
				'priority:none/gift-book',
			],
		},
		{
			key: '{ArrowDown}',
			order: [
				'priority:level-now/gift-lamp',
				'priority:level-soon/gift-pen',
				'priority:level-soon/gift-kettle',
				'priority:none/gift-book',
			],
		},
		{
			key: '{ArrowDown}',
			order: [
				'priority:level-now/gift-lamp',
				'priority:level-soon/gift-pen',
				'priority:none/gift-kettle',
				'priority:none/gift-book',
			],
		},
		{
			key: '{ArrowUp}',
			order: [
				'priority:level-now/gift-lamp',
				'priority:level-soon/gift-pen',
				'priority:level-soon/gift-kettle',
				'priority:none/gift-book',
			],
		},
		{
			key: '{ArrowUp}',
			order: [
				'priority:level-now/gift-lamp',
				'priority:level-soon/gift-kettle',
				'priority:level-soon/gift-pen',
				'priority:none/gift-book',
			],
		},
		{
			key: '{ArrowUp}',
			order: [
				'priority:level-now/gift-lamp',
				'priority:level-now/gift-kettle',
				'priority:level-soon/gift-pen',
				'priority:none/gift-book',
			],
		},
	];

	it.each(['card', 'list'] as const)(
		'keeps focus on the moved gift grip through grip arrow moves across group edges in %s view',
		async (viewMode) => {
			await page.viewport(1280, 720);
			const { screen, kettleItem, displayedOrder } =
				await renderAppliedKeyboardReorder(viewMode);
			const kettleGrip = () =>
				kettleItem().querySelector<HTMLElement>(
					`button[aria-label="${m.gift_reorder_grip_label()}"]`,
				)!;
			kettleGrip().focus();

			for (const step of kettleKeyboardJourney) {
				await userEvent.keyboard(step.key);
				await expect.poll(displayedOrder).toEqual(step.order);
				await expect.poll(() => document.activeElement).toBe(kettleGrip());
			}
			await screen.unmount();
		},
	);

	it.each([
		{ viewMode: 'card' as const, viewportWidth: 320 },
		{ viewMode: 'list' as const, viewportWidth: 390 },
	])(
		'keeps focus on the pressed move button across group edges in $viewMode view',
		async ({ viewMode, viewportWidth }) => {
			await page.viewport(viewportWidth, 720);
			const { screen, kettleItem, displayedOrder } =
				await renderAppliedKeyboardReorder(viewMode);
			const moveButton = (key: string) =>
				kettleItem().querySelector<HTMLElement>(
					`button[aria-label="${moveButtonLabel[key]!({ name: 'Konvice' })}"]`,
				)!;

			for (const step of kettleKeyboardJourney) {
				if (document.activeElement !== moveButton(step.key)) {
					moveButton(step.key).focus();
				}
				await userEvent.keyboard('{Enter}');
				await expect.poll(displayedOrder).toEqual(step.order);
				await expect.poll(() => document.activeElement).toBe(moveButton(step.key));
			}
			await screen.unmount();
		},
	);

	it('moves focus to the grip when the pressed move button becomes unavailable at the list end', async () => {
		await page.viewport(390, 720);
		const { screen, giftItem, displayedOrder } = await renderAppliedKeyboardReorder('list');
		giftItem('gift-pen')
			.querySelector<HTMLElement>(
				`button[aria-label="${m.gift_reorder_move_down({ name: 'Pero' })}"]`,
			)!
			.focus();

		await userEvent.keyboard('{Enter}');
		await userEvent.keyboard('{Enter}');

		await expect
			.poll(displayedOrder)
			.toEqual([
				'priority:level-now/gift-lamp',
				'priority:level-now/gift-kettle',
				'priority:none/gift-book',
				'priority:none/gift-pen',
			]);
		await expect
			.poll(() => document.activeElement)
			.toBe(
				giftItem('gift-pen').querySelector(
					`button[aria-label="${m.gift_reorder_grip_label()}"]`,
				),
			);
		await screen.unmount();
	});
});
