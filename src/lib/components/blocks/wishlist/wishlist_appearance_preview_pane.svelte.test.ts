import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { WishlistBackground } from '$lib/theme/wishlist_themes.js';
import WishlistAppearancePreviewPane from './WishlistAppearancePreviewPane.svelte';
import { resolveWishlistThemeScope } from './wishlist_theme_scope.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));
// A fixture library: a light and dark pair and a light-only image.
vi.mock('$lib/theme/wishlist_background_library.json', () => ({
	default: [
		{
			id: 'toys-illustrated',
			themeId: 'toys',
			variant: 'illustrated',
			widthsByMode: { light: [640, 1280], dark: [640, 1280] },
		},
		{
			id: 'space-photo',
			themeId: 'space',
			variant: 'photo',
			widthsByMode: { light: [640, 1280] },
		},
	],
}));

function renderPane(mode: 'light' | 'dark', background: Partial<WishlistBackground>) {
	const scope = resolveWishlistThemeScope({
		themeId: 'toys',
		styleTokens: null,
		background: { placement: 'full', ...background },
		previewImageUrl: '/demo/playground/advent.jpg',
	});
	return render(WishlistAppearancePreviewPane, {
		mode,
		palette: 'sky',
		scope,
		title: 'Vánoce',
		motifs: [],
	});
}

describe('WishlistAppearancePreviewPane background photo', () => {
	it.each([
		['light', /toys-illustrated-light-640\.webp$/],
		['dark', /toys-illustrated-dark-640\.webp$/],
	] as const)('shows the %s file of a library pair, undimmed', async (mode, source) => {
		const screen = renderPane(mode, { mode: 'library', libraryImageId: 'toys-illustrated' });

		await expect
			.element(screen.getByTestId('wishlist-appearance-preview-photo'))
			.toHaveAttribute('src', expect.stringMatching(source));
		await expect
			.element(screen.getByTestId('wishlist-appearance-preview-dark-mode-dim'))
			.not.toBeInTheDocument();
	});

	it.each([
		['light', false],
		['dark', true],
	] as const)(
		'falls back to the light file of a library image in %s mode, dimmed only in dark',
		async (mode, dimmed) => {
			const screen = renderPane(mode, { mode: 'library', libraryImageId: 'space-photo' });

			await expect
				.element(screen.getByTestId('wishlist-appearance-preview-photo'))
				.toHaveAttribute('src', expect.stringMatching(/space-photo-light-640\.webp$/));
			expect(
				screen.getByTestId('wishlist-appearance-preview-dark-mode-dim').query() !== null,
			).toBe(dimmed);
		},
	);

	it.each([
		['light', false],
		['dark', true],
	] as const)('dims a custom photo in %s mode: %s', async (mode, dimmed) => {
		const screen = renderPane(mode, {
			mode: 'custom',
			imageKey: 'wishlists/backgrounds/a.webp',
		});

		await expect
			.element(screen.getByTestId('wishlist-appearance-preview-photo'))
			.toHaveAttribute('src', '/demo/playground/advent.jpg');
		expect(
			screen.getByTestId('wishlist-appearance-preview-dark-mode-dim').query() !== null,
		).toBe(dimmed);
	});
});
