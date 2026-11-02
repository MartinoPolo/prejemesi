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
vi.mock('$lib/theme/wishlist_background_library.json', () => ({ default: [] }));
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
	libraryImageId: DEFAULT_WISHLIST_BACKGROUND.libraryImageId,
	focal: DEFAULT_WISHLIST_BACKGROUND.focal,
	placement: DEFAULT_WISHLIST_BACKGROUND.placement,
	dim: DEFAULT_WISHLIST_BACKGROUND.dim,
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

function fieldResetName(field: string) {
	return m.wishlist_appearance_reset_field_to_theme({ field });
}

async function openCustomizeSection(screen: ReturnType<typeof renderSettings>) {
	const trigger = screen.getByRole('button', { name: m.wishlist_appearance_customize() });
	if (trigger.element().getAttribute('aria-expanded') !== 'true') {
		await trigger.click();
	}
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

	it('marks every customizable field as coming from the motif until it is overridden', async () => {
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: { ...wishlist, themeId: 'toys' },
		});
		await openCustomizeSection(screen);
		const save = screen.getByRole('button', { name: m.save() });
		const styleReset = screen.getByRole('button', {
			name: fieldResetName(m.wishlist_appearance_style_heading()),
			exact: true,
		});
		await expect
			.element(screen.getByTestId('wishlist-motif-field-marker').nth(3))
			.toBeVisible();
		await expect.element(styleReset).not.toBeInTheDocument();

		await screen
			.getByRole('radio', { name: m.wishlist_appearance_corners_sharp(), exact: true })
			.click();
		await expect.element(styleReset).toBeVisible();
		expect(screen.getByTestId('wishlist-motif-field-marker').elements()).toHaveLength(3);
		await expect.element(save).toBeEnabled();

		await styleReset.click();
		await expect.element(styleReset).not.toBeInTheDocument();
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

	it('resets a palette override back to the motif palette', async () => {
		const onpaletteselect = vi.fn();
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: { ...wishlist, themeId: 'minimal' },
			onpaletteselect,
		});
		const paletteReset = screen.getByRole('button', {
			name: fieldResetName(m.wishlist_appearance_palette_heading()),
			exact: true,
		});
		await paletteReset.click();
		expect(onpaletteselect).toHaveBeenLastCalledWith(WISHLIST_THEMES.minimal.palette);
		await expect.element(paletteReset).not.toBeInTheDocument();
	});

	it('reset clears stored overrides', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValue(undefined);
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: { ...wishlist, themeId: 'minimal', styleTokens: { corners: 'round' } },
		});
		await screen
			.getByRole('button', {
				name: fieldResetName(m.wishlist_appearance_style_heading()),
				exact: true,
			})
			.click();
		await screen.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() => expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledOnce());
		expect(savedAppearance()).toMatchObject({
			themeId: 'minimal',
			styleTokens: null,
		});
	});

	it('saves the chosen header frame as a style override', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValue(undefined);
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: { ...wishlist, themeId: 'toys' },
		});
		await openCustomizeSection(screen);
		await screen
			.getByRole('radio', { name: m.wishlist_appearance_hero_frame_tag(), exact: true })
			.click();
		await expect
			.element(
				screen.getByRole('button', {
					name: fieldResetName(m.wishlist_appearance_hero_frame_heading()),
					exact: true,
				}),
			)
			.toBeVisible();
		await screen.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() => expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledOnce());
		expect(savedAppearance()).toMatchObject({
			themeId: 'toys',
			styleTokens: { heroFrame: 'tag' },
		});
	});

	it('shows each motif tile in its light and its dark variant whatever the manager mode', async () => {
		document.documentElement.classList.add('dark');
		try {
			const screen = renderSettings({ activeTab: 'appearance' });
			const toysTile = screen.getByRole('radio', {
				name: wishlistThemeName('toys'),
				exact: true,
			});
			await expect.element(toysTile).toBeVisible();
			const variants = toysTile.getByTestId('wishlist-theme-variant').elements();
			expect(variants.map((variant) => variant.dataset.mode)).toEqual(['light', 'dark']);
			const [lightTop, darkTop] = variants.map((variant) =>
				getComputedStyle(variant.firstElementChild!).getPropertyValue('--theme-top').trim(),
			);
			expect(lightTop).toBe('#e6f5ff');
			expect(darkTop).not.toBe(lightTop);
		} finally {
			document.documentElement.classList.remove('dark');
		}
	});

	it('previews the draft in light and in dark mode side by side', async () => {
		const screen = renderSettings({ activeTab: 'appearance' });
		const panes = screen.getByTestId('wishlist-appearance-preview-pane');
		await expect.element(panes.first()).toBeVisible();
		const [lightPane, darkPane] = panes.elements();
		expect([lightPane?.dataset.mode, darkPane?.dataset.mode]).toEqual(['light', 'dark']);
		expect(lightPane?.textContent).toContain(wishlist.title);
		expect(darkPane?.textContent).toContain(wishlist.title);
		const paneBackground = (pane: Element | undefined) =>
			getComputedStyle(pane!.firstElementChild!).backgroundColor;
		expect(paneBackground(lightPane)).not.toBe(paneBackground(darkPane));

		await screen.getByRole('radio', { name: wishlistThemeName('toys'), exact: true }).click();
		await vi.waitFor(() =>
			expect(lightPane?.querySelector('[data-wishlist-theme="toys"]')).not.toBeNull(),
		);
		expect(darkPane?.querySelector('[data-wishlist-theme="toys"]')).not.toBeNull();
	});

	it('keeps a stored override when only an unrelated field changes', async () => {
		remoteMocks.saveWishlistSettings.mockReset().mockResolvedValue(undefined);
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: { ...wishlist, themeId: 'minimal', styleTokens: { corners: 'round' } },
		});
		await openCustomizeSection(screen);
		await screen
			.getByRole('radio', { name: m.wishlist_appearance_background_none(), exact: true })
			.click();
		await screen.getByRole('button', { name: m.save() }).click();
		await vi.waitFor(() => expect(remoteMocks.saveWishlistSettings).toHaveBeenCalledOnce());
		expect(savedAppearance()).toMatchObject({
			themeId: 'minimal',
			styleTokens: { corners: 'round' },
			background: expect.objectContaining({ mode: 'none' }),
		});
	});

	it('names every customization group with a visible heading and offers no scroll motion control', async () => {
		const screen = renderSettings({
			activeTab: 'appearance',
			wishlist: { ...wishlist, themeId: 'toys' },
		});
		await openCustomizeSection(screen);
		for (const heading of [
			m.wishlist_appearance_palette_heading(),
			m.wishlist_appearance_background_heading(),
			m.wishlist_appearance_hero_frame_heading(),
			m.wishlist_appearance_style_heading(),
		]) {
			await expect
				.element(screen.getByRole('heading', { name: heading, exact: true }))
				.toBeVisible();
		}
		const backgroundModes = screen.getByRole('group', {
			name: m.wishlist_appearance_background_heading(),
			exact: true,
		});
		await expect
			.element(
				backgroundModes.getByRole('radio', {
					name: m.wishlist_appearance_background_none(),
					exact: true,
				}),
			)
			.toBeVisible();
		for (const removedMotionLabel of ['Jemný', 'Žádný']) {
			expect(
				screen.getByRole('radio', { name: removedMotionLabel, exact: true }).elements(),
			).toHaveLength(0);
		}
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
		await openCustomizeSection(screen);
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

	it('offers no library background while the library is empty', async () => {
		const screen = renderSettings({ activeTab: 'appearance' });
		await expect
			.element(
				screen.getByRole('radio', {
					name: m.wishlist_appearance_background_custom(),
					exact: true,
				}),
			)
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('radio', {
					name: m.wishlist_appearance_background_library(),
					exact: true,
				}),
			)
			.not.toBeInTheDocument();
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
