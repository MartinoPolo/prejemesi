import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import {
	GIFT_GROUPING_OPTIONS,
	GIFT_SORT_OPTIONS,
	GIFT_VIEW_MODES,
} from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import WishlistDetailToolbar from './WishlistDetailToolbar.svelte';

const defaultProps: ComponentProps<typeof WishlistDetailToolbar> = {
	canManage: false,
	role: WISHLIST_ROLES.visitor,
	isArchived: false,
	isAuthenticated: false,
	viewMode: GIFT_VIEW_MODES.card,
	sortOption: GIFT_SORT_OPTIONS.ownerOrder,
	filters: {
		availableOnly: false,
		withLinkOnly: false,
		likedOnly: false,
		showReceived: false,
		categoryValues: [],
		priorityValues: [],
	},
	grouping: GIFT_GROUPING_OPTIONS.none,
	groupingAvailability: { priority: false, category: false },
	categoryFilterOptions: [],
	priorityFilterOptions: [],
	reorderMode: false,
	recipientViewPreview: false,
	onrecipientviewpreviewchange: () => {},
	onreordermodechange: () => {},
	onviewmodechange: () => {},
	onsortchange: () => {},
	onfilterchange: () => {},
	ongroupingchange: () => {},
	onsettings: () => {},
	onunfollow: () => {},
	onaddgift: () => {},
	onbatchadd: () => {},
	onselectionstart: () => {},
};

async function renderToolbar(
	overrides: Partial<ComponentProps<typeof WishlistDetailToolbar>> = {},
) {
	const previousWidth = document.body.style.width;
	document.body.style.width = '1200px';
	const screen = await render(WishlistDetailToolbar, { ...defaultProps, ...overrides });
	const unmount = screen.unmount.bind(screen);
	screen.unmount = async () => {
		await unmount();
		document.body.style.width = previousWidth;
	};
	return screen;
}

async function awaitAnimationFrames(count = 2) {
	for (let frame = 0; frame < count; frame += 1) {
		await new Promise(requestAnimationFrame);
	}
}

