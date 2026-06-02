import { describe, it, expect } from 'vitest';
import { deriveOklchPalette, parseOklch } from './oklch_palette.js';
import { THEME_PRESETS } from './theme_presets.js';

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
