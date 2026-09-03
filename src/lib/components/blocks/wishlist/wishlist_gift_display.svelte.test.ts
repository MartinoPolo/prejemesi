import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
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

function deferredAnimation() {
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => {
		finish = resolve;
	});
	return {
		animation: {
			finished,
			cancel: vi.fn(),
		} as unknown as Animation,
		finish,
	};
}

describe('WishlistGiftDisplay mobile collection geometry (issue #330)', () => {
	it('switches from one card column at 320px to two equal columns at 321px', async () => {
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
		await screen.unmount();
	});

	it('uses standalone equal-height list cards with a 10px vertical gap', async () => {
		await page.viewport(390, 720);
		const second = { ...visitorGift(), id: 'gift-2', name: 'Kávovar' };
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [{ ...sections[0]!, gifts: [visitorGift(), second] }],
			viewMode: 'list',
		});
		const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
		const first = cards[0]!.getBoundingClientRect();
		const secondRect = cards[1]!.getBoundingClientRect();
		expect(first.height).toBeCloseTo(128, 0);
		expect(secondRect.height).toBeCloseTo(first.height, 0);
		expect(secondRect.top - first.bottom).toBeCloseTo(10, 0);
		await screen.unmount();
	});
});

describe('WishlistGiftDisplay selection accessibility', () => {
	it('uses group and independently tabbable checkbox semantics', async () => {
		const screen = await render(WishlistGiftDisplay, {
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
	expect(gift.querySelector('[data-testid="gift-state-overlay"]')).toBeNull();
}

describe('WishlistGiftDisplay contextual gift presentation', () => {
	it.each(['card', 'list'] as const)(
		'renders only the image checkbox control in selection mode for the %s path',
		async (viewMode) => {
			const privateGift = {
				...visitorGift(),
				isFullyReserved: true,
				reserverNames: ['Soukromá osoba'],
			};
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts: [privateGift] }],
				role: WISHLIST_ROLES.moderator,
				viewMode,
				selectionMode: true,
				oncontextactions: () => true,
			});
			const gift = document.querySelector('[data-gift-item]')!;

			expect(
				gift.querySelectorAll('[aria-hidden="true"] [data-slot="checkbox"]'),
			).toHaveLength(1);
			expectNoContextualCardActions(gift);
			expect(gift.querySelectorAll('button, a, input, textarea, select')).toHaveLength(1);
			await screen.unmount();
		},
	);

	it.each(['card', 'list'] as const)(
		'renders the grip and visible move controls in reorder mode for the %s path',
		async (viewMode) => {
			const privateGift = {
				...visitorGift(),
				isFullyReserved: true,
				reserverNames: ['Soukromá osoba'],
			};
			const screen = await render(WishlistGiftDisplay, {
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
			expect(grip.getBoundingClientRect().width).toBeCloseTo(40, 0);
			expect(grip.getBoundingClientRect().height).toBeCloseTo(40, 0);
			expect(moveUp).toBeTruthy();
			expect(moveUp.disabled).toBe(true);
			expect(moveDown).toBeTruthy();
			expect(moveDown.disabled).toBe(true);
			expectNoContextualCardActions(gift);
			expect(gift.querySelectorAll('button, a, input, textarea, select')).toHaveLength(3);
			await screen.unmount();
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
			const screen = await render(WishlistGiftDisplay, {
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
			const screen = await render(WishlistGiftDisplay, {
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

			const boundaryScreen = await render(WishlistGiftDisplay, {
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
			const screen = await render(WishlistGiftDisplay, {
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

describe('WishlistGiftDisplay collection transition', () => {
	it('fades the retained collection out before replacing geometry, then settles the whole collection in', async () => {
		const exit = deferredAnimation();
		const enter = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(exit.animation)
			.mockReturnValueOnce(enter.animation);
		const screen = await render(WishlistGiftDisplay, defaultProps);
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;

		await screen.rerender({ ...defaultProps, viewMode: 'list' });

		expect(collection.dataset.viewMode).toBe('card');
		expect(animate.mock.calls[0]).toEqual([
			[{ opacity: 1 }, { opacity: 0 }],
			{ duration: 160, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		]);

		exit.finish();
		await vi.waitFor(() => expect(collection.dataset.viewMode).toBe('list'));
		await vi.waitFor(() => expect(animate).toHaveBeenCalledTimes(2));

		expect(animate.mock.calls[1]).toEqual([
			[
				{ opacity: 0, transform: 'translateY(3px)' },
				{ opacity: 1, transform: 'none' },
			],
			{ duration: 280, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		]);

		enter.finish();
		await screen.unmount();
	});

	it('cancels a stale handoff and leaves the latest rapidly requested mode rendered', async () => {
		const staleExit = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValue(staleExit.animation);
		const screen = await render(WishlistGiftDisplay, defaultProps);
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;

		await screen.rerender({ ...defaultProps, viewMode: 'list' });
		expect(animate).toHaveBeenCalledOnce();
		await screen.rerender({ ...defaultProps, viewMode: 'card' });

		expect(staleExit.animation.cancel).toHaveBeenCalledOnce();
		expect(collection.dataset.viewMode).toBe('card');
		await screen.unmount();
	});

	it('swaps immediately without transforms when reduced motion is requested', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const screen = await render(WishlistGiftDisplay, defaultProps);
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;

		await screen.rerender({ ...defaultProps, viewMode: 'list' });

		expect(collection.dataset.viewMode).toBe('list');
		expect(collection.style.transform).toBe('');
		expect(animate).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('keeps transitions into and out of compact mode immediate', async () => {
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const screen = await render(WishlistGiftDisplay, defaultProps);
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;

		await screen.rerender({ ...defaultProps, viewMode: 'compact' });
		expect(collection.dataset.viewMode).toBe('compact');
		await screen.rerender({ ...defaultProps, viewMode: 'list' });

		expect(collection.dataset.viewMode).toBe('list');
		expect(animate).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('cancels collection animation and leaves no inline motion styles on teardown', async () => {
		const pending = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(pending.animation);
		const screen = await render(WishlistGiftDisplay, defaultProps);
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;

		await screen.rerender({ ...defaultProps, viewMode: 'list' });
		await screen.unmount();

		expect(pending.animation.cancel).toHaveBeenCalledOnce();
		expect(collection.getAttribute('style')).toBeNull();
	});
});
