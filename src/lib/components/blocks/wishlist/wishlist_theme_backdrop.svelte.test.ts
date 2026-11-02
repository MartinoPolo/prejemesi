import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { WishlistThemeArt } from '$lib/theme/wishlist_theme_art/index.js';
import {
	DEFAULT_WISHLIST_BACKGROUND,
	type WishlistBackground,
	type WishlistBackgroundMode,
} from '$lib/theme/wishlist_themes.js';
import WishlistThemeBackdrop from './WishlistThemeBackdrop.svelte';

// The responsive photo source reads the image CDN base from `$env/dynamic/public`.
vi.mock('$env/dynamic/public', () => ({ env: {} }));
// A fixture library: a light-only image, a light and dark pair, and a dark-only image.
vi.mock('$lib/theme/wishlist_background_library.json', () => ({
	default: [
		{
			id: 'toys-illustrated',
			themeId: 'toys',
			variant: 'illustrated',
			widthsByMode: { light: [1280, 2560], dark: [1280, 2560] },
		},
		{
			id: 'christmas-photo',
			themeId: 'christmas',
			variant: 'photo',
			widthsByMode: { dark: [1280, 2560] },
		},
		{
			id: 'space-photo',
			themeId: 'space',
			variant: 'photo',
			widthsByMode: { light: [1280, 2560] },
		},
	],
}));

// One motif per side is enough to tell the desktop gutters from the mobile strip.
const ART: WishlistThemeArt = {
	motifs: ['<circle cx="50" cy="50" r="40" fill="var(--m-1)" />'],
	placements: [
		{ motif: 0, side: 'left', x: 0.5, y: 10, size: 64, rotate: 0, depth: 40, opacity: 1 },
		{ motif: 0, side: 'right', x: 0.5, y: 40, size: 64, rotate: 0, depth: 40, opacity: 1 },
		{ motif: 0, side: 'band', x: 0.2, y: 8, size: 48, rotate: 0, depth: 20, opacity: 1 },
	],
};

interface BackdropRender {
	mode: WishlistBackgroundMode;
	art?: WishlistThemeArt | null;
	imageUrl?: string | null;
	background?: Partial<WishlistBackground>;
	contentWidth?: number;
	viewerMode?: 'light' | 'dark';
}

async function renderBackdrop({
	mode,
	art = null,
	imageUrl = null,
	background = {},
	contentWidth = 1440,
	viewerMode = 'light',
}: BackdropRender): Promise<HTMLElement> {
	const { container } = render(WishlistThemeBackdrop, {
		mode,
		art,
		imageUrl,
		background: { ...DEFAULT_WISHLIST_BACKGROUND, mode, ...background },
	});
	// Recreates the app layout pair the backdrop sizes against: the `app-content` scroller and
	// the positioned content column.
	container.style.cssText = `container: app-content / inline-size; position: relative; width: ${String(contentWidth)}px; height: 900px; --content-max-width: 1168px`;
	// The page shell's backdrop scope supplies the strip height.
	container.dataset.wishlistBackdrop = '';
	// mode-watcher puts `.dark` on <html>; any ancestor does the same.
	container.classList.toggle('dark', viewerMode === 'dark');
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
	return container;
}

function visiblePhotoSources(container: HTMLElement): (string | null)[] {
	return [
		...container.querySelectorAll<HTMLImageElement>('[data-testid="wishlist-backdrop-photo"]'),
	]
		.filter((photo) => getComputedStyle(photo).display !== 'none')
		.map((photo) => photo.getAttribute('src'));
}

function darkModeDimIsVisible(container: HTMLElement): boolean {
	const dim = container.querySelector<HTMLElement>(
		'[data-testid="wishlist-backdrop-dark-mode-dim"]',
	);
	return dim !== null && dim.getBoundingClientRect().height > 0;
}

function visibleMotifSides(container: HTMLElement): string[] {
	return [...container.querySelectorAll<HTMLElement>('[data-testid="wishlist-backdrop-motif"]')]
		.filter((motif) => motif.getBoundingClientRect().width > 0)
		.map((motif) => motif.parentElement?.dataset.side ?? 'band');
}