function expectDocumentOrder(elements: Element[]) {
	for (const [index, element] of elements.slice(0, -1).entries()) {
		expect(
			element.compareDocumentPosition(elements[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	}
}

function expectToolbarIcon(element: Element, purpose: string) {
	expect(element.querySelector(`[data-toolbar-icon="${purpose}"]`)).not.toBeNull();
}

function rectanglesIntersect(first: DOMRect, second: DOMRect): boolean {
	return (
		first.left < second.right &&
		first.right > second.left &&
		first.top < second.bottom &&
		first.bottom > second.top
	);
}

function measureNaturalWidth(element: HTMLElement): number {
	const clone = element.cloneNode(true) as HTMLElement;
	clone.style.position = 'fixed';
	clone.style.width = 'max-content';
	clone.style.maxWidth = 'none';
	clone.style.visibility = 'hidden';
	document.body.appendChild(clone);
	const width = clone.getBoundingClientRect().width;
	clone.remove();
	return width;
}

const trackedToolbarHosts = new Set<HTMLDivElement>();

function createTrackedToolbarHost(width: string): HTMLDivElement {
	const host = document.createElement('div');
	host.style.width = width;
	document.body.appendChild(host);
	trackedToolbarHosts.add(host);
	return host;
}

describe('WishlistDetailToolbar mobile command bar (#320)', () => {
	beforeEach(async () => page.viewport(390, 720));
	afterEach(async () => {
		for (const host of trackedToolbarHosts) {
			host.remove();
		}
		trackedToolbarHosts.clear();
		document.body.style.width = '';
		document.body.style.minHeight = '';
		window.scrollTo(0, 0);
		await page.viewport(1280, 720);
	});

	it('stays within one visitor row or two unsplit manager rows without horizontal overflow', async () => {
		for (const width of [320, 360, 390, 639]) {
			await page.viewport(width, 720);
			for (const manager of [false, true]) {
				const host = createTrackedToolbarHost(`${width - 32}px`);
				const screen = await render(
					WishlistDetailToolbar,
					{
						...defaultProps,
						canManage: manager,
						role: manager ? WISHLIST_ROLES.moderator : WISHLIST_ROLES.visitor,
					},
					{ baseElement: host },
				);
				await new Promise(requestAnimationFrame);
				const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
				const rows = Array.from(
					toolbar.querySelectorAll<HTMLElement>('[data-mobile-toolbar-row]'),
				).filter((row) => row.getClientRects().length > 0);
				expect(rows).toHaveLength(manager ? 2 : 1);
				expect(toolbar.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth);
				expect(toolbar.getBoundingClientRect().height).toBeLessThanOrEqual(
					manager ? 104 : 60,
				);
				for (const row of rows) {
					expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
				}
				await screen.unmount();
				host.remove();
			}
		}
	});

	it('uses 40px targets and ListChecks, Hand, Check mobile mode actions', async () => {
		const onselectionstart = vi.fn();
		const onreordermodechange = vi.fn();
		const host = createTrackedToolbarHost('390px');
		const props = {
			...defaultProps,
			canManage: true,
			role: WISHLIST_ROLES.moderator,
			onselectionstart,
			onreordermodechange,
		};
		const screen = await render(WishlistDetailToolbar, props, { baseElement: host });
		const toolbar = screen.getByTestId('wishlist-toolbar').element();
		const mobile = screen.getByTestId('wishlist-toolbar-mobile').element();
		const visibleToolbarButtons = Array.from(toolbar.querySelectorAll('button')).filter(
			(button) => button.getClientRects().length > 0,
		);
		for (const button of visibleToolbarButtons) {
			const rect = button.getBoundingClientRect();
			expect(rect.width).toBeGreaterThanOrEqual(40);
			expect(rect.height).toBeGreaterThanOrEqual(40);
		}
		const selectionButton = mobile
			.querySelector('[data-toolbar-icon="selection"]')!
			.closest('button')!;
		expect(selectionButton.querySelector('[data-lucide="list-checks"]')).not.toBeNull();
		await selectionButton.click();
		expect(onselectionstart).toHaveBeenCalledOnce();
		const reorder = mobile.querySelector('[data-toolbar-icon="reorder"]')!.closest('button')!;
		expect(reorder.querySelector('[data-lucide="hand"]')).not.toBeNull();
		await reorder.click();
		expect(onreordermodechange).toHaveBeenCalledWith(true);
		await screen.rerender({ ...props, reorderMode: true });
		const visibleRows = Array.from(
			mobile.querySelectorAll<HTMLElement>('[data-mobile-toolbar-row]'),
		).filter((row) => row.getClientRects().length > 0);
		expect(visibleRows).toHaveLength(1);
		const visibleButtons = Array.from(
			toolbar.querySelectorAll<HTMLButtonElement>('button'),
		).filter((button) => button.getClientRects().length > 0);
		expect(visibleButtons).toHaveLength(1);
		const doneButton = visibleButtons[0]!;
		expect(doneButton).toHaveAccessibleName(m.gift_reorder_done());
		expect(doneButton).toHaveTextContent(m.gift_reorder_done());
		expect(
			doneButton.querySelector('[data-toolbar-icon="reorder-done"][data-lucide="check"]'),
		).not.toBeNull();
		await expect.element(screen.getByTestId('mobile-sort-trigger')).not.toBeInTheDocument();
		await expect.element(screen.getByTestId('mobile-grouping-trigger')).not.toBeInTheDocument();
		await expect.element(screen.getByTestId('mobile-filter-trigger')).not.toBeInTheDocument();
		await expect.element(screen.getByTestId('gift-view-switcher')).not.toBeVisible();
		await doneButton.click();
		expect(onreordermodechange).toHaveBeenLastCalledWith(false);
		await screen.unmount();
		host.remove();
	});

	it('opens dedicated bottom dialog sheets with selected semantics and exclusive state', async () => {
		const onsortchange = vi.fn();
		const ongroupingchange = vi.fn();
		const host = createTrackedToolbarHost('390px');
		const props = {
			...defaultProps,
			groupingAvailability: { priority: true, category: false },
			categoryFilterOptions: [{ value: 'c', label: 'Knihy' }],
			onsortchange,
			ongroupingchange,
		};
		const screen = await render(WishlistDetailToolbar, props, { baseElement: host });
		const expectBottomSheet = (dialog: Element) => {
			expect(dialog).toHaveAttribute('data-side', 'bottom');
			expect(getComputedStyle(dialog).bottom).toBe('0px');
		};

		await screen.getByTestId('mobile-sort-trigger').click();
		let sortDialog = screen.getByRole('dialog', { name: m.gift_sort_by() });
		await expect.element(sortDialog).toBeVisible();
		expectBottomSheet(sortDialog.element());
		await expect
			.element(screen.getByRole('radio', { name: m.gift_sort_owner_order() }))
			.toBeChecked();
		await screen.getByRole('radio', { name: m.gift_sort_priority() }).click();
		expect(onsortchange).toHaveBeenCalledExactlyOnceWith(GIFT_SORT_OPTIONS.priority);
		await expect.element(sortDialog).not.toBeInTheDocument();
		await awaitAnimationFrames();
		await screen.rerender({ ...props, sortOption: GIFT_SORT_OPTIONS.priority });
		await screen.getByTestId('mobile-sort-trigger').click();
		sortDialog = screen.getByRole('dialog', { name: m.gift_sort_by() });
		await expect.element(sortDialog).toBeVisible();
		expectBottomSheet(sortDialog.element());
		await expect
			.element(screen.getByRole('radio', { name: m.gift_sort_priority() }))
			.toBeChecked();
		await userEvent.keyboard('{Escape}');
		await awaitAnimationFrames();

		await screen.getByTestId('mobile-grouping-trigger').click();
		let groupingDialog = screen.getByRole('dialog', { name: m.gift_grouping_label() });
		await expect.element(groupingDialog).toBeVisible();
		expectBottomSheet(groupingDialog.element());
		await expect
			.element(screen.getByRole('radio', { name: m.gift_grouping_category() }))
			.toBeDisabled();
		await screen.getByRole('radio', { name: m.gift_grouping_priority() }).click();
		expect(ongroupingchange).toHaveBeenCalledExactlyOnceWith(GIFT_GROUPING_OPTIONS.priority);
		await expect.element(groupingDialog).not.toBeInTheDocument();
		await awaitAnimationFrames();
		await screen.rerender({
			...props,
			sortOption: GIFT_SORT_OPTIONS.priority,
			grouping: GIFT_GROUPING_OPTIONS.priority,
		});
		await screen.getByTestId('mobile-grouping-trigger').click();
		groupingDialog = screen.getByRole('dialog', { name: m.gift_grouping_label() });
		await expect.element(groupingDialog).toBeVisible();
		expectBottomSheet(groupingDialog.element());
		await expect
			.element(screen.getByRole('radio', { name: m.gift_grouping_priority() }))
			.toBeChecked();
		await userEvent.keyboard('{Escape}');
		await awaitAnimationFrames();

		await screen.getByTestId('mobile-filter-trigger').click();
		const filterDialog = screen.getByRole('dialog', { name: m.gift_filter() });
		await expect.element(filterDialog).toBeVisible();
		expectBottomSheet(filterDialog.element());
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_with_link() }))
			.toBeVisible();
		await screen.unmount();
		host.remove();
	});

	it('switches sibling sheets in place and restores the original toolbar trigger', async () => {
		await page.viewport(320, 720);
		const host = createTrackedToolbarHost('320px');
		const screen = await render(WishlistDetailToolbar, defaultProps, { baseElement: host });
		const sortTrigger = screen
			.getByTestId('mobile-sort-trigger')
			.element() as HTMLButtonElement;

		await sortTrigger.click();
		await expect.element(screen.getByRole('dialog', { name: m.gift_sort_by() })).toBeVisible();
		const switchButtons = [
			screen.getByTestId('mobile-sheet-sort-switch'),
			screen.getByTestId('mobile-sheet-grouping-switch'),
			screen.getByTestId('mobile-sheet-filter-switch'),
		];
		const closeButton = screen.getByRole('button', { name: m.close() });
		for (const button of [...switchButtons, closeButton]) {
			const rectangle = button.element().getBoundingClientRect();
			expect(rectangle.width).toBeGreaterThanOrEqual(40);
			expect(rectangle.height).toBeGreaterThanOrEqual(40);
		}

		await switchButtons[1].click();
		expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_grouping_label() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_sort_by() }))
			.not.toBeInTheDocument();
		await userEvent.keyboard('{Escape}');
		await awaitAnimationFrames();
		expect(document.activeElement).toBe(sortTrigger);
		await screen.unmount();
		host.remove();
	});

	it('restores exact trigger focus without moving page or toolbar when a sheet closes', async () => {
		const host = createTrackedToolbarHost('390px');
		const screen = await render(WishlistDetailToolbar, defaultProps, { baseElement: host });
		const trigger = screen.getByTestId('mobile-sort-trigger').element() as HTMLButtonElement;
		const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
		const before = toolbar.getBoundingClientRect();
		const previousMinHeight = document.body.style.minHeight;
		document.body.style.minHeight = '200vh';
		await new Promise(requestAnimationFrame);
		window.scrollTo(0, 17);
		await new Promise(requestAnimationFrame);
		const scrollBeforeOpen = window.scrollY;
		await trigger.click();
		await userEvent.keyboard('{Escape}');
		await awaitAnimationFrames();
		expect(document.activeElement).toBe(trigger);
		expect(window.scrollY).toBe(scrollBeforeOpen);
		const after = toolbar.getBoundingClientRect();
		expect(after.width).toBe(before.width);
		expect(after.height).toBe(before.height);
		await screen.unmount();
		host.remove();
		document.body.style.minHeight = previousMinHeight;
		window.scrollTo(0, 0);
	});

	it('clears all active filters from the mobile filter sheet in one callback', async () => {
		const onfilterchange = vi.fn();
		const screen = await renderToolbar({
			onfilterchange,
			filters: {
				...defaultProps.filters,
				withLinkOnly: true,
				categoryValues: ['category-1'],
			},
			categoryFilterOptions: [{ value: 'category-1', label: 'Kategorie' }],
		});

		await screen.getByTestId('mobile-filter-trigger').click();
		await screen.getByRole('button', { name: m.wishlist_detail_clear_filters() }).click();

		expect(onfilterchange).toHaveBeenCalledExactlyOnceWith(defaultProps.filters);
		await screen.unmount();
	});

	it('clears an open mobile sheet across the sm breakpoint', async () => {
		const host = createTrackedToolbarHost('390px');
		const screen = await render(WishlistDetailToolbar, defaultProps, { baseElement: host });

		await screen.getByTestId('mobile-sort-trigger').click();
		await expect.element(screen.getByRole('dialog', { name: m.gift_sort_by() })).toBeVisible();
		await page.viewport(640, 720);
		await awaitAnimationFrames();
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_sort_by() }))
			.not.toBeInTheDocument();
		await page.viewport(390, 720);
		await awaitAnimationFrames();
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_sort_by() }))
			.not.toBeInTheDocument();

		await screen.unmount();
		host.remove();
	});

	it('discards pointer-cancel scroll capture before keyboard sheet opening', async () => {
		const host = createTrackedToolbarHost('390px');
		const previousMinHeight = document.body.style.minHeight;
		let screen: Awaited<ReturnType<typeof render>> | null = null;
		try {
			document.body.style.minHeight = '300vh';
			screen = await render(WishlistDetailToolbar, defaultProps, { baseElement: host });
			const trigger = screen
				.getByTestId('mobile-sort-trigger')
				.element() as HTMLButtonElement;
			window.scrollTo(0, 17);
			await new Promise(requestAnimationFrame);
			trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
			trigger.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
			window.scrollTo(0, 83);
			await new Promise(requestAnimationFrame);
			const laterScrollPosition = window.scrollY;
			trigger.focus();
			await userEvent.keyboard('{Enter}');
			await expect
				.element(screen.getByRole('dialog', { name: m.gift_sort_by() }))
				.toBeVisible();
			await userEvent.keyboard('{Escape}');
			await awaitAnimationFrames();
			expect(window.scrollY).toBe(laterScrollPosition);
		} finally {
			await screen?.unmount();
			host.remove();
			document.body.style.minHeight = previousMinHeight;
			window.scrollTo(0, 0);
		}
	});

	it('shows an active-count badge, hides mobile pills, and reset preserves view mode', async () => {
		const callbacks = {
			onfilterchange: vi.fn(),
			onsortchange: vi.fn(),
			ongroupingchange: vi.fn(),
			onviewmodechange: vi.fn(),
		};
		const host = createTrackedToolbarHost('390px');
		const screen = await render(
			WishlistDetailToolbar,
			{
				...defaultProps,
				...callbacks,
				viewMode: GIFT_VIEW_MODES.list,
				sortOption: GIFT_SORT_OPTIONS.name,
				grouping: GIFT_GROUPING_OPTIONS.priority,
				filters: { ...defaultProps.filters, withLinkOnly: true },
			},
			{ baseElement: host },
		);
		const mobile = screen.getByTestId('wishlist-toolbar-mobile').element();
		expect(mobile.querySelector('[data-filter-count]')).toHaveTextContent('1');
		expect(mobile.querySelector('[data-active-filter-pill]')).toBeNull();
		await screen.getByTestId('mobile-reset-trigger').click();
		expect(callbacks.onfilterchange).toHaveBeenCalledWith(defaultProps.filters);
		expect(callbacks.onsortchange).toHaveBeenCalledWith(GIFT_SORT_OPTIONS.ownerOrder);
		expect(callbacks.ongroupingchange).toHaveBeenCalledWith(GIFT_GROUPING_OPTIONS.none);
		expect(callbacks.onviewmodechange).not.toHaveBeenCalled();
		await screen.unmount();
		host.remove();
	});

	it('keeps authenticated visitor preview and unfollow controls in one visible placement', async () => {
		for (const [width, expectedRows] of [
			[390, 2],
			[400, 1],
		] as const) {
			await page.viewport(width, 720);
			const host = createTrackedToolbarHost(`${width - 32}px`);
			const screen = await render(
				WishlistDetailToolbar,
				{
					...defaultProps,
					isAuthenticated: true,
					sortOption: GIFT_SORT_OPTIONS.name,
				},
				{ baseElement: host },
			);
			const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
			const visibleRows = Array.from(
				toolbar.querySelectorAll<HTMLElement>('[data-mobile-toolbar-row]'),
			).filter((row) => row.getClientRects().length > 0);
			expect(visibleRows).toHaveLength(expectedRows);
			for (const row of visibleRows) {
				expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
			}
			if (width === 400) {
				expect(toolbar.getBoundingClientRect().height).toBeLessThanOrEqual(60);
			}
			const visibleButtons = Array.from(
				toolbar.querySelectorAll<HTMLButtonElement>('button'),
			).filter((button) => button.getClientRects().length > 0);
			expect(
				visibleButtons.filter(
					(button) => button.getAttribute('aria-label') === m.wishlist_detail_unfollow(),
				),
			).toHaveLength(1);
			expect(
				visibleButtons.filter(
					(button) =>
						button.getAttribute('aria-label') === m.recipient_view_preview_turn_on(),
				),
			).toHaveLength(1);
			await screen.unmount();
			host.remove();
		}
	});

	it('invokes management callbacks only when the recipient role exposes their actions', async () => {
		const callbacks = {
			onsettings: vi.fn(),
			onbatchadd: vi.fn(),
			onaddgift: vi.fn(),
		};
		const recipient = await renderToolbar({
			...callbacks,
			canManage: true,
			role: WISHLIST_ROLES.recipient,
		});

		await recipient.getByRole('button', { name: m.wishlist_settings_title() }).click();
		await recipient.getByRole('button', { name: m.batch_add_toolbar_label() }).click();
		await recipient.getByRole('button', { name: m.wishlist_detail_add_gift_label() }).click();
		expect(callbacks.onsettings).toHaveBeenCalledOnce();
		expect(callbacks.onbatchadd).toHaveBeenCalledOnce();
		expect(callbacks.onaddgift).toHaveBeenCalledOnce();
		await recipient.unmount();

		const visitor = await renderToolbar({ ...callbacks, canManage: false });
		await expect
			.element(visitor.getByRole('button', { name: m.wishlist_settings_title() }))
			.not.toBeInTheDocument();
		await expect
			.element(visitor.getByRole('button', { name: m.batch_add_toolbar_label() }))
			.not.toBeInTheDocument();
		await expect
			.element(visitor.getByRole('button', { name: m.wishlist_detail_add_gift_label() }))
			.not.toBeInTheDocument();
		await visitor.unmount();
	});

	it('activates filter row text once and internally scrolls long filter content', async () => {
		const onfilterchange = vi.fn();
		const categoryFilterOptions = Array.from({ length: 30 }, (_, index) => ({
			value: `category-${index}`,
			label: `Kategorie ${index}`,
		}));
		const screen = await renderToolbar({ onfilterchange, categoryFilterOptions });
		await screen.getByTestId('mobile-filter-trigger').click();
		const checkbox = screen
			.getByRole('checkbox', { name: m.gift_filter_with_link() })
			.element();
		await (checkbox.parentElement!.querySelector('span') as HTMLElement).click();
		expect(onfilterchange).toHaveBeenCalledTimes(1);
		expect(onfilterchange).toHaveBeenCalledWith({
			...defaultProps.filters,
			withLinkOnly: true,
		});
		const scrollRegion = screen.getByTestId('mobile-sheet-scroll').element() as HTMLElement;
		expect(getComputedStyle(scrollRegion).overflowY).toBe('auto');
		expect(scrollRegion.scrollHeight).toBeGreaterThan(scrollRegion.clientHeight);
		await screen.unmount();
	});

	it('renders exactly one viewport-specific view control immediately', async () => {
		for (const width of [390, 1280]) {
			await page.viewport(width, 720);
			const screen = await render(WishlistDetailToolbar, defaultProps);

			expect(document.querySelectorAll('[aria-label="Karta"]')).toHaveLength(1);
			expect(
				document.querySelectorAll('[data-testid="wishlist-toolbar-mobile"]'),
			).toHaveLength(width < 640 ? 1 : 0);
			expect(document.querySelectorAll('.toolbar-desktop')).toHaveLength(width < 640 ? 0 : 1);

			await screen.unmount();
		}
	});

	it('uses the viewport sm breakpoint even when the content column is narrower', async () => {
		await page.viewport(640, 720);
		const host = createTrackedToolbarHost('608px');
		const screen = await render(WishlistDetailToolbar, defaultProps, { baseElement: host });
		expect(host.querySelector('[data-testid="wishlist-toolbar-mobile"]')).toBeNull();
		const desktop = host.querySelector('.toolbar-desktop') as HTMLElement;
		expect(getComputedStyle(desktop).display).toBe('block');
		await expect
			.element(
				screen.getByRole('button', {
					name: `${m.gift_sort_by()}: ${m.gift_sort_owner_order()}`,
				}),
			)
			.toBeVisible();
		await screen.unmount();
		host.remove();
	});
});

