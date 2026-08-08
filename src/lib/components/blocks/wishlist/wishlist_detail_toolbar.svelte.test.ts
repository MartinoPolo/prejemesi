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
	filters: { availableOnly: false, withLinkOnly: false, likedOnly: false },
	priorityGrouping: false,
	showPriorityGrouping: false,
	onviewmodechange: () => {},
	onsortchange: () => {},
	onfilterchange: () => {},
	onprioritygroupingchange: () => {},
	onthemeopen: () => {},
	onsettings: () => {},
	onunfollow: () => {},
	onaddgift: () => {},
	onbatchadd: () => {},
	onimport: () => {},
	onexport: () => {},
};

async function renderToolbar(
	overrides: Partial<ComponentProps<typeof WishlistDetailToolbar>> = {},
) {
	return render(WishlistDetailToolbar, { ...defaultProps, ...overrides });
}

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
			filters: { availableOnly: true, withLinkOnly: true, likedOnly: true },
			onfilterchange,
		});

		await screen.getByRole('button', { name: m.wishlist_detail_clear_filters() }).click();

		expect(onfilterchange).toHaveBeenCalledTimes(1);
		expect(onfilterchange).toHaveBeenCalledWith({
			availableOnly: false,
			withLinkOnly: false,
			likedOnly: false,
		});
		await screen.unmount();
	});

	it('updates only the selected visible gift filter', async () => {
		const onfilterchange = vi.fn();
		const screen = await renderToolbar({
			isAuthenticated: true,
			filters: { availableOnly: false, withLinkOnly: false, likedOnly: true },
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
