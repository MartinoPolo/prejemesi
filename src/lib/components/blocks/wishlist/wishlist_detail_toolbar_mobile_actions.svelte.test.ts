import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { expectContentClearsOverlayClose } from '$lib/components/base/dialog/overlay_close_geometry.test_fixtures.js';
import { createRawSnippet, type ComponentProps } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import {
	GIFT_CARD_COLUMN_OPTIONS,
	GIFT_GROUPING_OPTIONS,
	GIFT_SORT_OPTIONS,
	GIFT_VIEW_MODES,
	NO_LINK_GIFT_STORE_FILTER_VALUE,
	type GiftFilters,
} from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import WishlistDetailToolbar from './WishlistDetailToolbar.svelte';

const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

const defaultFilters = {
	availableOnly: false,
	withLinkOnly: false,
	likedOnly: false,
	showReceived: false,
	categoryValues: [],
	priorityValues: [],
	storeValues: [],
};

const defaultProps: ComponentProps<typeof WishlistDetailToolbar> = {
	canManage: false,
	role: WISHLIST_ROLES.visitor,
	isArchived: false,
	isAuthenticated: false,
	viewMode: GIFT_VIEW_MODES.card,
	sortOption: GIFT_SORT_OPTIONS.ownerOrder,
	filters: defaultFilters,
	grouping: GIFT_GROUPING_OPTIONS.none,
	groupingAvailability: { priority: false, category: false },
	categoryFilterOptions: [],
	priorityFilterOptions: [],
	storeFilterOptions: [],
	filteredGiftCount: 13,
	cardColumnOption: GIFT_CARD_COLUMN_OPTIONS.automatic,
	reorderMode: false,
	recipientViewPreview: false,
	onrecipientviewpreviewchange: () => {},
	onreordermodechange: () => {},
	onviewmodechange: () => {},
	oncardcolumnoptionchange: () => {},
	onsortchange: () => {},
	onfilterchange: () => {},
	ongroupingchange: () => {},
	onunfollow: () => {},
	onaddgift: () => {},
	onbatchadd: () => {},
	onselectionstart: () => {},
};

const hosts = new Set<HTMLDivElement>();

function hostFor(width: number) {
	const host = document.createElement('div');
	host.style.width = `${width - 24}px`;
	document.body.appendChild(host);
	hosts.add(host);
	return host;
}

async function renderToolbar(
	overrides: Partial<ComponentProps<typeof WishlistDetailToolbar>> = {},
	width = 390,
) {
	await page.viewport(width, 760);
	return render(
		WishlistDetailToolbar,
		{ ...defaultProps, ...overrides },
		{ baseElement: hostFor(width) },
	);
}

async function frames(count = 2) {
	for (let index = 0; index < count; index += 1) {
		await new Promise(requestAnimationFrame);
	}
}

function expectBottomSheet(dialog: Element) {
	expect(dialog).toHaveAttribute('data-side', 'bottom');
	const rect = dialog.getBoundingClientRect();
	const style = getComputedStyle(dialog);
	expect(style.bottom).toBe('0px');
	expectPixelsNear(rect.left, window.innerWidth - rect.right);
	expect(rect.left).toBeGreaterThan(0);
	expect(style.borderLeftWidth).toBe(style.borderRightWidth);
	expect(style.borderLeftWidth).toBe(style.borderTopWidth);
	expect(style.borderTopLeftRadius).toBe(style.borderTopRightRadius);
	expect(parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
	const header = dialog.querySelector<HTMLElement>('[data-slot="sheet-header"]')!;
	const headerStyle = getComputedStyle(header);
	expectPixelsNear(
		header.getBoundingClientRect().width,
		rect.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth),
	);
	expect(headerStyle.paddingLeft).toBe('16px');
	expectContentClearsOverlayClose(
		header,
		dialog.querySelector<HTMLElement>('[data-slot="sheet-close"]')!,
	);
	expect(headerStyle.paddingTop).toBe('12px');
	expect(headerStyle.paddingBottom).toBe('12px');
	expectPixelsNear(parseFloat(headerStyle.borderBottomWidth), 1);
	const body = header.nextElementSibling as HTMLElement;
	const bodyStyle = getComputedStyle(body);
	expect(bodyStyle.paddingLeft).toBe('8px');
	expect(bodyStyle.paddingRight).toBe('8px');
	expect(bodyStyle.paddingTop).toBe('8px');
	expect(bodyStyle.paddingBottom).toBe('8px');
}