describe('WishlistDetailToolbar recipient-view preview (#241)', () => {
	it('shows the compact pressed preview button to visitors and moderators, but never recipients', async () => {
		for (const role of [WISHLIST_ROLES.visitor, WISHLIST_ROLES.moderator]) {
			const screen = await renderToolbar({ role });
			await expect
				.element(screen.getByRole('button', { name: m.recipient_view_preview_turn_on() }))
				.toBeVisible();
			await screen.unmount();
		}

		const recipientScreen = await renderToolbar({
			role: WISHLIST_ROLES.recipient,
			canManage: true,
			adminSettingsAvailable: true,
		});
		await expect
			.element(
				recipientScreen.getByRole('button', { name: m.recipient_view_preview_turn_on() }),
			)
			.not.toBeInTheDocument();
		await recipientScreen.unmount();
	});

	it('reports the pressed toggle without changing manager authorization or reorder state', async () => {
		const onrecipientviewpreviewchange = vi.fn();
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.moderator,
			recipientViewPreview: true,
			onrecipientviewpreviewchange,
		});

		const previewButton = screen.getByRole('button', {
			name: m.recipient_view_preview_turn_off(),
		});
		await expect.element(previewButton).toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(screen.getByRole('button', { name: m.gift_reorder_action() }))
			.toBeVisible();
		await previewButton.click();
		expect(onrecipientviewpreviewchange).toHaveBeenCalledWith(false);
		await screen.unmount();
	});
});

