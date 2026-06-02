import type { ThemePalette } from './types.js';
import { THEME_PALETTE_KEYS } from './types.js';

interface OklchComponents {
	lightness: number;
	chroma: number;
	hue: number;
}

/** Parse an OKLCH color string like "oklch(0.5 0.12 150)" into components */
export function parseOklch(color: string): OklchComponents | null {
	const match = color.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
	if (match === null) {
		return null;
	}
	const lightness = Number(match[1]);
	const chroma = Number(match[2]);
	const hue = Number(match[3]);
	if (Number.isNaN(lightness) || Number.isNaN(chroma) || Number.isNaN(hue)) {
		return null;
	}
	return { lightness, chroma, hue };
}

/** Format OKLCH components back to a CSS string */
function formatOklch(components: OklchComponents): string {
	const l = components.lightness.toFixed(3);
	const c = components.chroma.toFixed(3);
	const h = components.hue.toFixed(0);
	return `oklch(${l} ${c} ${h})`;
}

/** Clamp a number to [min, max] */
function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** Wrap hue to [0, 360) */
function wrapHue(hue: number): number {
	return ((hue % 360) + 360) % 360;
}

/**
 * Determine whether to use light or dark foreground text
 * based on the lightness of the background color.
 */
function chooseForeground(backgroundLightness: number): string {
	return backgroundLightness > 0.6 ? 'oklch(0.20 0.02 0)' : 'oklch(0.98 0.005 0)';
}

/**
 * Derive a complete wishlist theme palette from a single OKLCH base color.
 * All derivation happens in OKLCH color space for perceptual uniformity.
 */
export function deriveOklchPalette(baseColor: string): ThemePalette | null {
	const base = parseOklch(baseColor);
	if (base === null) {
		return null;
	}

	const { lightness, chroma, hue } = base;

	// Primary: use the base color directly, adjusted to a good range
	const primaryL = clamp(lightness, 0.35, 0.65);
	const primaryC = clamp(chroma, 0.08, 0.22);
	const primary: OklchComponents = { lightness: primaryL, chroma: primaryC, hue };

	// Primary foreground: white or dark based on lightness
	const primaryFg = chooseForeground(primaryL);

	// Accent: shift hue by +60 degrees, slightly different lightness
	const accentHue = wrapHue(hue + 60);
	const accentL = clamp(primaryL + 0.08, 0.4, 0.72);
	const accentC = clamp(chroma * 0.85, 0.06, 0.18);
	const accent: OklchComponents = { lightness: accentL, chroma: accentC, hue: accentHue };
	const accentFg = chooseForeground(accentL);

	// Surface: very light, slightly tinted version
	const surface: OklchComponents = {
		lightness: 0.985,
		chroma: clamp(chroma * 0.06, 0.003, 0.015),
		hue,
	};

	// Surface hover: slightly darker than surface
	const surfaceHover: OklchComponents = {
		lightness: 0.97,
		chroma: clamp(chroma * 0.1, 0.005, 0.02),
		hue,
	};

	// Border: subtle, low chroma
	const border: OklchComponents = {
		lightness: 0.92,
		chroma: clamp(chroma * 0.12, 0.005, 0.025),
		hue,
	};

	// Border strong: more visible
	const borderStrong: OklchComponents = {
		lightness: 0.85,
		chroma: clamp(chroma * 0.2, 0.01, 0.05),
		hue,
	};

	// Muted: light background tint
	const muted: OklchComponents = {
		lightness: 0.965,
		chroma: clamp(chroma * 0.08, 0.004, 0.015),
		hue,
	};

	// Muted foreground: medium lightness text
	const mutedFg: OklchComponents = {
		lightness: 0.55,
		chroma: clamp(chroma * 0.3, 0.02, 0.07),
		hue,
	};

	// Preview: themed card preview surface — a noticeable light tint of the primary
	const preview: OklchComponents = {
		lightness: 0.96,
		chroma: clamp(chroma * 0.22, 0.015, 0.05),
		hue,
	};

	// Page: very light page background tint, subtler than the preview
	const page: OklchComponents = {
		lightness: 0.985,
		chroma: clamp(chroma * 0.06, 0.004, 0.012),
		hue,
	};

	// Icon/pattern fill for fallback visuals. Lightness is normalized to a fixed
	// mid value (per the brief: "icon = primary @ ~55% L") — deliberately
	// independent of the base color's lightness so the icon always keeps WCAG AA
	// contrast on the light surface, whether the user picks a very light or very
	// dark base. Only the hue and (scaled) chroma carry the base color's identity.
	const iconLightness = 0.55;
	const icon: OklchComponents = {
		lightness: iconLightness,
		chroma: clamp(chroma * 0.8, 0.06, 0.16),
		hue,
	};

	// Image-frame letterbox fill: light, very low chroma neutral-warm tint
	const imageFrame: OklchComponents = {
		lightness: 0.95,
		chroma: clamp(chroma * 0.08, 0.004, 0.018),
		hue,
	};

	return {
		'--wishlist-primary': formatOklch(primary),
		'--wishlist-primary-fg': primaryFg,
		'--wishlist-accent': formatOklch(accent),
		'--wishlist-accent-fg': accentFg,
		'--wishlist-surface': formatOklch(surface),
		'--wishlist-surface-hover': formatOklch(surfaceHover),
		'--wishlist-border': formatOklch(border),
		'--wishlist-border-strong': formatOklch(borderStrong),
		'--wishlist-muted': formatOklch(muted),
		'--wishlist-muted-fg': formatOklch(mutedFg),
		'--wishlist-preview': formatOklch(preview),
		'--wishlist-page': formatOklch(page),
		'--wishlist-icon': formatOklch(icon),
		'--wishlist-image-frame': formatOklch(imageFrame),
	};
}

