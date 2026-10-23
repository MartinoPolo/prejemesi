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
}

async function renderBackdrop({
	mode,
	art = null,
	imageUrl = null,
	background = {},
	contentWidth = 1440,
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
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
	return container;
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

	it('drifts motifs with the page scroll by default', async () => {
		const container = await renderBackdrop({ mode: 'theme', art: ART });
		const motif = container.querySelector<HTMLElement>(
			'[data-testid="wishlist-backdrop-motif"]',
		);

		expect(getComputedStyle(motif!).animationName).toContain('wishlist-backdrop-motif-drift');
	});

	it('stops the scroll drift when motion is off', async () => {
		const container = await renderBackdrop({
			mode: 'theme',
			art: ART,
			background: { motion: 'off' },
		});
		const motif = container.querySelector<HTMLElement>(
			'[data-testid="wishlist-backdrop-motif"]',
		);

		expect(getComputedStyle(motif!).animationName).toBe('none');
	});
});