describe('WishlistDetailToolbar manager actions (#241)', () => {
	it('does not render or reserve a row for actionless visitor and archived variants', async () => {
		for (const overrides of [
			{},
			{ role: WISHLIST_ROLES.recipient, canManage: true, isArchived: true },
			{ role: WISHLIST_ROLES.moderator, canManage: true, isArchived: true },
		]) {
			const screen = await renderToolbar(overrides);
			const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
			const controls = screen.getByTestId('wishlist-toolbar-controls').element();

			await expect
				.element(screen.getByTestId('wishlist-toolbar-actions'))
				.not.toBeInTheDocument();
			expect(
				toolbar.getBoundingClientRect().height - controls.getBoundingClientRect().height,
			).toBeLessThanOrEqual(24);
			await screen.unmount();
		}
	});

	it('places the authenticated visitor action by intrinsic fit and wraps it just below', async () => {
		const host = document.createElement('div');
		host.style.width = '1200px';
		document.body.appendChild(host);
		const screen = await render(
			WishlistDetailToolbar,
			{ ...defaultProps, isAuthenticated: true },
			{ baseElement: host },
		);
		await new Promise(requestAnimationFrame);
		const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
		const controls = screen.getByTestId('wishlist-toolbar-controls').element() as HTMLElement;
		const actions = screen.getByTestId('wishlist-toolbar-actions').element() as HTMLElement;
		const layout = controls.parentElement as HTMLElement;
		const requiredContentWidth =
			controls.getBoundingClientRect().width +
			actions.getBoundingClientRect().width +
			parseFloat(getComputedStyle(layout).columnGap);
		const chromeWidth =
			toolbar.getBoundingClientRect().width - layout.getBoundingClientRect().width;

		host.style.width = `${Math.ceil(requiredContentWidth + chromeWidth)}px`;
		await new Promise(requestAnimationFrame);
		expect(
			Math.abs(controls.getBoundingClientRect().top - actions.getBoundingClientRect().top),
		).toBeLessThan(1);

		host.style.width = `${Math.floor(requiredContentWidth + chromeWidth) - 1}px`;
		await new Promise(requestAnimationFrame);
		expect(actions.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			controls.getBoundingClientRect().bottom,
		);
		await screen.unmount();
		host.remove();
	});

	it('places the settings-only action by intrinsic fit and wraps it just below', async () => {
		const host = document.createElement('div');
		host.style.width = '1200px';
		document.body.appendChild(host);
		const screen = await render(
			WishlistDetailToolbar,
			{
				...defaultProps,
				canManage: false,
				isAuthenticated: false,
				adminSettingsAvailable: true,
			},
			{ baseElement: host },
		);
		await new Promise(requestAnimationFrame);
		const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
		const controls = screen.getByTestId('wishlist-toolbar-controls').element() as HTMLElement;
		const actions = screen.getByTestId('wishlist-toolbar-actions').element() as HTMLElement;
		const settingsButton = screen
			.getByRole('button', { name: m.wishlist_settings_title() })
			.element();
		expect(Array.from(actions.querySelectorAll('button'))).toEqual([settingsButton]);
		const layout = controls.parentElement as HTMLElement;
		const requiredContentWidth =
			controls.getBoundingClientRect().width +
			actions.getBoundingClientRect().width +
			parseFloat(getComputedStyle(layout).columnGap);
		const chromeWidth =
			toolbar.getBoundingClientRect().width - layout.getBoundingClientRect().width;

		host.style.width = `${Math.ceil(requiredContentWidth + chromeWidth)}px`;
		await new Promise(requestAnimationFrame);
		expect(
			Math.abs(controls.getBoundingClientRect().top - actions.getBoundingClientRect().top),
		).toBeLessThan(1);

		host.style.width = `${Math.floor(requiredContentWidth + chromeWidth) - 1}px`;
		await new Promise(requestAnimationFrame);
		expect(actions.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			controls.getBoundingClientRect().bottom,
		);
		await screen.unmount();
		host.remove();
	});

	it('keeps recipient and moderator management actions atomic at their measured fit width', async () => {
		for (const role of [WISHLIST_ROLES.recipient, WISHLIST_ROLES.moderator]) {
			const host = document.createElement('div');
			host.style.width = '1200px';
			document.body.appendChild(host);
			const screen = await render(
				WishlistDetailToolbar,
				{ ...defaultProps, canManage: true, role },
				{ baseElement: host },
			);
			await new Promise(requestAnimationFrame);
			const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
			const controls = screen
				.getByTestId('wishlist-toolbar-controls')
				.element() as HTMLElement;
			const actions = screen.getByTestId('wishlist-toolbar-actions').element() as HTMLElement;
			const layout = controls.parentElement as HTMLElement;
			const requiredWidth = Math.ceil(
				controls.getBoundingClientRect().width +
					actions.getBoundingClientRect().width +
					parseFloat(getComputedStyle(layout).columnGap) +
					(toolbar.getBoundingClientRect().width - layout.getBoundingClientRect().width),
			);
			host.style.width = `${requiredWidth}px`;
			await new Promise(requestAnimationFrame);

			expect(
				Math.abs(
					controls.getBoundingClientRect().top - actions.getBoundingClientRect().top,
				),
			).toBeLessThan(1);
			const buttons = Array.from(actions.querySelectorAll('button'));
			expectDocumentOrder(buttons);
			expect(new Set(buttons.map((button) => button.getBoundingClientRect().top)).size).toBe(
				1,
			);
			await screen.unmount();
			host.remove();
		}
	});

	it('keeps import, export, and palette out of the detail toolbar', async () => {
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.moderator,
		});

		await expect
			.element(screen.getByRole('button', { name: m.wishlist_settings_title() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.batch_add_toolbar_label() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.import_toolbar_label() }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.export_toolbar_label() }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_palette_dialog_title() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});
});

