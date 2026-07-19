import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import DashboardToolbar from './DashboardToolbar.svelte';

describe('DashboardToolbar unified filters (issue #161)', () => {
	it('keeps both active filters visible and accessible while the menu is open', async () => {
		const screen = await render(DashboardToolbar, {
			sortValue: 'lastActivity',
			viewMode: 'grid',
			showArchived: false,
			showUnfollowed: true,
			unfollowedValue: false,
		});

		const filterTrigger = screen.getByRole('button', { name: m.gift_filter() });
		await filterTrigger.click();

		const archivedCheckbox = screen.getByRole('menuitemcheckbox', {
			name: m.dashboard_show_archived(),
		});
		await archivedCheckbox.click();
		const unfollowedCheckbox = screen.getByRole('menuitemcheckbox', {
			name: m.dashboard_show_unfollowed(),
		});
		await unfollowedCheckbox.click();

		await expect.element(archivedCheckbox).toHaveAttribute('aria-checked', 'true');
		await expect.element(unfollowedCheckbox).toHaveAttribute('aria-checked', 'true');
		await expect.element(screen.getByRole('menu')).toBeVisible();
		await expect
			.element(
				screen.getByRole('button', {
					name: m.filter_remove({ label: m.dashboard_include_archived() }),
				}),
			)
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('button', {
					name: m.filter_remove({ label: m.dashboard_include_unfollowed() }),
				}),
			)
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('button', {
					name: `${m.gift_filter()}: ${m.filter_active_count({ count: 2 })}`,
				}),
			)
			.toBeVisible();
		await userEvent.keyboard('{Escape}');
		await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();
		await screen.unmount();
	}, 30_000);

	it('clears both initially active filters without opening the menu', async () => {
		const screen = await render(DashboardToolbar, {
			sortValue: 'lastActivity',
			viewMode: 'grid',
			showArchived: true,
			showUnfollowed: true,
			unfollowedValue: true,
		});

		await screen.getByRole('button', { name: m.wishlist_detail_clear_filters() }).click();

		await expect
			.element(
				screen.getByRole('button', {
					name: m.filter_remove({ label: m.dashboard_include_archived() }),
				}),
			)
			.not.toBeInTheDocument();
		await expect
			.element(
				screen.getByRole('button', {
					name: m.filter_remove({ label: m.dashboard_include_unfollowed() }),
				}),
			)
			.not.toBeInTheDocument();
		const clearedFilterTrigger = screen.getByRole('button', { name: m.gift_filter() });
		await expect.element(clearedFilterTrigger).toHaveAttribute('aria-label', m.gift_filter());
		await expect.element(clearedFilterTrigger).toHaveFocus();

		await clearedFilterTrigger.click();
		await expect
			.element(screen.getByRole('menuitemcheckbox', { name: m.dashboard_show_archived() }))
			.toHaveAttribute('aria-checked', 'false');
		await expect
			.element(screen.getByRole('menuitemcheckbox', { name: m.dashboard_show_unfollowed() }))
			.toHaveAttribute('aria-checked', 'false');
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	});

	it('moves focus to the next pill, then back to the filter trigger', async () => {
		const screen = await render(DashboardToolbar, {
			sortValue: 'lastActivity',
			viewMode: 'grid',
			showArchived: true,
			showUnfollowed: true,
			unfollowedValue: true,
		});

		const archivedRemoveButton = screen.getByRole('button', {
			name: m.filter_remove({ label: m.dashboard_include_archived() }),
		});
		const unfollowedRemoveButton = screen.getByRole('button', {
			name: m.filter_remove({ label: m.dashboard_include_unfollowed() }),
		});
		await archivedRemoveButton.click();
		await expect.element(unfollowedRemoveButton).toHaveFocus();

		await unfollowedRemoveButton.click();
		await expect.element(screen.getByRole('button', { name: m.gift_filter() })).toHaveFocus();
		await screen.unmount();
	});

	it('keeps archived state synchronized between its menu item and remove pill', async () => {
		const screen = await render(DashboardToolbar, {
			sortValue: 'lastActivity',
			viewMode: 'grid',
			showArchived: false,
		});

		await screen.getByRole('button', { name: m.gift_filter() }).click();
		const archivedCheckbox = screen.getByRole('menuitemcheckbox', {
			name: m.dashboard_show_archived(),
		});
		await archivedCheckbox.click();
		await expect
			.element(
				screen.getByRole('button', {
					name: m.filter_remove({ label: m.dashboard_include_archived() }),
				}),
			)
			.toBeVisible();
		await userEvent.keyboard('{Escape}');
		await screen
			.getByRole('button', {
				name: m.filter_remove({ label: m.dashboard_include_archived() }),
			})
			.click();

		await screen.getByRole('button', { name: m.gift_filter() }).click();
		await expect
			.element(screen.getByRole('menuitemcheckbox', { name: m.dashboard_show_archived() }))
			.toHaveAttribute('aria-checked', 'false');
		await expect
			.element(
				screen.getByRole('button', {
					name: m.filter_remove({ label: m.dashboard_include_archived() }),
				}),
			)
			.not.toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: m.gift_filter() })).toBeVisible();
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	});

	it('removes archived state when its menu checkbox is unchecked', async () => {
		const screen = await render(DashboardToolbar, {
			sortValue: 'lastActivity',
			viewMode: 'grid',
			showArchived: false,
		});

		await screen.getByRole('button', { name: m.gift_filter() }).click();
		const archivedCheckbox = screen.getByRole('menuitemcheckbox', {
			name: m.dashboard_show_archived(),
		});
		await archivedCheckbox.click();
		await archivedCheckbox.click();

		await expect.element(archivedCheckbox).toHaveAttribute('aria-checked', 'false');
		await expect
			.element(
				screen.getByRole('button', {
					name: m.filter_remove({ label: m.dashboard_include_archived() }),
				}),
			)
			.not.toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: m.gift_filter() })).toBeVisible();
		await userEvent.keyboard('{Escape}');
		await screen.unmount();
	});
});