describe('WishlistDetailToolbar mobile actions (#340)', () => {
	beforeEach(async () => page.viewport(390, 760));
	afterEach(async () => {
		for (const host of hosts) {
			host.remove();
		}
		hosts.clear();
		document.body.style.minHeight = '';
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		await page.viewport(1280, 760);
	});
	it('preserves all filter gates, facet choices, row activation, and reset semantics', async () => {
		const onfilterchange = vi.fn();
		const onsortchange = vi.fn();
		const ongroupingchange = vi.fn();
		const screen = await renderToolbar({
			isAuthenticated: true,
			onfilterchange,
			onsortchange,
			ongroupingchange,
			sortOption: GIFT_SORT_OPTIONS.name,
			grouping: GIFT_GROUPING_OPTIONS.priority,
			filters: { ...defaultFilters, withLinkOnly: true, categoryValues: ['books'] },
			categoryFilterOptions: [{ value: 'books', label: 'Knihy' }],
			priorityFilterOptions: [{ value: 'high', label: 'Vysoká' }],
		});
		const trigger = screen.getByTestId('mobile-display-trigger').element();
		expect(trigger.querySelector('[data-filter-count]')).toHaveTextContent('2');
		const badge = trigger.querySelector('[data-filter-count]')!;
		expect(getComputedStyle(badge).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
		await screen.getByTestId('mobile-display-trigger').click();
		await screen.getByTestId('mobile-sheet-filter-switch').click();
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_available_only() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_liked() }))
			.toBeVisible();
		await expect.element(screen.getByRole('checkbox', { name: 'Knihy' })).toBeChecked();
		await expect.element(screen.getByRole('checkbox', { name: 'Vysoká' })).toBeVisible();
		const withLink = screen
			.getByRole('checkbox', { name: m.gift_filter_with_link() })
			.element();
		await (withLink.parentElement!.querySelector('span') as HTMLElement).click();
		expect(onfilterchange).toHaveBeenCalledExactlyOnceWith({
			...defaultFilters,
			categoryValues: ['books'],
		});
		await userEvent.keyboard('{Escape}');
		await frames();
		await screen.getByTestId('mobile-more-trigger').click();
		await screen.getByRole('button', { name: m.gift_display_reset_tooltip() }).click();
		expect(onfilterchange).toHaveBeenLastCalledWith(defaultFilters);
		expect(onsortchange).toHaveBeenCalledWith(GIFT_SORT_OPTIONS.ownerOrder);
		expect(ongroupingchange).toHaveBeenCalledWith(GIFT_GROUPING_OPTIONS.none);
		await screen.unmount();
	});

	it('keeps recipient privacy gates in the combined filter sheet', async () => {
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.recipient,
			isAuthenticated: true,
		});
		await screen.getByTestId('mobile-display-trigger').click();
		await screen.getByTestId('mobile-sheet-filter-switch').click();
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_available_only() }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_liked() }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_with_link() }))
			.toBeVisible();
		await screen.unmount();
	});

	it.each([WISHLIST_ROLES.visitor, WISHLIST_ROLES.recipient, WISHLIST_ROLES.moderator])(
		'offers the store facet to the %s in the filter sheet, counted and cleared like other facets (#650)',
		async (role) => {
			const onfilterchange = vi.fn();
			const screen = await renderToolbar({
				role,
				canManage: role !== WISHLIST_ROLES.visitor,
				isAuthenticated: true,
				onfilterchange,
				filters: { ...defaultFilters, storeValues: ['alza.cz'] },
				storeFilterOptions: [
					{ value: 'alza.cz', label: 'alza.cz' },
					{ value: NO_LINK_GIFT_STORE_FILTER_VALUE, label: m.gift_link_none() },
				],
			});
			const trigger = screen.getByTestId('mobile-display-trigger');
			expect(trigger.element().querySelector('[data-filter-count]')).toHaveTextContent('1');
			await trigger.click();
			await screen.getByTestId('mobile-sheet-filter-switch').click();
			await expect
				.element(screen.getByRole('heading', { name: m.gift_filter_store_heading() }))
				.toBeVisible();
			await expect.element(screen.getByRole('checkbox', { name: 'alza.cz' })).toBeChecked();
			await screen.getByRole('checkbox', { name: m.gift_link_none() }).click();
			expect(onfilterchange).toHaveBeenLastCalledWith({
				...defaultFilters,
				storeValues: ['alza.cz', NO_LINK_GIFT_STORE_FILTER_VALUE],
			});
			await screen
				.getByTestId('mobile-sheet-footer')
				.getByRole('button', { name: m.wishlist_detail_clear_filters() })
				.click();
			expect(onfilterchange).toHaveBeenLastCalledWith(defaultFilters);
			await screen.unmount();
		},
	);

	it('omits the store facet when there are no store options (#650)', async () => {
		const screen = await renderToolbar({
			categoryFilterOptions: [{ value: 'books', label: 'Knihy' }],
		});
		await screen.getByTestId('mobile-display-trigger').click();
		await screen.getByTestId('mobile-sheet-filter-switch').click();
		await expect.element(screen.getByRole('checkbox', { name: 'Knihy' })).toBeVisible();
		await expect
			.element(screen.getByRole('heading', { name: m.gift_filter_store_heading() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('puts only eligible lower-priority actions in More and dispatches them', async () => {
		const callbacks = {
			onrecipientviewpreviewchange: vi.fn(),
			onselectionstart: vi.fn(),
			onreordermodechange: vi.fn(),
			onbatchadd: vi.fn(),
		};
		const screen = await renderToolbar({
			...callbacks,
			canManage: true,
			role: WISHLIST_ROLES.moderator,
		});
		await screen.getByTestId('mobile-more-trigger').click();
		const more = screen.getByRole('dialog', { name: m.wishlist_more_actions() });
		await expect.element(more).toBeVisible();
		expectBottomSheet(more.element());
		await expect
			.element(more.getByRole('button', { name: m.recipient_view_preview_turn_on() }))
			.toBeVisible();
		await expect
			.element(more.getByRole('button', { name: m.gift_selection_toolbar() }))
			.toBeVisible();
		await expect
			.element(more.getByRole('button', { name: m.gift_reorder_action() }))
			.toBeVisible();
		const batchAdd = more.getByRole('button', { name: m.batch_add_toolbar_label() });
		await expect.element(batchAdd).toBeVisible();
		for (const action of [
			more.getByRole('button', { name: m.recipient_view_preview_turn_on() }).element(),
			batchAdd.element(),
		]) {
			expectPixelsAtLeast(action.getBoundingClientRect().height, 48);
			const surface = action.querySelector<HTMLElement>(':scope > .elevation-surface')!;
			expect(surface).toBeTruthy();
			expect(getComputedStyle(surface).justifyContent).toBe('flex-start');
		}
		await expect
			.element(more.getByRole('button', { name: m.wishlist_detail_unfollow() }))
			.not.toBeInTheDocument();
		await userEvent.keyboard('{Escape}');
		await frames();
		await expect.element(screen.getByTestId('mobile-more-trigger')).toHaveFocus();
		await screen.getByTestId('mobile-more-trigger').click();
		await screen
			.getByRole('dialog', { name: m.wishlist_more_actions() })
			.getByRole('button', { name: m.gift_selection_toolbar() })
			.click();
		expect(callbacks.onselectionstart).toHaveBeenCalledOnce();
		await screen.unmount();
	});

	it('exposes visitor-only preview and unfollow in More without management actions', async () => {
		const onunfollow = vi.fn();
		const screen = await renderToolbar({ isAuthenticated: true, onunfollow });
		await screen.getByTestId('mobile-more-trigger').click();
		const more = screen.getByRole('dialog', { name: m.wishlist_more_actions() });
		await expect
			.element(more.getByRole('button', { name: m.wishlist_detail_unfollow() }))
			.toBeVisible();
		await expect
			.element(more.getByRole('button', { name: m.gift_selection_toolbar() }))
			.not.toBeInTheDocument();
		await more.getByRole('button', { name: m.wishlist_detail_unfollow() }).click();
		expect(onunfollow).toHaveBeenCalledOnce();
		await screen.unmount();
	});

	it('restores Display focus, scroll, width, and toolbar geometry after Escape', async () => {
		const screen = await renderToolbar({}, 390);
		const trigger = screen.getByTestId('mobile-display-trigger').element() as HTMLButtonElement;
		const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
		document.body.style.minHeight = '200vh';
		window.scrollTo({ top: 17, left: 0, behavior: 'instant' });
		await frames(1);
		const before = toolbar.getBoundingClientRect();
		const scrollBefore = window.scrollY;
		expectPixelsNear(scrollBefore, 17);
		await trigger.click();
		const dialog = screen.getByRole('dialog', { name: m.gift_display_options() });
		await userEvent.keyboard('{Tab}');
		expect(dialog.element().contains(document.activeElement)).toBe(true);
		await userEvent.keyboard('{Escape}');
		await frames(5);
		expect(document.activeElement).toBe(trigger);
		expectPixelsNear(window.scrollY, scrollBefore);
		const after = toolbar.getBoundingClientRect();
		expectPixelsNear(after.width, before.width);
		expectPixelsNear(after.height, before.height);
		expectPixelsNear(
			document.documentElement.scrollWidth,
			document.documentElement.clientWidth,
		);
		await screen.unmount();
	});

	it.each([GIFT_GROUPING_OPTIONS.priority, GIFT_GROUPING_OPTIONS.category])(
		'keeps mobile reorder available while grouped by %s',
		async (grouping) => {
			const onreordermodechange = vi.fn();
			const screen = await renderToolbar({
				canManage: true,
				role: WISHLIST_ROLES.recipient,
				grouping,
				groupingAvailability: { priority: true, category: true },
				onreordermodechange,
			});
			await screen.getByTestId('mobile-more-trigger').click();
			await screen.getByRole('button', { name: m.gift_reorder_action() }).click();
			expect(onreordermodechange).toHaveBeenCalledWith(true);
			await screen.unmount();
		},
	);

	it('offers Carousel as the third mobile view after Card and List (#580 REQ-1)', async () => {
		const onviewmodechange = vi.fn();
		const screen = await renderToolbar({ onviewmodechange });
		const switcher = screen
			.getByTestId('wishlist-toolbar-mobile')
			.element()
			.querySelector('[data-testid="gift-view-switcher"]')!;
		expect(
			Array.from(switcher.querySelectorAll('[role="radio"]'), (mode) =>
				mode.getAttribute('aria-label'),
			),
		).toEqual([m.gift_view_card(), m.gift_view_list(), m.gift_view_carousel()]);
		await screen.getByRole('radio', { name: m.gift_view_carousel() }).click();
		expect(onviewmodechange).toHaveBeenCalledWith(GIFT_VIEW_MODES.carousel);
		await screen.unmount();
	});

	it('makes no grouping unavailable while Carousel requires a grouping (#580 REQ-3)', async () => {
		const screen = await renderToolbar({
			viewMode: GIFT_VIEW_MODES.carousel,
			grouping: GIFT_GROUPING_OPTIONS.priority,
			groupingAvailability: { priority: true, category: true },
			groupingRequired: true,
		});
		await screen.getByTestId('mobile-display-trigger').click();
		await screen.getByTestId('mobile-sheet-grouping-switch').click();
		await expect
			.element(screen.getByRole('radio', { name: m.gift_grouping_none() }))
			.toBeDisabled();
		await expect
			.element(screen.getByRole('radio', { name: m.gift_grouping_category() }))
			.not.toBeDisabled();
		await screen.unmount();
	});

	it('does not offer mobile reorder before gift data is ready', async () => {
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.recipient,
			giftDataReady: false,
		});
		await screen.getByTestId('mobile-more-trigger').click();
		await expect
			.element(screen.getByRole('button', { name: m.gift_reorder_action() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('keeps the mobile layout switcher enabled in reorder without overflowing at 320px', async () => {
		const onreordermodechange = vi.fn();
		const onviewmodechange = vi.fn();
		const screen = await renderToolbar(
			{
				canManage: true,
				role: WISHLIST_ROLES.moderator,
				reorderMode: true,
				onreordermodechange,
				onviewmodechange,
			},
			320,
		);
		const row = screen
			.getByTestId('wishlist-toolbar-mobile')
			.element()
			.querySelector('[data-mobile-toolbar-row]')!;
		expect(row).toHaveTextContent(m.gift_reorder_mode_label());
		const listMode = screen.getByRole('radio', { name: m.gift_view_list() });
		expect(listMode.element()).not.toBeDisabled();
		await listMode.click();
		expect(onviewmodechange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		expectPixelsAtMost(row.scrollWidth, row.clientWidth);
		const done = screen
			.getByRole('button', { name: m.gift_reorder_done() })
			.element() as HTMLButtonElement;
		expectPixelsNear(done.getBoundingClientRect().height, 40);
		expectPixelsNear(done.getBoundingClientRect().right, row.getBoundingClientRect().right);
		await done.click();
		expect(onreordermodechange).toHaveBeenCalledWith(false);
		await screen.unmount();
	});

	it('clears open mobile sheets when crossing the sm breakpoint', async () => {
		const screen = await renderToolbar();
		await screen.getByTestId('mobile-display-trigger').click();
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_display_options() }))
			.toBeVisible();
		await page.viewport(640, 760);
		await frames();
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_display_options() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});
});

describe('WishlistDetailToolbar mobile filter reset (#658)', () => {
	const storeFilterOptions = [
		{ value: 'alza.cz', label: 'alza.cz' },
		{ value: 'datart.cz', label: 'datart.cz' },
		{ value: 'kosmas.cz', label: 'kosmas.cz' },
	];
	const twoStoreFilters = { ...defaultFilters, storeValues: ['alza.cz', 'datart.cz'] };

	beforeEach(async () => page.viewport(390, 760));
	afterEach(async () => {
		for (const host of hosts) {
			host.remove();
		}
		hosts.clear();
		document.body.style.minHeight = '';
		document.body.style.paddingTop = '';
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		await page.viewport(1280, 760);
	});

	/** Renders the toolbar whose filters follow its own filter changes, like the wishlist page. */
	async function renderFilteringToolbar(
		overrides: Partial<ComponentProps<typeof WishlistDetailToolbar>> = {},
		width = 390,
	) {
		const props = { ...defaultProps, storeFilterOptions, ...overrides };
		const onfilterchange = vi.fn((filters: GiftFilters) => {
			void screen.rerender({ ...props, onfilterchange, filters });
		});
		const screen = await renderToolbar({ ...props, onfilterchange }, width);
		return { screen, onfilterchange };
	}

	function pillRow(screen: Awaited<ReturnType<typeof renderToolbar>>) {
		return screen.getByTestId('wishlist-mobile-active-filters');
	}

	it('shows one 40 px removable pill per active value followed by „Zrušit filtry“', async () => {
		const { screen } = await renderFilteringToolbar({ filters: twoStoreFilters });
		const pillTargets = ['alza.cz', 'datart.cz'].map((label) =>
			pillRow(screen)
				.getByRole('button', { name: m.filter_remove({ label }), exact: true })
				.element(),
		);
		const clearAll = pillRow(screen)
			.getByRole('button', { name: m.wishlist_detail_clear_filters(), exact: true })
			.element();
		const buttons = Array.from(pillRow(screen).element().querySelectorAll('button'));
		expect(buttons).toEqual([...pillTargets, clearAll]);
		for (const button of buttons) {
			expectPixelsAtLeast(button.getBoundingClientRect().height, 40);
		}
		await screen.unmount();
	});

	it('places the pill row under the toolbar card, outside the sticky toolbar, so it scrolls away', async () => {
		const { screen } = await renderFilteringToolbar({ filters: twoStoreFilters });
		const row = pillRow(screen).element() as HTMLElement;
		const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
		expect(row.closest('.wishlist-toolbar-sticky')).toBeNull();

		// Start the toolbar below its sticky offset so it rests in normal flow before scrolling.
		document.body.style.paddingTop = '24px';
		document.body.style.minHeight = '200vh';
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		await frames(1);
		const firstPillFace = row.querySelector<HTMLElement>('[data-active-filter-pill]')!;
		expectPixelsAtLeast(
			firstPillFace.getBoundingClientRect().top,
			toolbar.getBoundingClientRect().bottom,
		);
		const rowTop = row.getBoundingClientRect().top;
		window.scrollTo({ top: 40, left: 0, behavior: 'instant' });
		await frames(1);
		expectPixelsNear(row.getBoundingClientRect().top, rowTop - 40);
		await screen.unmount();
	});

	it('keeps the active filter count on the Display trigger alongside the pill row', async () => {
		const { screen } = await renderFilteringToolbar({ filters: twoStoreFilters });
		await expect.element(pillRow(screen)).toBeVisible();
		expect(
			screen
				.getByTestId('mobile-display-trigger')
				.element()
				.querySelector('[data-filter-count]'),
		).toHaveTextContent('2');
		await screen.unmount();
	});

	it('scrolls the pill row sideways instead of wrapping at 320px', async () => {
		const { screen } = await renderFilteringToolbar(
			{
				filters: {
					...twoStoreFilters,
					availableOnly: true,
					withLinkOnly: true,
					storeValues: ['alza.cz', 'datart.cz', 'kosmas.cz'],
				},
			},
			320,
		);
		const scroller = pillRow(screen)
			.element()
			.querySelector<HTMLElement>('[data-filter-pills]')!;
		expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
		const tops = Array.from(scroller.querySelectorAll('button'), (button) =>
			Math.round(button.getBoundingClientRect().top),
		);
		expect(new Set(tops).size).toBe(1);
		expectPixelsNear(
			document.documentElement.scrollWidth,
			document.documentElement.clientWidth,
		);
		await screen.unmount();
	});

	it('removes one filter per pill, moving focus to the next pill and finally the Display trigger', async () => {
		const { screen, onfilterchange } = await renderFilteringToolbar({
			filters: twoStoreFilters,
		});

		await pillRow(screen)
			.getByRole('button', { name: m.filter_remove({ label: 'alza.cz' }), exact: true })
			.click();
		expect(onfilterchange).toHaveBeenLastCalledWith({
			...defaultFilters,
			storeValues: ['datart.cz'],
		});
		const remainingPill = pillRow(screen).getByRole('button', {
			name: m.filter_remove({ label: 'datart.cz' }),
			exact: true,
		});
		await expect.element(remainingPill).toHaveFocus();

		await remainingPill.click();
		expect(onfilterchange).toHaveBeenLastCalledWith(defaultFilters);
		await expect.element(pillRow(screen)).not.toBeInTheDocument();
		await expect.element(screen.getByTestId('mobile-display-trigger')).toHaveFocus();
		await screen.unmount();
	});

	it('clears every filter from the row and hides it', async () => {
		const { screen, onfilterchange } = await renderFilteringToolbar({
			filters: twoStoreFilters,
		});
		await pillRow(screen)
			.getByRole('button', { name: m.wishlist_detail_clear_filters(), exact: true })
			.click();
		expect(onfilterchange).toHaveBeenLastCalledWith(defaultFilters);
		await expect.element(pillRow(screen)).not.toBeInTheDocument();
		await expect.element(screen.getByTestId('mobile-display-trigger')).toHaveFocus();
		await screen.unmount();
	});

	it('shows no row without active filters or in selection mode', async () => {
		const { screen } = await renderFilteringToolbar();
		await expect.element(pillRow(screen)).not.toBeInTheDocument();
		await screen.unmount();

		const selection = await renderFilteringToolbar({
			filters: twoStoreFilters,
			selectionContent: createRawSnippet(() => ({ render: () => '<div>Výběr</div>' })),
		});
		await expect.element(selection.screen.getByText('Výběr')).toBeVisible();
		await expect.element(pillRow(selection.screen)).not.toBeInTheDocument();
		await selection.screen.unmount();
	});

	it('keeps the pills visible but disabled in reorder mode, like desktop', async () => {
		const { screen } = await renderFilteringToolbar({
			filters: twoStoreFilters,
			canManage: true,
			role: WISHLIST_ROLES.moderator,
			reorderMode: true,
		});
		for (const button of pillRow(screen).element().querySelectorAll('button')) {
			expect(button).toBeDisabled();
		}
		await screen.unmount();
	});

	it('shows no mobile row on desktop', async () => {
		const { screen } = await renderFilteringToolbar({ filters: twoStoreFilters }, 1280);
		await expect
			.element(screen.getByTestId('wishlist-toolbar-active-filters'))
			.toBeInTheDocument();
		await expect.element(pillRow(screen)).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('puts „Zrušit filtry“ and „Zobrazit N přání“ in a Filter footer between the options and the section switcher', async () => {
		const { screen, onfilterchange } = await renderFilteringToolbar({
			filters: twoStoreFilters,
			filteredGiftCount: 4,
		});
		await screen.getByTestId('mobile-display-trigger').click();
		const footer = screen.getByTestId('mobile-sheet-footer');
		await expect.element(footer).not.toBeVisible();

		await screen.getByTestId('mobile-sheet-filter-switch').click();
		await expect.element(footer).toBeVisible();
		const scroll = screen.getByTestId('mobile-sheet-scroll').element();
		expect(scroll.contains(footer.element())).toBe(false);
		expect(footer.element().nextElementSibling).toBe(
			screen.getByTestId('mobile-sheet-switcher').element(),
		);
		await expect
			.element(
				screen
					.getByTestId('mobile-sheet-scroll')
					.getByRole('button', { name: m.wishlist_detail_clear_filters() }),
			)
			.not.toBeInTheDocument();

		const showResults = footer.getByRole('button', {
			name: m.gift_filter_show_results_other({ count: 4 }),
		});
		await expect.element(showResults).toBeVisible();
		const clear = footer.getByRole('button', { name: m.wishlist_detail_clear_filters() });
		await expect.element(clear).toBeEnabled();
		await clear.click();
		expect(onfilterchange).toHaveBeenLastCalledWith(defaultFilters);
		await expect.element(clear).toBeDisabled();
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_display_options() }))
			.toBeVisible();
		await expect.element(showResults).toHaveFocus();
		await screen.unmount();
	});

	it('pluralises the result count and closes the sheet back to the Display trigger', async () => {
		const { screen } = await renderFilteringToolbar({
			filters: twoStoreFilters,
			filteredGiftCount: 1,
		});
		await screen.getByTestId('mobile-display-trigger').click();
		await screen.getByTestId('mobile-sheet-filter-switch').click();
		await screen
			.getByTestId('mobile-sheet-footer')
			.getByRole('button', { name: m.gift_filter_show_results_one() })
			.click();
		await frames(5);
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_display_options() }))
			.not.toBeInTheDocument();
		await expect.element(screen.getByTestId('mobile-display-trigger')).toHaveFocus();
		await screen.unmount();
	});

	it('updates „Zobrazit N přání“ when the filtered gift count changes', async () => {
		const props = { ...defaultProps, storeFilterOptions, filters: twoStoreFilters };
		const screen = await renderToolbar({ ...props, filteredGiftCount: 4 });
		await screen.getByTestId('mobile-display-trigger').click();
		await screen.getByTestId('mobile-sheet-filter-switch').click();
		const footer = screen.getByTestId('mobile-sheet-footer');
		await expect
			.element(
				footer.getByRole('button', {
					name: m.gift_filter_show_results_other({ count: 4 }),
				}),
			)
			.toBeVisible();

		await screen.rerender({ ...props, filteredGiftCount: 7 });
		await expect
			.element(
				footer.getByRole('button', {
					name: m.gift_filter_show_results_other({ count: 7 }),
				}),
			)
			.toBeVisible();
		await screen.unmount();
	});

	it('disables „Zrušit filtry“ in the footer without active filters', async () => {
		const { screen } = await renderFilteringToolbar();
		await screen.getByTestId('mobile-display-trigger').click();
		await screen.getByTestId('mobile-sheet-filter-switch').click();
		const footer = screen.getByTestId('mobile-sheet-footer');
		await expect
			.element(footer.getByRole('button', { name: m.wishlist_detail_clear_filters() }))
			.toBeDisabled();
		await expect
			.element(
				footer.getByRole('button', {
					name: m.gift_filter_show_results_other({ count: 13 }),
				}),
			)
			.toBeEnabled();
		await screen.unmount();
	});
});
