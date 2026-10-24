import '../../../../app.css';
import { cleanup } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type * as PrepareImageModule from '$lib/modules/uploads/prepare_image.js';
import type { UploadResult } from '$lib/modules/uploads/types.js';
import { DEFAULT_WISHLIST_BACKGROUND, WISHLIST_THEMES } from '$lib/theme/wishlist_themes.js';
import { wishlistThemeName } from '$lib/theme/wishlist_theme_messages.js';

const remoteMocks = vi.hoisted(() => ({
	saveWishlistSettings: vi.fn(),
	uploadFile: vi.fn(),
}));
vi.mock('$env/dynamic/public', () => ({ env: {} }));
// Preparation has its own tests.
vi.mock('$lib/modules/uploads/prepare_image.js', async (importOriginal) => ({
	...(await importOriginal<typeof PrepareImageModule>()),
	prepareImageForUpload: async (file: File) => file,
}));
vi.mock('$lib/modules/uploads/upload.js', () => ({
	uploadFile: remoteMocks.uploadFile,
	createPendingUploads: () => ({
		track: () => {},
		commit: async () => {},
		discardAll: async () => {},
	}),
}));
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

const STORED_BACKGROUND_KEY = 'wishlists/backgrounds/stored.webp';

const ONE_PIXEL_PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	),
	(character) => character.charCodeAt(0),
);

function selectImage(input: HTMLInputElement) {
	const transfer = new DataTransfer();
	transfer.items.add(new File([ONE_PIXEL_PNG], 'background.png', { type: 'image/png' }));
	input.files = transfer.files;
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

function savedAppearance() {
	return remoteMocks.saveWishlistSettings.mock.calls[0]![0].appearance;
}

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

	it('reset clears stored overrides', async () => {
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

	it('keeps a stored override when only an unrelated field changes', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValue(undefined);
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: { ...wishlist, themeId: 'minimal', styleTokens: { corners: 'round' } },
		});
		await screen
			.getByRole('radio', { name: m.wishlist_appearance_motion_off(), exact: true })
			.click();
		await screen.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() => expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledOnce());
		expect(savedAppearance()).toMatchObject({
			themeId: 'minimal',
			styleTokens: { corners: 'round' },
			background: expect.objectContaining({ motion: 'off' }),
		});
	});

	it('sends no image key when a stored custom background only changes its dim', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValue(undefined);
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: {
				...wishlist,
				background: {
					...DEFAULT_WISHLIST_BACKGROUND,
					mode: 'custom',
					imageKey: STORED_BACKGROUND_KEY,
				},
			},
		});
		await screen.getByRole('slider').click();
		await userEvent.keyboard('{ArrowRight}');
		await screen.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() => expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledOnce());
		const { background } = savedAppearance();
		expect(background).toMatchObject({ mode: 'custom' });
		expect(background.dim).not.toBe(DEFAULT_WISHLIST_BACKGROUND.dim);
		expect(background).not.toHaveProperty('imageKey');
		expect(savedAppearance()).not.toHaveProperty('backgroundAssignmentToken');
	});

	it('saves a newly uploaded background with its assignment proof', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValue(undefined);
		const uploaded: UploadResult = {
			objectKey: 'wishlists/backgrounds/new-upload.png',
			publicUrl: 'data:image/png;base64,iVBORw0KGgo=',
			deleteToken: 'background-assignment-token',
		};
		remoteMocks.uploadFile.mockReset().mockResolvedValue(uploaded);
		const screen = renderSettings({ activeTab: 'appearance' });

		await screen
			.getByRole('radio', { name: m.wishlist_appearance_background_custom(), exact: true })
			.click();
		const fileInput = await vi.waitFor(() => {
			const input = screen.container.ownerDocument.querySelector<HTMLInputElement>(
				'[data-testid="wishlist-appearance-editor"] input[type="file"]',
			);
			expect(input).not.toBeNull();
			return input!;
		});
		selectImage(fileInput);
		await vi.waitFor(() => expect(remoteMocks.uploadFile).toHaveBeenCalledOnce());

		const save = screen.getByRole('button', { name: m.save() });
		await expect.element(save).toBeEnabled();
		await save.click();
		await vi.waitFor(() => expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledOnce());
		expect(savedAppearance()).toMatchObject({
			background: { mode: 'custom', imageKey: uploaded.objectKey },
			backgroundAssignmentToken: uploaded.deleteToken,
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
		const events: string[] = [];
		const onappearancepreview = vi.fn((preview: unknown) => {
			events.push(preview === null ? 'preview:null' : 'preview');
		});
		const onsaved = vi.fn(async () => {
			events.push('saved');
		});
		const screen = renderSettings({ activeTab: 'appearance', onappearancepreview, onsaved });

		await screen.getByRole('radio', { name: wishlistThemeName('books'), exact: true }).click();
		await screen.getByRole('button', { name: m.save() }).click();

		await vi.waitFor(() => expect(events.at(-1)).toBe('preview:null'));
		expect(events.slice(-3)).toEqual(['preview', 'saved', 'preview:null']);
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
