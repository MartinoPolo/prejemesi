import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import { REVERT_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
import { WISHLIST_ROLES, type Wishlist } from '$lib/modules/wishlists/types.js';
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	getGiftCategories: vi.fn(() => ({ current: [] })),
	createCustomGiftCategoryCommand: vi.fn(),
	deleteCustomGiftCategoryCommand: vi.fn(),
	renameCustomGiftCategoryCommand: vi.fn(),
	reorderGiftCategories: vi.fn(),
	togglePresetGiftCategory: vi.fn(),
}));

import WishlistSettingsModal from './WishlistSettingsModal.svelte';

const wishlist: Wishlist = {
	id: 'wishlist-settings-test',
	shortId: 'settings1',
	recipientUserId: 'recipient-1',
	recipientName: null,
	title: 'Test wishlist',
	description: null,
	eventDate: null,
	status: 'draft',
	theme: 'default',
	customThemeColor: null,
	palette: 'sky',
	imageKey: null,
	imageSlots: null,
	recipientIsModerator: false,
	sharedAt: null,
	eventDateEditedAt: null,
	archivedAt: null,
	deletedAt: null,
	createdAt: new Date('2026-01-01T00:00:00Z'),
	updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function renderSettings(overrides: Partial<ComponentProps<typeof WishlistSettingsModal>> = {}) {
	return render(WishlistSettingsModal, {
		open: true,
		activeTab: 'details',
		wishlist,
		canManage: true,
		role: WISHLIST_ROLES.recipient,
		revertCapability: REVERT_CAPABILITY.hidden,
		recipientDisplayName: 'Test Recipient',
		themeEmoji: '🎁',
		onsaved: async () => {},
		onimport: () => {},
		onexport: () => {},
		...overrides,
	});
}

describe('WishlistSettingsModal import and export tab', () => {
	it('keeps spreadsheet actions out of Details and reveals them only on the dedicated tab', async () => {
		const screen = renderSettings();

		await expect
			.element(screen.getByRole('button', { name: m.import_toolbar_label() }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: m.export_toolbar_label() }))
			.not.toBeInTheDocument();

		await screen.getByRole('tab', { name: m.wishlist_settings_data_title() }).click();

		await expect
			.element(screen.getByRole('button', { name: m.import_toolbar_label() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.export_toolbar_label() }))
			.toBeVisible();
	});

	it('keeps the existing import and export callbacks on the dedicated tab actions', async () => {
		const onimport = vi.fn();
		const onexport = vi.fn();
		const screen = renderSettings({ onimport, onexport });

		await screen.getByRole('tab', { name: m.wishlist_settings_data_title() }).click();
		await screen.getByRole('button', { name: m.import_toolbar_label() }).click();
		await screen.getByRole('button', { name: m.export_toolbar_label() }).click();

		expect(onimport).toHaveBeenCalledOnce();
		expect(onexport).toHaveBeenCalledOnce();
	});

	it('keeps keyboard-selected tabs visible in the mobile-width overflow', async () => {
		const screen = renderSettings();
		const dialog = screen.getByRole('dialog', { name: m.wishlist_settings_title() }).element();
		const tablist = screen
			.getByRole('tablist', { name: m.wishlist_settings_title() })
			.element();
		dialog.style.cssText = 'height: 240px; overflow-y: auto; overflow-anchor: none';
		tablist.style.cssText = 'display: flex; overflow-x: auto; width: 220px';
		const details = screen.getByRole('tab', { name: m.wishlist_settings_details_section() });
		const danger = screen.getByRole('tab', { name: m.wishlist_settings_danger_tab() });
		details.element().focus();
		for (const tab of screen.getByRole('tab').all()) {
			tab.element().style.cssText = 'flex: none; width: 110px';
		}

		expect(tablist.scrollWidth).toBeGreaterThan(tablist.clientWidth);
		dialog.scrollTop = 80;
		expect(dialog.scrollTop).toBeGreaterThan(0);
		const dialogScrollTop = dialog.scrollTop;
		const pageScrollY = window.scrollY;
		await userEvent.keyboard('{End}');

		await expect.element(danger).toHaveFocus();
		await expect.element(danger).toHaveAttribute('aria-selected', 'true');
		let tablistRect = tablist.getBoundingClientRect();
		const dangerRect = danger.element().getBoundingClientRect();
		expect(dangerRect.left).toBeGreaterThanOrEqual(tablistRect.left);
		expect(dangerRect.right).toBeLessThanOrEqual(tablistRect.right);
		expect(dialog.scrollTop).toBe(dialogScrollTop);
		expect(window.scrollY).toBe(pageScrollY);

		await userEvent.keyboard('{Home}');
		await expect.element(details).toHaveFocus();
		tablistRect = tablist.getBoundingClientRect();
		const detailsRect = details.element().getBoundingClientRect();
		expect(detailsRect.left).toBeGreaterThanOrEqual(tablistRect.left);
		expect(detailsRect.right).toBeLessThanOrEqual(tablistRect.right);
		expect(dialog.scrollTop).toBe(dialogScrollTop);
		expect(window.scrollY).toBe(pageScrollY);
	});
});