describe('WishlistDetailToolbar reorder mode (#239)', () => {
	it('offers reorder only to managers on non-archived card and list layouts', async () => {
		for (const viewMode of [GIFT_VIEW_MODES.card, GIFT_VIEW_MODES.list]) {
			const screen = await renderToolbar({
				canManage: true,
				role: WISHLIST_ROLES.moderator,
				viewMode,
			});
			await expect
				.element(screen.getByRole('button', { name: m.gift_reorder_action() }))
				.toBeVisible();
			await screen.unmount();
		}

		for (const overrides of [
			{ canManage: false },
			{ canManage: true, role: WISHLIST_ROLES.visitor },
			{ canManage: true, role: WISHLIST_ROLES.moderator, isArchived: true },
			{
				canManage: true,
				role: WISHLIST_ROLES.recipient,
				viewMode: GIFT_VIEW_MODES.compact,
			},
		]) {
			const screen = await renderToolbar(overrides);
			await expect
				.element(screen.getByRole('button', { name: m.gift_reorder_action() }))
				.not.toBeInTheDocument();
			await screen.unmount();
		}
	});

	it('morphs the reorder action in place without replacing or collapsing toolbar regions', async () => {
		const onreordermodechange = vi.fn();
		const props = {
			...defaultProps,
			canManage: true,
			role: WISHLIST_ROLES.recipient,
			onreordermodechange,
		};
		const screen = await renderToolbar(props);
		const toolbar = screen.getByTestId('wishlist-toolbar').element();
		const layout = toolbar.querySelector('.toolbar-layout');
		const controls = screen.getByTestId('wishlist-toolbar-controls').element();
		const viewControls = screen.getByTestId('wishlist-toolbar-view-controls').element();
		const displayControls = screen.getByTestId('wishlist-toolbar-display-controls').element();
		const editControls = screen.getByTestId('wishlist-toolbar-edit-controls').element();
		const actions = screen.getByTestId('wishlist-toolbar-actions').element();
		const reorderButton = screen
			.getByRole('button', { name: m.gift_reorder_action() })
			.element() as HTMLButtonElement;
		const regionOrder = [viewControls, displayControls, editControls, actions];
		const reorderWidth = reorderButton.getBoundingClientRect().width;

		reorderButton.focus();
		await reorderButton.click();
		expect(onreordermodechange).toHaveBeenCalledWith(true);
		await screen.rerender({ ...props, reorderMode: true });

		const doneButton = screen
			.getByRole('button', { name: m.gift_reorder_done() })
			.element() as HTMLButtonElement;
		expect(doneButton).toBe(reorderButton);
		expect(document.activeElement).toBe(doneButton);
		expect(screen.getByTestId('wishlist-toolbar-controls').element()).toBe(controls);
		expect(toolbar.querySelector('.toolbar-layout')).toBe(layout);
		expectDocumentOrder(regionOrder);
		for (const region of regionOrder) {
			expect(region.isConnected).toBe(true);
		}
		const doneIcon = doneButton.querySelector('[data-toolbar-icon="reorder-done"]')!;
		const doneLabel = doneButton.querySelector('[data-reorder-mode-label]')!;
		expect(doneIcon).not.toBeNull();
		expect(doneButton.getBoundingClientRect().width).toBeCloseTo(reorderWidth, 1);
		expect(getComputedStyle(doneButton).transitionDuration).toContain('0.2s');
		expect(getComputedStyle(doneIcon).transitionDuration).toContain('0.2s');
		expect(getComputedStyle(doneLabel).transitionDuration).toContain('0.2s');
		await screen.unmount();
	});

	it('announces reorder mode entry and exit through one polite live region', async () => {
		const props = {
			...defaultProps,
			canManage: true,
			role: WISHLIST_ROLES.recipient,
		};
		const screen = await renderToolbar(props);
		const liveRegion = screen.getByRole('status').element();
		expect(liveRegion).toHaveAttribute('aria-live', 'polite');
		expect(liveRegion).toHaveTextContent('');

		await screen.rerender({ ...props, reorderMode: true });
		expect(liveRegion).toHaveTextContent(m.gift_reorder_mode_entered());
		await screen.rerender({ ...props, reorderMode: false });
		expect(liveRegion).toHaveTextContent(m.gift_reorder_mode_exited());
		await screen.unmount();
	});

	it('disables every incompatible toolbar callback and removes its control from tab order', async () => {
		const callbacks = {
			onrecipientviewpreviewchange: vi.fn(),
			onviewmodechange: vi.fn(),
			onsortchange: vi.fn(),
			onfilterchange: vi.fn(),
			onsettings: vi.fn(),
			onaddgift: vi.fn(),
			onbatchadd: vi.fn(),
			onunfollow: vi.fn(),
			onreordermodechange: vi.fn(),
		};
		const ongroupingchange = vi.fn();
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.moderator,
			reorderMode: true,
			sortOption: GIFT_SORT_OPTIONS.name,
			groupingAvailability: { priority: true, category: true },
			...callbacks,
			ongroupingchange,
		});
		const doneButton = screen
			.getByRole('button', { name: m.gift_reorder_done() })
			.element() as HTMLButtonElement;
		const incompatibleButtons = Array.from(
			screen.getByTestId('wishlist-toolbar').element().querySelectorAll('button'),
		).filter(
			(button) => button !== doneButton && button.getClientRects().length > 0,
		) as HTMLButtonElement[];

		expect(incompatibleButtons.length).toBeGreaterThan(8);
		for (const button of incompatibleButtons) {
			expect(
				button.disabled,
				button.getAttribute('aria-label') ?? button.textContent ?? '',
			).toBe(true);
			expect(button.matches(':disabled')).toBe(true);
			button.click();
		}
		expect(doneButton.disabled).toBe(false);
		expect(doneButton.tabIndex).toBe(0);
		for (const callback of Object.values(callbacks)) {
			expect(callback).not.toHaveBeenCalled();
		}
		expect(ongroupingchange).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('omits active-filter pills from mobile reorder chrome', async () => {
		await page.viewport(320, 720);
		const host = document.createElement('div');
		host.style.width = '320px';
		document.body.appendChild(host);
		const onfilterchange = vi.fn();
		const screen = await render(
			WishlistDetailToolbar,
			{
				...defaultProps,
				canManage: true,
				role: WISHLIST_ROLES.recipient,
				reorderMode: true,
				filters: { ...defaultProps.filters, withLinkOnly: true },
				onfilterchange,
			},
			{ baseElement: host },
		);
		const mobile = screen.getByTestId('wishlist-toolbar-mobile').element();
		expect(mobile.querySelector('[data-active-filter-pill]')).toBeNull();
		expect(mobile.querySelector('[data-filter-count]')).toBeNull();
		expect(onfilterchange).not.toHaveBeenCalled();
		await screen.unmount();
		host.remove();
		await page.viewport(1280, 720);
	});
});

