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

		await screen.getByRole('button', { name: m.wishlist_detail_clear_filters() }).click();

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
	it('renders grouping as a separate visible selector with unavailable choices disabled', async () => {
		const screen = await renderToolbar({
			groupingAvailability: { priority: true, category: false },
		});

		await expect
			.element(screen.getByRole('button', { name: m.gift_grouping_label() }))
			.toBeVisible();
		await screen.getByRole('button', { name: m.gift_grouping_label() }).click();
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
		await screen.getByRole('button', { name: m.gift_grouping_label() }).click();
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
