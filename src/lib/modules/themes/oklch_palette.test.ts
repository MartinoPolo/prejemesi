import { describe, it, expect } from 'vitest';
import { deriveOklchPalette, parseOklch, toModeAwarePalette } from './oklch_palette.js';
import { THEME_PRESETS } from './theme_presets.js';
import type { ThemePalette } from './types.js';

/** Token keys introduced by the image-frame foundation (issue #34). */
const IMAGE_FRAME_TOKEN_KEYS = [
	'--wishlist-preview',
	'--wishlist-page',
	'--wishlist-icon',
	'--wishlist-image-frame',
] as const;

describe('THEME_PRESETS palettes', () => {
	it('every preset defines a valid OKLCH value for the new tokens', () => {
		for (const preset of Object.values(THEME_PRESETS)) {
			for (const key of IMAGE_FRAME_TOKEN_KEYS) {
				const value = preset.palette[key];
				expect(value, `${preset.name} ${key}`).toBeDefined();
				expect(parseOklch(value), `${preset.name} ${key} parseable`).not.toBeNull();
			}
		}
	});
});

describe('deriveOklchPalette — image-frame tokens', () => {
	const palette = deriveOklchPalette('oklch(0.54 0.14 275)');

	/** Assert the palette derived and return a parsed token, failing the test otherwise. */
	function token(key: keyof NonNullable<typeof palette>) {
		expect(palette, 'palette derived').not.toBeNull();
		const parsed = palette === null ? null : parseOklch(palette[key]);
		expect(parsed, `${key} parseable`).not.toBeNull();
		// Non-null guaranteed by the assertion above; narrow for the type checker.
		return parsed ?? { lightness: 0, chroma: 0, hue: 0 };
	}

	it('derives all new tokens as valid OKLCH from a custom base color', () => {
		for (const key of IMAGE_FRAME_TOKEN_KEYS) {
			token(key);
		}
	});

	it('normalizes icon lightness independent of the base color (always readable on its surface)', () => {
		// The icon lightness is fixed (brief: "primary @ ~55% L") so a very light or
		// very dark custom base both yield the same readable mid-lightness.
		const darkBase = parseOklch(
			deriveOklchPalette('oklch(0.18 0.14 275)')?.['--wishlist-icon'] ?? '',
		);
		const lightBase = parseOklch(
			deriveOklchPalette('oklch(0.92 0.14 275)')?.['--wishlist-icon'] ?? '',
		);
		expect(darkBase).not.toBeNull();
		expect(lightBase).not.toBeNull();
		expect(darkBase?.lightness).toBe(0.55);
		expect(lightBase?.lightness).toBe(0.55);
		// and it carries the base hue, not a fixed one
		expect(darkBase?.hue).toBe(275);
	});

	it('derives a light preview surface tint (not dark) for the light palette', () => {
		expect(token('--wishlist-preview').lightness).toBeGreaterThan(0.85);
	});

	it('keeps the image-frame fill light and very low chroma', () => {
		const frame = token('--wishlist-image-frame');
		expect(frame.lightness).toBeGreaterThan(0.85);
		expect(frame.chroma).toBeLessThan(0.05);
	});

	it('returns null for an invalid base color', () => {
		expect(deriveOklchPalette('not-a-color')).toBeNull();
	});
});

describe('toModeAwarePalette — dark-mode safety', () => {
	/** Extract the dark (second) argument of a `light-dark(<light>, <dark>)` value. */
	function darkArg(value: string): string | null {
		const match = value.match(/^light-dark\((.+?),\s*(.+)\)$/);
		return match === null ? null : match[2];
	}

	/** Surface/background tokens that must darken in dark mode (per app.css `.dark`). */
	const darkSurfaceKeys = [
		'--wishlist-surface',
		'--wishlist-surface-hover',
		'--wishlist-muted',
		'--wishlist-preview',
		'--wishlist-page',
		'--wishlist-image-frame',
	] as const satisfies readonly (keyof ThemePalette)[];

	const lightPreset = THEME_PRESETS.christmas.palette;
	const modeAware = toModeAwarePalette(lightPreset);

	it('darkens every surface token to a low-lightness variant (not the light value)', () => {
		for (const key of darkSurfaceKeys) {
			const dark = parseOklch(darkArg(modeAware[key]) ?? '');
			const light = parseOklch(lightPreset[key]);
			expect(dark, `${key} has a parseable dark variant`).not.toBeNull();
			expect(light).not.toBeNull();
			// Dark surface must be substantially darker than the light surface.
			expect(dark?.lightness, `${key} darkens`).toBeLessThan(0.35);
			expect(dark?.lightness).toBeLessThan(light?.lightness ?? 0);
		}
	});

	it('lightens the foreground-on-dark tokens (icon, muted-fg) for contrast on dark surfaces', () => {
		for (const key of ['--wishlist-icon', '--wishlist-muted-fg'] as const) {
			const dark = parseOklch(darkArg(modeAware[key]) ?? '');
			expect(dark?.lightness, `${key} is light enough for dark bg`).toBeGreaterThan(0.65);
		}
	});

	it('uses white-alpha borders in dark mode (hue-independent separators)', () => {
		expect(darkArg(modeAware['--wishlist-border'])).toBe('oklch(1 0 0 / 12%)');
		expect(darkArg(modeAware['--wishlist-border-strong'])).toBe('oklch(1 0 0 / 20%)');
	});

	it('leaves brand/foreground tokens unchanged (emitted unwrapped)', () => {
		for (const key of [
			'--wishlist-primary',
			'--wishlist-accent',
			'--wishlist-primary-fg',
		] as const) {
			expect(modeAware[key]).toBe(lightPreset[key]);
		}
	});

	it('preserves the light value as the first light-dark() argument', () => {
		const value = modeAware['--wishlist-surface'];
		expect(value.startsWith(`light-dark(${lightPreset['--wishlist-surface']},`)).toBe(true);
	});

	it('applies equally to a derived custom palette', () => {
		const custom = deriveOklchPalette('oklch(0.54 0.14 275)');
		expect(custom).not.toBeNull();
		const aware = toModeAwarePalette(custom ?? ({} as ThemePalette));
		const darkSurface = parseOklch(darkArg(aware['--wishlist-surface']) ?? '');
		expect(darkSurface?.lightness).toBeLessThan(0.35);
	});
});
