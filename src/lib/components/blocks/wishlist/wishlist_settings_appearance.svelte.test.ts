import '../../../../app.css';
import { cleanup } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { DEFAULT_WISHLIST_BACKGROUND, WISHLIST_THEMES } from '$lib/theme/wishlist_themes.js';
import { wishlistThemeName } from '$lib/theme/wishlist_theme_messages.js';

const remoteMocks = vi.hoisted(() => ({
	saveWishlistSettings: vi.fn(),
}));
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/wishlists/wishlist_settings.remote.js', () => ({
	saveWishlistSettings: remoteMocks.saveWishlistSettings,
}));
vi.mock('$lib/modules/gift-categories/gift_category_queries.remote.js', () => ({
	getGiftCategories: vi.fn(() => ({ current: [] })),
	getGiftCategorySettingsRows: vi.fn(() => ({ current: [], refresh: vi.fn() })),
}));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	saveGiftCategorySettingsCommand: vi.fn(),
}));

import { renderSettings, wishlist } from './wishlist_settings_modal.test_fixtures.js';

const defaultBackgroundWithoutImage = {
	mode: DEFAULT_WISHLIST_BACKGROUND.mode,
	focal: DEFAULT_WISHLIST_BACKGROUND.focal,
	placement: DEFAULT_WISHLIST_BACKGROUND.placement,
	dim: DEFAULT_WISHLIST_BACKGROUND.dim,
	motion: DEFAULT_WISHLIST_BACKGROUND.motion,
};

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('WishlistSettingsModal appearance tab', () => {
	it('stages palette preview until global Save', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValueOnce(undefined);
		const onpaletteselect = vi.fn();
		const screen = renderSettings({ activeTab: 'appearance', onpaletteselect });
		await screen.getByRole('button', { name: 'Oceán' }).click();
		expect(onpaletteselect).toHaveBeenCalledWith('ocean');
		expect(remoteMocks.saveWishlistSettings).not.toHaveBeenCalled();
		await screen.getByRole('button', { name: m.save() }).click();
		expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledWith({
			wishlistId: wishlist.id,
			palette: 'ocean',
		});
	});

	it('saves a chosen theme with its palette through the global Save', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValue(undefined);
		const onpaletteselect = vi.fn();
		const screen = renderSettings({ activeTab: 'appearance', onpaletteselect });
		const save = screen.getByRole('button', { name: m.save() });
		await expect.element(save).toBeDisabled();

		await screen
			.getByRole('radio', { name: wishlistThemeName('christmas'), exact: true })
			.click();

		await expect
			.element(
				screen.getByRole('radio', { name: wishlistThemeName('christmas'), exact: true }),
			)
			.toHaveAttribute('aria-checked', 'true');
		expect(onpaletteselect).toHaveBeenLastCalledWith(WISHLIST_THEMES.christmas.palette);
		await expect.element(save).toBeEnabled();
		expect(remoteMocks.saveWishlistSettings).not.toHaveBeenCalled();

		await save.click();
		await vi.waitFor(() => expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledOnce());
		expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledWith({
			wishlistId: wishlist.id,
			palette: WISHLIST_THEMES.christmas.palette,
			appearance: {
				themeId: 'christmas',
				styleTokens: null,
				background: { ...defaultBackgroundWithoutImage, mode: 'theme' },
			},
		});
	});

	it('resets style overrides to the theme defaults', async () => {
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: { ...wishlist, themeId: 'toys' },
		});
		const reset = screen.getByRole('button', {
			name: m.wishlist_appearance_style_reset(),
			exact: true,
		});
		const save = screen.getByRole('button', { name: m.save() });
		await expect.element(reset).toBeDisabled();

		await screen
			.getByRole('radio', { name: m.wishlist_appearance_corners_sharp(), exact: true })
			.click();
		await expect.element(reset).toBeEnabled();
		await expect.element(save).toBeEnabled();

		await reset.click();
		await expect.element(reset).toBeDisabled();
		await expect
			.element(
				screen.getByRole('radio', {
					name: m.wishlist_appearance_corners_round(),
					exact: true,
				}),
			)
			.toHaveAttribute('data-state', 'on');
		await expect.element(save).toBeDisabled();
	});

	it('keeps a stored override until the manager resets it', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValue(undefined);
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: { ...wishlist, themeId: 'minimal', styleTokens: { corners: 'round' } },
		});
		await screen
			.getByRole('button', { name: m.wishlist_appearance_style_reset(), exact: true })
			.click();
		await screen.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() => expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledOnce());
		expect(remoteMocks.saveWishlistSettings.mock.calls[0]![0].appearance).toMatchObject({
			themeId: 'minimal',
			styleTokens: null,
		});
	});

	it('previews the draft on the page and drops the preview on discard', async () => {
		const onappearancepreview = vi.fn();
		const screen = renderSettings({ activeTab: 'appearance', onappearancepreview });

		await screen.getByRole('radio', { name: wishlistThemeName('gamer'), exact: true }).click();
		await vi.waitFor(() =>
			expect(onappearancepreview).toHaveBeenLastCalledWith(
				expect.objectContaining({
					themeId: 'gamer',
					background: expect.objectContaining({ mode: 'theme' }),
				}),
			),
		);

		await userEvent.keyboard('{Escape}');
		await screen.getByRole('button', { name: m.wishlist_settings_discard() }).click();

		await vi.waitFor(() => expect(onappearancepreview).toHaveBeenLastCalledWith(null));
	});

	it('drops the preview once a save has refreshed the page', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValue(undefined);
		const onappearancepreview = vi.fn();
		const onsaved = vi.fn(async () => {
			expect(onappearancepreview).not.toHaveBeenLastCalledWith(null);
		});
		const screen = renderSettings({ activeTab: 'appearance', onappearancepreview, onsaved });

		await screen.getByRole('radio', { name: wishlistThemeName('books'), exact: true }).click();
		await screen.getByRole('button', { name: m.save() }).click();

		await vi.waitFor(() => expect(onsaved).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(onappearancepreview).toHaveBeenLastCalledWith(null));
	});

	it('offers no custom upload on a demo wishlist', async () => {
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: { ...wishlist, themeId: 'toys', demoSessionId: 'demo-session' },
		});
		await expect
			.element(
				screen.getByRole('radio', {
					name: m.wishlist_appearance_background_custom(),
					exact: true,
				}),
			)
			.toBeDisabled();
		await expect
			.element(
				screen.getByTestId('wishlist-appearance-editor').getByText(m.demo_image_limits()),
			)
			.toBeVisible();
	});

	it('disables the theme backdrop choice without a theme', async () => {
		const screen = renderSettings({ activeTab: 'appearance' });
		await expect
			.element(
				screen.getByRole('radio', {
					name: m.wishlist_appearance_background_theme(),
					exact: true,
				}),
			)
			.toBeDisabled();
	});
});
