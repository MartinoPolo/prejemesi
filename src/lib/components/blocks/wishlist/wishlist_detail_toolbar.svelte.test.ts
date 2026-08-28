import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
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
};

async function renderToolbar(
	overrides: Partial<ComponentProps<typeof WishlistDetailToolbar>> = {},
) {
	return render(WishlistDetailToolbar, { ...defaultProps, ...overrides });
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

	it('shows Done and bypasses display modifiers without changing them', async () => {
		const onreordermodechange = vi.fn();
		const onsortchange = vi.fn();
		const onfilterchange = vi.fn();
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.recipient,
			reorderMode: true,
			onreordermodechange,
			onsortchange,
			onfilterchange,
		});

		await expect
			.element(screen.getByRole('button', { name: m.gift_reorder_done() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.gift_filter() }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.gift_reorder_action() }))
			.not.toBeInTheDocument();
		await screen.getByRole('button', { name: m.gift_reorder_done() }).click();
		expect(onreordermodechange).toHaveBeenCalledWith(false);
		expect(onsortchange).not.toHaveBeenCalled();
		expect(onfilterchange).not.toHaveBeenCalled();
		await screen.unmount();
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

	it('keeps seven long active filters and atomic actions in their explicit responsive rows', async () => {
		const host = document.createElement('div');
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
		const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
		const controls = screen.getByTestId('wishlist-toolbar-controls').element();
		const pills = screen.getByTestId('wishlist-toolbar-active-filters').element();
		const actions = screen.getByTestId('wishlist-toolbar-actions').element();
		const actionButtons = Array.from(actions.querySelectorAll('button'));

		for (const width of [320, 390, 480, 800, 1120]) {
			host.style.width = `${width}px`;
			await new Promise(requestAnimationFrame);
			const toolbarRect = toolbar.getBoundingClientRect();
			const controlsRect = controls.getBoundingClientRect();
			const pillsRect = pills.getBoundingClientRect();
			const actionsRect = actions.getBoundingClientRect();

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
			if (width < 1056) {
				expect(pillsRect.top).toBeGreaterThanOrEqual(controlsRect.bottom);
				expect(actionsRect.top).toBeGreaterThanOrEqual(pillsRect.bottom);
			} else {
				expect(pillsRect.top).toBeGreaterThanOrEqual(controlsRect.bottom);
				expect(actionsRect.left).toBeGreaterThanOrEqual(pillsRect.right);
				expect(Math.abs(actionsRect.bottom - pillsRect.bottom)).toBeLessThan(0.5);
			}

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
		const count = document.querySelector<HTMLElement>('[data-filter-count]');
		const pill = document.querySelector<HTMLElement>('[data-active-filter-pill]');

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
