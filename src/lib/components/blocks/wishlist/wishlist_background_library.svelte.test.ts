import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { wishlistThemeName } from '$lib/theme/wishlist_theme_messages.js';
import {
	DEFAULT_WISHLIST_BACKGROUND,
	type WishlistBackground,
	type WishlistThemeId,
} from '$lib/theme/wishlist_themes.js';
import WishlistBackgroundEditor from './WishlistBackgroundEditor.svelte';

vi.mock('$env/dynamic/public', () => ({ env: {} }));
// A fixture library: space-photo has a file for each mode, the others one file.
vi.mock('$lib/theme/wishlist_background_library.json', () => ({
	default: [
		{
			id: 'toys-photo',
			themeId: 'toys',
			variant: 'photo',
			widthsByMode: { light: [1280, 2560] },
		},
		{
			id: 'space-illustrated',
			themeId: 'space',
			variant: 'illustrated',
			widthsByMode: { dark: [1280, 2560] },
		},
		{
			id: 'space-photo',
			themeId: 'space',
			variant: 'photo',
			widthsByMode: { light: [1280, 2560], dark: [1280, 2560] },
		},
	],
}));

function visibleImageSources(element: Element): (string | null)[] {
	return [...element.querySelectorAll('img')]
		.filter((image) => getComputedStyle(image).display !== 'none')
		.map((image) => image.getAttribute('src'));
}

function renderEditor(background: Partial<WishlistBackground>, themeId: WishlistThemeId | null) {
	const onchange = vi.fn();
	const screen = render(WishlistBackgroundEditor, {
		labelledBy: 'background-heading',
		background: { ...DEFAULT_WISHLIST_BACKGROUND, ...background },
		themeId,
		imageUrl: null,
		allowCustomUpload: true,
		onchange,
		onupload: () => {},
		onremove: () => {},
	});
	return { screen, onchange };
}

describe('WishlistBackgroundEditor library mode', () => {
	it('offers the library and starts it with the current theme image', async () => {
		const { screen, onchange } = renderEditor({ mode: 'theme' }, 'space');
		await screen
			.getByRole('radio', { name: m.wishlist_appearance_background_library(), exact: true })
			.click();
		expect(onchange).toHaveBeenCalledWith({
			mode: 'library',
			libraryImageId: 'space-illustrated',
		});
	});

	it('lists the current theme images first, named by theme and variant', async () => {
		const { screen } = renderEditor(
			{ mode: 'library', libraryImageId: 'space-photo' },
			'space',
		);
		const picker = screen.getByTestId('wishlist-background-library');
		await expect.element(picker).toBeVisible();
		const spaceName = wishlistThemeName('space');
		const names = picker
			.getByRole('radio')
			.elements()
			.map((item) => item.textContent?.replace(/\s+/g, ' ').trim());
		expect(names).toEqual([
			`${spaceName} ${m.wishlist_appearance_background_library_illustrated()}`,
			`${spaceName} ${m.wishlist_appearance_background_library_photo()}`,
			`${wishlistThemeName('toys')} ${m.wishlist_appearance_background_library_photo()}`,
		]);
		await expect
			.element(
				picker.getByRole('radio', {
					name: `${spaceName} ${m.wishlist_appearance_background_library_photo()}`,
				}),
			)
			.toHaveAttribute('aria-checked', 'true');
	});

	it('picks another image and offers the shared photo controls without upload actions', async () => {
		const { screen, onchange } = renderEditor(
			{ mode: 'library', libraryImageId: 'space-photo' },
			'space',
		);
		await screen
			.getByTestId('wishlist-background-library')
			.getByRole('radio', {
				name: `${wishlistThemeName('toys')} ${m.wishlist_appearance_background_library_photo()}`,
			})
			.click();
		expect(onchange).toHaveBeenCalledWith({ libraryImageId: 'toys-photo' });
		// The fixture images are not on disk, so the focal frame exists but has no size.
		await expect
			.element(screen.getByTestId('wishlist-background-focal-frame'))
			.toBeInTheDocument();
		expect(
			screen
				.getByTestId('wishlist-background-focal-frame')
				.element()
				.querySelector('img')
				?.getAttribute('src'),
		).toMatch(/\/wishlist-backgrounds\/space-photo-light-1280\.webp$/);
		await expect.element(screen.getByRole('slider')).toBeVisible();
		await expect
			.element(
				screen.getByRole('radio', {
					name: m.wishlist_appearance_background_placement_full(),
					exact: true,
				}),
			)
			.toBeVisible();
		await expect
			.element(
				screen.getByRole('button', { name: m.wishlist_appearance_background_remove() }),
			)
			.not.toBeInTheDocument();
	});

	it.each([
		['light', /space-photo-light-1280\.webp$/],
		['dark', /space-photo-dark-1280\.webp$/],
	] as const)(
		'previews thumbnails and the focal point in %s mode with that mode file',
		async (viewerMode, expectedSource) => {
			document.documentElement.classList.toggle('dark', viewerMode === 'dark');
			try {
				const { screen } = renderEditor(
					{ mode: 'library', libraryImageId: 'space-photo' },
					'space',
				);
				const picker = screen.getByTestId('wishlist-background-library');
				await expect.element(picker).toBeVisible();
				const spaceName = wishlistThemeName('space');
				const thumbnailSources = (variantLabel: string) =>
					visibleImageSources(
						picker
							.getByRole('radio', { name: `${spaceName} ${variantLabel}` })
							.element(),
					);

				expect(thumbnailSources(m.wishlist_appearance_background_library_photo())).toEqual([
					expect.stringMatching(expectedSource),
				]);
				// An image with one file shows it in either mode.
				expect(
					thumbnailSources(m.wishlist_appearance_background_library_illustrated()),
				).toEqual([expect.stringMatching(/space-illustrated-dark-1280\.webp$/)]);
				expect(
					visibleImageSources(
						screen.getByTestId('wishlist-background-focal-frame').element(),
					),
				).toEqual([expect.stringMatching(expectedSource)]);
			} finally {
				document.documentElement.classList.remove('dark');
			}
		},
	);
});