/**
 * Fixed dark-mode lightness per surface/background token. Mirrors the `.dark`
 * `--wishlist-*` defaults in app.css so a per-wishlist palette darkens to the
 * same target as the global tokens. Hue + chroma are carried over from the
 * light value (keeping the theme's identity); only lightness is remapped.
 * Foreground/brand tokens (primary, accent, *-fg) are absent → left unchanged.
 */
const DARK_LIGHTNESS: Partial<Record<keyof ThemePalette, number>> = {
	'--wishlist-surface': 0.2,
	'--wishlist-surface-hover': 0.24,
	'--wishlist-muted': 0.25,
	'--wishlist-muted-fg': 0.72,
	'--wishlist-preview': 0.26,
	'--wishlist-page': 0.17,
	'--wishlist-icon': 0.7,
	'--wishlist-image-frame': 0.22,
};

/**
 * Tokens whose dark variant is a fixed value rather than a lightness remap.
 * Borders use white-alpha in dark mode (mirrors app.css `.dark`) so they read
 * as subtle separators on dark surfaces regardless of the theme hue.
 */
const DARK_FIXED: Partial<Record<keyof ThemePalette, string>> = {
	'--wishlist-border': 'oklch(1 0 0 / 12%)',
	'--wishlist-border-strong': 'oklch(1 0 0 / 20%)',
};

/** Produce the dark-mode value for a single palette token from its light value. */
function toDarkValue(key: keyof ThemePalette, lightValue: string): string {
	const fixed = DARK_FIXED[key];
	if (fixed !== undefined) {
		return fixed;
	}
	const targetLightness = DARK_LIGHTNESS[key];
	if (targetLightness === undefined) {
		return lightValue;
	}
	const parsed = parseOklch(lightValue);
	if (parsed === null) {
		return lightValue;
	}
	return formatOklch({ ...parsed, lightness: targetLightness });
}

/**
 * Wrap a light-only palette into mode-aware values using the CSS `light-dark()`
 * function. Each token becomes `light-dark(<light>, <dark>)`, so the same
 * applied inline style resolves to the correct surface in both modes and
 * live-updates when the `.dark` class (and thus computed `color-scheme`)
 * toggles — no re-apply needed. Tokens whose dark value equals the light value
 * are emitted unwrapped to keep output minimal.
 *
 * Requires `color-scheme: light`/`dark` to be set on `:root`/`.dark` (app.css)
 * — `light-dark()` keys off the computed `color-scheme`, not the `.dark` class.
 */
export function toModeAwarePalette(light: ThemePalette): ThemePalette {
	const result = {} as Record<keyof ThemePalette, string>;
	for (const key of THEME_PALETTE_KEYS) {
		const lightValue = light[key];
		const darkValue = toDarkValue(key, lightValue);
		result[key] =
			darkValue === lightValue ? lightValue : `light-dark(${lightValue}, ${darkValue})`;
	}
	return result;
}

/**
 * Convert a hex color to an OKLCH string.
 * Uses approximate sRGB -> OKLCH conversion for the color picker input.
 */
export function hexToOklch(hex: string): string | null {
	const cleanHex = hex.replace('#', '');
	if (cleanHex.length !== 6) {
		return null;
	}
	const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
	const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
	const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

	// sRGB to linear RGB
	const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
	const lr = toLinear(r);
	const lg = toLinear(g);
	const lb = toLinear(b);

	// Linear RGB to XYZ (D65)
	const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
	const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
	const z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb;

	// XYZ to LMS (using M1 matrix)
	const lmsL = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
	const lmsM = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
	const lmsS = 0.0482003018 * x + 0.2643662691 * y + 0.633851707 * z;

	// Cube root
	const cbrt = (n: number) => (n >= 0 ? Math.pow(n, 1 / 3) : -Math.pow(-n, 1 / 3));
	const lmsLPrime = cbrt(lmsL);
	const lmsMPrime = cbrt(lmsM);
	const lmsSPrime = cbrt(lmsS);

	// LMS to OKLab
	const labL = 0.2104542553 * lmsLPrime + 0.793617785 * lmsMPrime - 0.0040720468 * lmsSPrime;
	const labA = 1.9779984951 * lmsLPrime - 2.428592205 * lmsMPrime + 0.4505937099 * lmsSPrime;
	const labB = 0.0259040371 * lmsLPrime + 0.7827717662 * lmsMPrime - 0.808675766 * lmsSPrime;

	// OKLab to OKLCH
	const lightness = labL;
	const chroma = Math.sqrt(labA * labA + labB * labB);
	const hue = wrapHue((Math.atan2(labB, labA) * 180) / Math.PI);

	return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(0)})`;
}