describe('WishlistDetailToolbar collision-proof regions', () => {
	it('uses 32px component variants with semantic controls in the specified wide order', async () => {
		const host = document.createElement('div');
		host.style.width = '70rem';
		document.body.appendChild(host);
		const screen = await render(
			WishlistDetailToolbar,
			{
				...defaultProps,
				canManage: true,
				role: WISHLIST_ROLES.moderator,
				sortOption: GIFT_SORT_OPTIONS.name,
			},
			{ baseElement: host },
		);
		await new Promise(requestAnimationFrame);

		const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
		const controls = screen.getByTestId('wishlist-toolbar-controls').element();
		const actions = screen.getByTestId('wishlist-toolbar-actions').element();
		const controlButtons = Array.from(controls.querySelectorAll('button'));
		const actionButtons = Array.from(actions.querySelectorAll('button'));
		const sortCombinedLabel = `${m.gift_sort_by()}: ${m.gift_sort_name()}`;
		const groupingCombinedLabel = `${m.gift_grouping_label()}: ${m.gift_grouping_none()}`;
		const sortTrigger = screen.getByRole('button', { name: sortCombinedLabel }).element();
		const groupingTrigger = screen
			.getByRole('button', { name: groupingCombinedLabel })
			.element();
		const filterTrigger = screen.getByRole('button', { name: m.gift_filter() }).element();
		const resetButton = screen
			.getByRole('button', { name: m.gift_display_reset_aria() })
			.element();
		const reorderButton = screen
			.getByRole('button', { name: m.gift_reorder_action() })
			.element();
		const settingsButton = screen
			.getByRole('button', { name: m.wishlist_settings_title() })
			.element();
		const batchButton = screen
			.getByRole('button', { name: m.batch_add_toolbar_label() })
			.element();
		const addButton = screen
			.getByRole('button', { name: m.wishlist_detail_add_gift_label() })
			.element();

		expect(sortTrigger).toHaveAttribute('title', sortCombinedLabel);
		expect(groupingTrigger).toHaveAttribute('title', groupingCombinedLabel);
		expectToolbarIcon(sortTrigger, 'sort');
		expectToolbarIcon(groupingTrigger, 'grouping');
		expectToolbarIcon(filterTrigger, 'filter');
		expectToolbarIcon(resetButton, 'reset');
		expectToolbarIcon(reorderButton, 'reorder');
		expect(sortTrigger.querySelectorAll('svg')).toHaveLength(2);
		expect(groupingTrigger.querySelectorAll('svg')).toHaveLength(2);
		expect(filterTrigger.querySelectorAll('svg')).toHaveLength(2);
		const displayControlsInOrder = [
			screen.getByTestId('gift-view-switcher').element(),
			sortTrigger,
			groupingTrigger,
			filterTrigger,
			resetButton,
			reorderButton,
		];
		expectDocumentOrder(displayControlsInOrder);
		for (const [index, control] of displayControlsInOrder.slice(0, -1).entries()) {
			expect(control.getBoundingClientRect().right).toBeLessThanOrEqual(
				displayControlsInOrder[index + 1]!.getBoundingClientRect().left,
			);
		}
		expectDocumentOrder([settingsButton, batchButton, addButton]);

		expect(controlButtons.length).toBeGreaterThan(0);
		expect(actionButtons).toEqual([settingsButton, batchButton, addButton]);
		const allToolbarButtons = [...controlButtons, ...actionButtons];
		for (const button of allToolbarButtons) {
			expect(
				getComputedStyle(button).height,
				button.getAttribute('aria-label') ?? button.textContent ?? 'toolbar control',
			).toBe('32px');
		}
		expect(
			Math.max(...allToolbarButtons.map((button) => button.getBoundingClientRect().height)) -
				Math.min(
					...allToolbarButtons.map((button) => button.getBoundingClientRect().height),
				),
		).toBeLessThan(0.5);

		const controlsRect = controls.getBoundingClientRect();
		const actionsRect = actions.getBoundingClientRect();
		expect(Math.abs(controlsRect.top - actionsRect.top)).toBeLessThan(0.5);
		expect(Math.abs(controlsRect.bottom - actionsRect.bottom)).toBeLessThan(0.5);
		expect(actionsRect.left).toBeGreaterThanOrEqual(controlsRect.right);
		expect(
			new Set(actionButtons.map((button) => button.getBoundingClientRect().top)).size,
		).toBe(1);
		expect(toolbar.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth);
		await screen.unmount();
		host.remove();
	});

	it('starts long active filters on a dedicated full row after controls and atomic actions', async () => {
		const host = document.createElement('div');
		host.style.width = '1120px';
		document.body.appendChild(host);
		const screen = await render(
			WishlistDetailToolbar,
			{
				...defaultProps,
				canManage: true,
				role: WISHLIST_ROLES.moderator,
				filters: {
					...defaultProps.filters,
					withLinkOnly: true,
					showReceived: true,
					categoryValues: ['category-one', 'category-two'],
					priorityValues: ['priority-high', 'priority-medium', 'priority-low'],
				},
				categoryFilterOptions: [
					{ value: 'category-one', label: 'A very long first category name' },
					{ value: 'category-two', label: 'A very long second category name' },
				],
				priorityFilterOptions: [
					{ value: 'priority-high', label: 'High priority' },
					{ value: 'priority-medium', label: 'Medium priority' },
					{ value: 'priority-low', label: 'Low priority' },
				],
			},
			{ baseElement: host },
		);
		await new Promise(requestAnimationFrame);
		const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
		const controls = screen.getByTestId('wishlist-toolbar-controls').element();
		const pills = screen.getByTestId('wishlist-toolbar-active-filters').element();
		const actions = screen.getByTestId('wishlist-toolbar-actions').element();
		const actionButtons = Array.from(actions.querySelectorAll('button'));

		for (const width of [680, 800, 1120]) {
			host.style.width = `${width}px`;
			await new Promise(requestAnimationFrame);
			const toolbarRect = toolbar.getBoundingClientRect();
			const controlsRect = controls.getBoundingClientRect();
			const pillsRect = pills.getBoundingClientRect();
			const actionsRect = actions.getBoundingClientRect();
			const layoutRect = pills.parentElement!.getBoundingClientRect();

			expect(getComputedStyle(pills).display).toBe('flex');
			const pillRemoveButtons = Array.from(
				pills.querySelectorAll<HTMLButtonElement>('button[aria-label]'),
			);
			expect(pillRemoveButtons).toHaveLength(7);
			for (const button of pillRemoveButtons) {
				const rectangle = button.getBoundingClientRect();
				expect(rectangle.width).toBeGreaterThan(0);
				expect(rectangle.height).toBeGreaterThan(0);
				expect(rectangle.left).toBeGreaterThanOrEqual(toolbarRect.left);
				expect(rectangle.right).toBeLessThanOrEqual(toolbarRect.right);
				expect(rectangle.top).toBeGreaterThanOrEqual(toolbarRect.top);
				expect(rectangle.bottom).toBeLessThanOrEqual(toolbarRect.bottom);
			}
			expectDocumentOrder([controls, pills, actions]);
			const roundingTolerance = 0.5;
			expect(pillsRect.top).toBeGreaterThanOrEqual(
				Math.max(controlsRect.bottom, actionsRect.bottom) - roundingTolerance,
			);
			expect(Math.abs(pillsRect.left - layoutRect.left)).toBeLessThanOrEqual(
				roundingTolerance,
			);
			expect(Math.abs(pillsRect.right - layoutRect.right)).toBeLessThanOrEqual(
				roundingTolerance,
			);

			const visibleControlButtons = Array.from(controls.querySelectorAll('button')).filter(
				(button) => {
					const rectangle = button.getBoundingClientRect();
					return rectangle.width > 0 && rectangle.height > 0;
				},
			);
			const actionButtonRects = actionButtons.map((button) => button.getBoundingClientRect());
			for (const button of [...visibleControlButtons, ...actionButtons]) {
				expect(
					getComputedStyle(button).height,
					`${button.getAttribute('aria-label') ?? button.textContent} height at ${width}px`,
				).toBe('32px');
				const buttonRect = button.getBoundingClientRect();
				expect(buttonRect.left).toBeGreaterThanOrEqual(toolbarRect.left);
				expect(buttonRect.right).toBeLessThanOrEqual(toolbarRect.right);
				expect(buttonRect.top).toBeGreaterThanOrEqual(toolbarRect.top);
				expect(buttonRect.bottom).toBeLessThanOrEqual(toolbarRect.bottom);
			}
			for (const controlButton of visibleControlButtons) {
				for (const actionButton of actionButtons) {
					expect(
						rectanglesIntersect(
							controlButton.getBoundingClientRect(),
							actionButton.getBoundingClientRect(),
						),
						`${controlButton.getAttribute('aria-label') ?? controlButton.textContent} must not overlap ${actionButton.getAttribute('aria-label') ?? actionButton.textContent} at ${width}px`,
					).toBe(false);
				}
			}
			expect(rectanglesIntersect(controlsRect, pillsRect)).toBe(false);
			expect(rectanglesIntersect(actionsRect, pillsRect)).toBe(false);
			if (width <= 390) {
				const sortTrigger = screen
					.getByRole('button', {
						name: `${m.gift_sort_by()}: ${m.gift_sort_owner_order()}`,
					})
					.element() as HTMLButtonElement;
				const groupingTrigger = screen
					.getByRole('button', {
						name: `${m.gift_grouping_label()}: ${m.gift_grouping_none()}`,
					})
					.element() as HTMLButtonElement;
				const filterTrigger = screen
					.getByRole('button', { name: new RegExp(`^${m.gift_filter()}:`) })
					.element();
				const resetButton = screen
					.getByRole('button', { name: m.gift_display_reset_aria() })
					.element();
				for (const trigger of [sortTrigger, groupingTrigger]) {
					expect(
						trigger.getBoundingClientRect().width,
						`${trigger.getAttribute('aria-label')} must stay content-width at ${width}px`,
					).toBeLessThanOrEqual(measureNaturalWidth(trigger) + 0.5);
				}
				const filterRect = filterTrigger.getBoundingClientRect();
				const resetRect = resetButton.getBoundingClientRect();
				expect(Math.abs(filterRect.top - resetRect.top)).toBeLessThan(0.5);
				expect(resetRect.left - filterRect.right).toBeGreaterThanOrEqual(0);
				expect(resetRect.left - filterRect.right).toBeLessThanOrEqual(10);
			}
			for (const [index, actionButtonRect] of actionButtonRects.slice(0, -1).entries()) {
				expect(actionButtonRect.right).toBeLessThanOrEqual(
					actionButtonRects[index + 1]!.left,
				);
			}
			expect(new Set(actionButtonRects.map(({ top }) => top)).size).toBe(1);
			expect(
				Math.abs(actionsRect.left - Math.min(...actionButtonRects.map(({ left }) => left))),
			).toBeLessThan(0.5);
			expect(
				Math.abs(
					actionsRect.right - Math.max(...actionButtonRects.map(({ right }) => right)),
				),
			).toBeLessThan(0.5);
			expect(toolbarRect.right - actionsRect.right).toBeLessThan(20);
			expect(toolbar.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth);
		}
		await screen.unmount();
		host.remove();
	});

	it('omits the persistent active-filter region when there are no active filters', async () => {
		const screen = await renderToolbar();
		await expect
			.element(screen.getByTestId('wishlist-toolbar-active-filters'))
			.not.toBeInTheDocument();
		await screen.unmount();
	});
});

