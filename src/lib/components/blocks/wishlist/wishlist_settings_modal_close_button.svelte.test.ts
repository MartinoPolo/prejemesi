import '../../../../app.css';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { expectContentClearsOverlayClose } from '$lib/components/base/dialog/overlay_close_geometry.test_fixtures.js';
import { renderSettings } from './wishlist_settings_modal.test_fixtures.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/wishlists/wishlist_settings.remote.js', () => ({
	saveWishlistSettings: vi.fn(),
}));
vi.mock('$lib/modules/gift-categories/gift_category_queries.remote.js', () => ({
	getGiftCategories: vi.fn(() => ({ current: [] })),
	getGiftCategorySettingsRows: vi.fn(() => ({ current: [], refresh: vi.fn() })),
}));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	saveGiftCategorySettingsCommand: vi.fn(),
}));

afterEach(async () => {
	delete document.documentElement.dataset.depth;
	await page.viewport(1280, 720);
});

describe('WishlistSettingsModal close button', () => {
	it('keeps the title clear of the custom close button and its depth gap at 390px ink depth', async () => {
		document.documentElement.dataset.depth = 'ink';
		await page.viewport(390, 844);
		const screen = renderSettings();
		const dialog = screen.getByRole('dialog', { name: m.wishlist_settings_title() });
		const title = dialog.getByRole('heading', { name: m.wishlist_settings_title() });
		await expect.element(title).toBeVisible();
		await Promise.all(document.getAnimations().map((animation) => animation.finished));

		expectContentClearsOverlayClose(
			title.element() as HTMLElement,
			dialog.getByRole('button', { name: m.close(), exact: true }).element() as HTMLElement,
		);
	});
});
