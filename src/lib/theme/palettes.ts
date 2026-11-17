/**
 * Redesign 2026 „Anime Sky" — the single theming system.
 * 10 curated palettes; each defines 4–6 CSS primitives in `src/app.css`
 * (`--p-brand`, `--p-deep`, `--p-ink`, `--p-bright`, `--p-accent`,
 * `--p-on-accent`) from which every other color token derives.
 *
 * Applied as `data-palette` on `<html>` (viewer preference, set server-side
 * in hooks.server.ts before first byte) and on the wishlist page wrapper
 * (per-wishlist identity).
 */
export const PALETTES = [
	'sky',
	'mint',
	'peach',
	'grape',
	'sakura',
	'ocean',
	'honey',
	'ruby',
	'matcha',
	'graphite',
] as const;

export type Palette = (typeof PALETTES)[number];

export const DEFAULT_PALETTE: Palette = 'sky';

/** Cookie mirroring the persisted palette so SSR can theme anonymous users too. */
export const PALETTE_COOKIE_NAME = 'app-palette';

/** Czech display names (product names, shown in both locales). */
export const PALETTE_LABELS: Record<Palette, string> = {
	sky: 'Obloha',
	mint: 'Máta',
	peach: 'Broskev',
	grape: 'Hrozen',
	sakura: 'Sakura',
	ocean: 'Oceán',
	honey: 'Med',
	ruby: 'Malina',
	matcha: 'Matcha',
	graphite: 'Tužka',
};

/** Swatch color per palette (the `--p-brand` primitive) for chooser UIs. */
export const PALETTE_SWATCHES: Record<Palette, string> = {
	sky: '#1e9be9',
	mint: '#14a56f',
	peach: '#f97250',
	grape: '#8b5cf6',
	sakura: '#ec5fa3',
	ocean: '#0fa8a8',
	honey: '#efa00b',
	ruby: '#e23a57',
	matcha: '#7fb023',
	graphite: '#526a85',
};

export function isPalette(value: unknown): value is Palette {
	return typeof value === 'string' && (PALETTES as readonly string[]).includes(value);
}
