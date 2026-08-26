import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import { REVERT_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
import { WISHLIST_ROLES, type Wishlist } from '$lib/modules/wishlists/types.js';
vi.mock('$env/dynamic/public', () => ({ env: {} }));

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
});