describe('WishlistThemeBackdrop', () => {
	it('renders nothing when the wishlist has no backdrop', async () => {
		const container = await renderBackdrop({ mode: 'none', art: ART });

		expect(container.querySelector('[data-testid="wishlist-theme-backdrop"]')).toBeNull();
	});

	it('stays decorative and never takes pointer input', async () => {
		const container = await renderBackdrop({ mode: 'theme', art: ART });
		const backdrop = container.querySelector<HTMLElement>(
			'[data-testid="wishlist-theme-backdrop"]',
		);

		expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
		expect(getComputedStyle(backdrop!).pointerEvents).toBe('none');
	});

	it('places theme motifs in both side gutters on wide layouts', async () => {
		const container = await renderBackdrop({ mode: 'theme', art: ART, contentWidth: 1440 });

		expect(visibleMotifSides(container).sort()).toEqual(['left', 'right']);
	});

	it('moves theme motifs into the top strip on narrower layouts', async () => {
		const container = await renderBackdrop({ mode: 'theme', art: ART, contentWidth: 800 });

		expect(visibleMotifSides(container)).toEqual(['band']);
	});

	it('shows the custom photo at its focal point under the chosen dim', async () => {
		const container = await renderBackdrop({
			mode: 'custom',
			imageUrl: '/demo/playground/advent.jpg',
			background: { placement: 'full', dim: 35, focal: { x: 20, y: 70 } },
		});
		const photo = container.querySelector<HTMLImageElement>(
			'[data-testid="wishlist-backdrop-photo"]',
		);

		expect(photo?.getAttribute('src')).toBe('/demo/playground/advent.jpg');
		expect(photo?.getAttribute('alt')).toBe('');
		expect(getComputedStyle(photo!).objectPosition).toBe('20% 70%');
		const backdrop = container.querySelector<HTMLElement>(
			'[data-testid="wishlist-theme-backdrop"]',
		);
		expect(backdrop?.style.getPropertyValue('--photo-dim')).toBe('35%');
		expect(container.querySelector('[data-testid="wishlist-backdrop-motif"]')).toBeNull();
	});

	it('shows a library image like a custom photo, from its static files', async () => {
		const container = await renderBackdrop({
			mode: 'library',
			background: {
				libraryImageId: 'space-photo',
				placement: 'full',
				dim: 35,
				focal: { x: 20, y: 70 },
			},
		});
		const photo = container.querySelector<HTMLImageElement>(
			'[data-testid="wishlist-backdrop-photo"]',
		);

		expect(photo?.getAttribute('src')).toMatch(
			/\/wishlist-backgrounds\/space-photo-light-2560\.webp$/,
		);
		expect(photo?.getAttribute('srcset')).toMatch(
			/space-photo-light-1280\.webp 1280w, .*space-photo-light-2560\.webp 2560w$/,
		);
		expect(photo?.getAttribute('alt')).toBe('');
		expect(getComputedStyle(photo!).objectPosition).toBe('20% 70%');
		const backdrop = container.querySelector<HTMLElement>(
			'[data-testid="wishlist-theme-backdrop"]',
		);
		expect(backdrop?.style.getPropertyValue('--photo-dim')).toBe('35%');
		expect(container.querySelector('[data-testid="wishlist-backdrop-motif"]')).toBeNull();
	});

	it('shows a library image as the top strip on phones, like a custom photo', async () => {
		const container = await renderBackdrop({
			mode: 'library',
			background: { libraryImageId: 'space-photo', placement: 'full' },
			contentWidth: 400,
		});
		const photoFrame = container.querySelector<HTMLElement>('.wishlist-backdrop-photo');

		const photoFrameStyle = getComputedStyle(photoFrame!);
		expect(photoFrameStyle.position).toBe('absolute');
		expect(`${String(photoFrame!.getBoundingClientRect().height)}px`).toBe(
			photoFrameStyle.getPropertyValue('--wishlist-band-height').trim(),
		);
	});

	it.each([
		['light', /toys-illustrated-light-2560\.webp$/],
		['dark', /toys-illustrated-dark-2560\.webp$/],
	] as const)(
		'shows the %s file of a library image that has both, without the dark-mode dim',
		async (viewerMode, expectedSource) => {
			const container = await renderBackdrop({
				mode: 'library',
				background: { libraryImageId: 'toys-illustrated', placement: 'full' },
				viewerMode,
			});

			expect(visiblePhotoSources(container)).toEqual([expect.stringMatching(expectedSource)]);
			expect(darkModeDimIsVisible(container)).toBe(false);
		},
	);

	it.each(['light', 'dark'] as const)(
		'loads only the file of the %s viewer mode when a library image has both',
		async (viewerMode) => {
			const container = await renderBackdrop({
				mode: 'library',
				background: { libraryImageId: 'toys-illustrated' },
				viewerMode,
			});
			const photos = [
				...container.querySelectorAll<HTMLImageElement>(
					'[data-testid="wishlist-backdrop-photo"]',
				),
			];

			// A lazy image without a rendered box is never fetched.
			expect(photos.map((photo) => photo.loading)).toEqual(['lazy', 'lazy']);
			expect(
				photos.map((photo) => ({
					shownIn: photo.dataset.shownIn,
					rendered: photo.getClientRects().length > 0,
				})),
			).toEqual([
				{ shownIn: 'light', rendered: viewerMode === 'light' },
				{ shownIn: 'dark', rendered: viewerMode === 'dark' },
			]);
		},
	);

	it('dims a library image without a dark file in dark mode only', async () => {
		const lightContainer = await renderBackdrop({
			mode: 'library',
			background: { libraryImageId: 'space-photo', placement: 'full' },
			viewerMode: 'light',
		});
		expect(visiblePhotoSources(lightContainer)).toEqual([
			expect.stringMatching(/space-photo-light-2560\.webp$/),
		]);
		expect(darkModeDimIsVisible(lightContainer)).toBe(false);

		const darkContainer = await renderBackdrop({
			mode: 'library',
			background: { libraryImageId: 'space-photo', placement: 'full' },
			viewerMode: 'dark',
		});
		expect(visiblePhotoSources(darkContainer)).toEqual([
			expect.stringMatching(/space-photo-light-2560\.webp$/),
		]);
		expect(darkModeDimIsVisible(darkContainer)).toBe(true);
	});

	it('shows a dark-only library image as it is in light mode', async () => {
		const container = await renderBackdrop({
			mode: 'library',
			background: { libraryImageId: 'christmas-photo', placement: 'full' },
			viewerMode: 'light',
		});

		expect(visiblePhotoSources(container)).toEqual([
			expect.stringMatching(/christmas-photo-dark-2560\.webp$/),
		]);
		expect(darkModeDimIsVisible(container)).toBe(false);
	});

	it.each([
		['light', false],
		['dark', true],
	] as const)(
		'adds the automatic dim to a custom photo in %s mode: %s',
		async (viewerMode, dimmed) => {
			const container = await renderBackdrop({
				mode: 'custom',
				imageUrl: '/demo/playground/advent.jpg',
				background: { placement: 'full', dim: 20 },
				viewerMode,
			});

			expect(darkModeDimIsVisible(container)).toBe(dimmed);
			// The manager's own dim still applies in both modes.
			const backdrop = container.querySelector<HTMLElement>(
				'[data-testid="wishlist-theme-backdrop"]',
			);
			expect(backdrop?.style.getPropertyValue('--photo-dim')).toBe('20%');
		},
	);

	it('keeps the dark-mode dim on the phone strip, where the manager dim is off', async () => {
		const container = await renderBackdrop({
			mode: 'custom',
			imageUrl: '/demo/playground/advent.jpg',
			background: { placement: 'full', dim: 20 },
			viewerMode: 'dark',
			contentWidth: 400,
		});

		expect(darkModeDimIsVisible(container)).toBe(true);
		expect(getComputedStyle(container.querySelector('.wishlist-backdrop-dim')!).display).toBe(
			'none',
		);
	});

	it('drifts a library image with the page scroll', async () => {
		const container = await renderBackdrop({
			mode: 'library',
			background: { libraryImageId: 'space-photo' },
		});
		const photoFrame = container.querySelector<HTMLElement>('.wishlist-backdrop-photo');

		expect(photoFrame!.getAnimations().length).toBeGreaterThan(0);
	});

	it('drifts motifs with the page scroll by default', async () => {
		const container = await renderBackdrop({ mode: 'theme', art: ART });
		const motif = container.querySelector<HTMLElement>(
			'[data-testid="wishlist-backdrop-motif"]',
		);

		expect(motif!.getAnimations().length).toBeGreaterThan(0);
	});
});