describe('WishlistDetailToolbar filter motion', () => {
	it('acknowledges the active count and keyed pills in place over 220 ms', async () => {
		const screen = await renderToolbar({
			filters: { ...defaultProps.filters, withLinkOnly: true },
		});
		const desktop = document.querySelector<HTMLElement>('.toolbar-desktop')!;
		const count = desktop.querySelector<HTMLElement>('[data-filter-count]');
		const pill = desktop.querySelector<HTMLElement>('[data-active-filter-pill]');

		expect(count).not.toBeNull();
		expect(pill).not.toBeNull();
		expect(getComputedStyle(count!).animationDuration).toBe('0.22s');
		expect(getComputedStyle(pill!).animationDuration).toBe('0.22s');
		expect(getComputedStyle(count!).animationName).not.toBe('none');
		expect(getComputedStyle(pill!).animationName).not.toBe('none');
		await screen.unmount();
	});
});

describe('WishlistDetailToolbar unified filters (issue #161)', () => {
	it('shows only the recipient filter options', async () => {
		const screen = await renderToolbar({
			role: WISHLIST_ROLES.recipient,
			isAuthenticated: true,
		});
		await screen.getByRole('button', { name: m.gift_filter() }).click();
		await expect
			.element(screen.getByRole('menuitemcheckbox', { name: m.gift_filter_with_link() }))
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('menuitemcheckbox', {
					name: m.gift_filter_available_only(),
				}),
			)
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('menuitemcheckbox', { name: m.gift_filter_liked() }))
			.not.toBeInTheDocument();
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	}, 30_000);

	it('shows anonymous visitor filter options', async () => {
		const screen = await renderToolbar();
		await screen.getByRole('button', { name: m.gift_filter() }).click();
		await expect
			.element(
				screen.getByRole('menuitemcheckbox', {
					name: m.gift_filter_available_only(),
				}),
			)
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('menuitemcheckbox', {
					name: m.gift_filter_with_link(),
				}),
			)
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('menuitemcheckbox', {
					name: m.gift_filter_liked(),
				}),
			)
			.not.toBeInTheDocument();
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	});

	it('shows authenticated visitor filter options', async () => {
		const screen = await renderToolbar({ isAuthenticated: true });
		await screen.getByRole('button', { name: m.gift_filter() }).click();
		for (const filterLabel of [
			m.gift_filter_available_only(),
			m.gift_filter_with_link(),
			m.gift_filter_liked(),
		]) {
			await expect
				.element(screen.getByRole('menuitemcheckbox', { name: filterLabel }))
				.toBeVisible();
		}
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	});

	it('clears every active gift filter in one callback', async () => {
		const onfilterchange = vi.fn();
		const screen = await renderToolbar({
			isAuthenticated: true,
			filters: {
				availableOnly: true,
				withLinkOnly: true,
				likedOnly: true,
				showReceived: true,
				categoryValues: ['books'],
				priorityValues: ['high'],
			},
			onfilterchange,
		});

		await screen.getByRole('button', { name: new RegExp(`^${m.gift_filter()}:`) }).click();
		await screen.getByRole('menuitem', { name: m.wishlist_detail_clear_filters() }).click();

		expect(onfilterchange).toHaveBeenCalledTimes(1);
		expect(onfilterchange).toHaveBeenCalledWith({
			availableOnly: false,
			withLinkOnly: false,
			likedOnly: false,
			showReceived: false,
			categoryValues: [],
			priorityValues: [],
		});
		await screen.unmount();
	});

	it('updates only the selected visible gift filter', async () => {
		const onfilterchange = vi.fn();
		const screen = await renderToolbar({
			isAuthenticated: true,
			filters: {
				availableOnly: false,
				withLinkOnly: false,
				likedOnly: true,
				showReceived: false,
				categoryValues: [],
				priorityValues: [],
			},
			onfilterchange,
		});

		await screen.getByRole('button', { name: m.gift_filter() }).click();
		await screen
			.getByRole('menuitemcheckbox', { name: m.gift_filter_available_only() })
			.click();

		expect(onfilterchange).toHaveBeenCalledWith({
			availableOnly: true,
			withLinkOnly: false,
			likedOnly: true,
			showReceived: false,
			categoryValues: [],
			priorityValues: [],
		});
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	});
});

