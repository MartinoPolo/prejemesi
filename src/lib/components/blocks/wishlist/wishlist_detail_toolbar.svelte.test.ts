import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import { GIFT_SORT_OPTIONS, GIFT_VIEW_MODES } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import WishlistDetailToolbar from './WishlistDetailToolbar.svelte';

const defaultProps: ComponentProps<typeof WishlistDetailToolbar> = {
	canManage: false,
	role: WISHLIST_ROLES.visitor,
	isArchived: false,
	isAuthenticated: false,
	viewMode: GIFT_VIEW_MODES.card,
	sortOption: GIFT_SORT_OPTIONS.ownerOrder,
	filters: { availableOnly: false, withLinkOnly: false, likedOnly: false, showReceived: false },
	priorityGrouping: false,
	showPriorityGrouping: false,
	reorderMode: false,
	recipientViewPreview: false,
	onrecipientviewpreviewchange: () => {},
	onreordermodechange: () => {},
	onviewmodechange: () => {},
	onsortchange: () => {},
	onfilterchange: () => {},
	onprioritygroupingchange: () => {},
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
		});
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	});
});

describe('WishlistDetailToolbar priority-grouping toggle (issue #224 REQ-4)', () => {
	it('shows the priority-grouping toggle when at least one gift has a priority', async () => {
		const screen = await renderToolbar({ isAuthenticated: true, showPriorityGrouping: true });
		await screen.getByRole('button', { name: m.gift_filter() }).click();
		await expect
			.element(screen.getByRole('menuitemcheckbox', { name: m.gift_group_by_priority() }))
			.toBeVisible();
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	}, 30_000);

	it('hides the priority-grouping toggle when no gift has a priority', async () => {
		const screen = await renderToolbar({ isAuthenticated: true, showPriorityGrouping: false });
		await screen.getByRole('button', { name: m.gift_filter() }).click();
		await expect
			.element(screen.getByRole('menuitemcheckbox', { name: m.gift_group_by_priority() }))
			.not.toBeInTheDocument();
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	}, 30_000);

	it('reports toggling the priority grouping', async () => {
		const onprioritygroupingchange = vi.fn();
		const screen = await renderToolbar({
			isAuthenticated: true,
			showPriorityGrouping: true,
			priorityGrouping: false,
			onprioritygroupingchange,
		});
		await screen.getByRole('button', { name: m.gift_filter() }).click();
		await screen.getByRole('menuitemcheckbox', { name: m.gift_group_by_priority() }).click();
		expect(onprioritygroupingchange).toHaveBeenCalledWith(true);
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	}, 30_000);
});
