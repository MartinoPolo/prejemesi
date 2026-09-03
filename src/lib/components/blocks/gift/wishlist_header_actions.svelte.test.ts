import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import WishlistHeaderActions from './WishlistHeaderActions.svelte';
import * as m from '$lib/paraglide/messages.js';

const callbacks = {
	onshare: vi.fn(),
	onmoderators: vi.fn(),
	onsettings: vi.fn(),
	oneditimage: vi.fn(),
	oneditrecipient: vi.fn(),
	onarchive: vi.fn(),
};

describe('WishlistHeaderActions', () => {
	it('opens a labeled capability-aware management sheet with Archive separated as dangerous', async () => {
		const screen = await render(WishlistHeaderActions, {
			canManage: true,
			canShare: true,
			canEditImage: true,
			canEditRecipient: true,
			canArchive: true,
			...callbacks,
		});
		await screen.getByRole('button', { name: m.gift_more_actions() }).click();
		for (const label of [
			m.wishlist_share_button(),
			m.wishlist_moderators_label(),
			m.wishlist_settings_title(),
			m.wishlist_edit_image_label(),
			m.wishlist_edit_recipient_label(),
			m.wishlist_archive_button(),
		]) {
			await expect
				.element(screen.getByRole('button', { name: label, exact: true }))
				.toBeVisible();
		}
		const danger = screen.getByTestId('wishlist-header-danger-actions');
		expect(
			danger
				.element()
				.contains(
					screen
						.getByRole('button', { name: m.wishlist_archive_button(), exact: true })
						.element(),
				),
		).toBe(true);
		await screen
			.getByRole('button', { name: m.wishlist_edit_image_label(), exact: true })
			.click();
		expect(callbacks.oneditimage).toHaveBeenCalledOnce();
		await screen.unmount();
	});

	it('renders no management trigger or structural sheet trace for visitors', async () => {
		const screen = await render(WishlistHeaderActions, {
			canManage: false,
			canShare: false,
			canEditImage: false,
			canEditRecipient: false,
			canArchive: false,
			...callbacks,
		});
		await expect
			.element(screen.getByRole('button', { name: m.gift_more_actions() }))
			.not.toBeInTheDocument();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await screen.unmount();
	});
});