describe('WishlistDetailToolbar selection layout', () => {
	it('replaces normal display controls and active filter pills with selection content', async () => {
		const selectionContent = vi.fn((() => '') as never);
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.moderator,
			priorityFilterOptions: [{ value: 'none', label: m.gift_priority_none() }],
			filters: {
				availableOnly: false,
				withLinkOnly: false,
				likedOnly: false,
				showReceived: false,
				categoryValues: [],
				priorityValues: ['none'],
			},
			selectionContent,
		});

		expect(selectionContent).toHaveBeenCalled();
		await expect
			.element(screen.getByTestId('wishlist-toolbar-view-controls'))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByTestId('wishlist-toolbar-display-controls'))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByTestId('wishlist-toolbar-active-filters'))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_detail_add_gift_label() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('sticks below the navbar at the sticky token layer', async () => {
		const screen = await renderToolbar();
		const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;

		expect(getComputedStyle(toolbar).top).toBe('12px');
		expect(getComputedStyle(toolbar).zIndex).toBe('30');
		await screen.unmount();
	});
});

describe('WishlistDetailToolbar grouping and reset controls (issue #246)', () => {
	it('switches directly between sort, grouping, and filter menus with one click', async () => {
		const screen = await renderToolbar({
			groupingAvailability: { priority: true, category: true },
		});
		const sortTrigger = screen.getByRole('button', {
			name: `${m.gift_sort_by()}: ${m.gift_sort_owner_order()}`,
		});
		const groupingTrigger = screen.getByRole('button', {
			name: `${m.gift_grouping_label()}: ${m.gift_grouping_none()}`,
		});
		const filterTrigger = screen.getByRole('button', { name: m.gift_filter() });

		await sortTrigger.click();
		await expect
			.element(screen.getByRole('option', { name: m.gift_sort_priority() }))
			.toBeVisible();

		await groupingTrigger.click();
		await expect
			.element(screen.getByRole('option', { name: m.gift_grouping_priority() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('option', { name: m.gift_sort_priority() }))
			.not.toBeInTheDocument();

		await filterTrigger.click();
		await expect
			.element(screen.getByRole('menuitemcheckbox', { name: m.gift_filter_with_link() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('option', { name: m.gift_grouping_priority() }))
			.not.toBeInTheDocument();

		await sortTrigger.click();
		await expect
			.element(screen.getByRole('option', { name: m.gift_sort_priority() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('menuitemcheckbox', { name: m.gift_filter_with_link() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	}, 30_000);

	it('renders grouping as a separate visible selector with unavailable choices disabled', async () => {
		const screen = await renderToolbar({
			groupingAvailability: { priority: true, category: false },
		});

		const groupingLabel = `${m.gift_grouping_label()}: ${m.gift_grouping_none()}`;
		await expect.element(screen.getByRole('button', { name: groupingLabel })).toBeVisible();
		await screen.getByRole('button', { name: groupingLabel }).click();
		await expect
			.element(screen.getByRole('option', { name: m.gift_grouping_priority() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('option', { name: m.gift_grouping_category() }))
			.toHaveAttribute('data-disabled');
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	}, 30_000);

	it('reports grouping changes independently from filters', async () => {
		const ongroupingchange = vi.fn();
		const screen = await renderToolbar({
			groupingAvailability: { priority: true, category: true },
			ongroupingchange,
		});
		await screen
			.getByRole('button', {
				name: `${m.gift_grouping_label()}: ${m.gift_grouping_none()}`,
			})
			.click();
		await screen.getByRole('option', { name: m.gift_grouping_priority() }).click();
		expect(ongroupingchange).toHaveBeenCalledWith(GIFT_GROUPING_OPTIONS.priority);
		await screen.unmount();
	}, 30_000);

	it('renders category and priority facets and counts selected values', async () => {
		const onfilterchange = vi.fn();
		const screen = await renderToolbar({
			filters: {
				availableOnly: false,
				withLinkOnly: false,
				likedOnly: false,
				showReceived: false,
				categoryValues: ['books'],
				priorityValues: [],
			},
			categoryFilterOptions: [
				{ value: 'books', label: 'Knihy' },
				{ value: 'uncategorized', label: m.gift_category_uncategorized() },
			],
			priorityFilterOptions: [{ value: 'high', label: 'Vysoká' }],
			onfilterchange,
		});

		await expect
			.element(
				screen.getByRole('button', {
					name: `${m.gift_filter()}: ${m.filter_active_count({ count: 1 })}`,
				}),
			)
			.toBeVisible();
		await screen
			.getByRole('button', {
				name: `${m.gift_filter()}: ${m.filter_active_count({ count: 1 })}`,
			})
			.click();
		await expect.element(screen.getByRole('menuitemcheckbox', { name: 'Knihy' })).toBeVisible();
		await screen.getByRole('menuitemcheckbox', { name: 'Vysoká' }).click();
		expect(onfilterchange).toHaveBeenCalledWith({
			availableOnly: false,
			withLinkOnly: false,
			likedOnly: false,
			showReceived: false,
			categoryValues: ['books'],
			priorityValues: ['high'],
		});
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	}, 30_000);

	it('resets filters, sort, and grouping without changing view mode', async () => {
		const onfilterchange = vi.fn();
		const onsortchange = vi.fn();
		const ongroupingchange = vi.fn();
		const onviewmodechange = vi.fn();
		const screen = await renderToolbar({
			sortOption: GIFT_SORT_OPTIONS.name,
			grouping: GIFT_GROUPING_OPTIONS.category,
			groupingAvailability: { priority: true, category: true },
			filters: {
				availableOnly: true,
				withLinkOnly: false,
				likedOnly: false,
				showReceived: false,
				categoryValues: ['books'],
				priorityValues: [],
			},
			onfilterchange,
			onsortchange,
			ongroupingchange,
			onviewmodechange,
		});

		await screen.getByRole('button', { name: m.gift_display_reset_aria() }).click();
		expect(onfilterchange).toHaveBeenCalledWith({
			availableOnly: false,
			withLinkOnly: false,
			likedOnly: false,
			showReceived: false,
			categoryValues: [],
			priorityValues: [],
		});
		expect(onsortchange).toHaveBeenCalledWith(GIFT_SORT_OPTIONS.ownerOrder);
		expect(ongroupingchange).toHaveBeenCalledWith(GIFT_GROUPING_OPTIONS.none);
		expect(onviewmodechange).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('hides reset at defaults', async () => {
		const screen = await renderToolbar();
		await expect
			.element(screen.getByRole('button', { name: m.gift_display_reset_aria() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});
});
