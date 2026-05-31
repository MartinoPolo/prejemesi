import type { ThemePalette } from './types.js';

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
	};
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
	const lms_l = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
	const lms_m = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
	const lms_s = 0.0482003018 * x + 0.2643662691 * y + 0.633851707 * z;

	// Cube root
	const cbrt = (n: number) => (n >= 0 ? Math.pow(n, 1 / 3) : -Math.pow(-n, 1 / 3));
	const lms_l_ = cbrt(lms_l);
	const lms_m_ = cbrt(lms_m);
	const lms_s_ = cbrt(lms_s);

	// LMS to OKLab
	const labL = 0.2104542553 * lms_l_ + 0.793617785 * lms_m_ - 0.0040720468 * lms_s_;
	const labA = 1.9779984951 * lms_l_ - 2.428592205 * lms_m_ + 0.4505937099 * lms_s_;
	const labB = 0.0259040371 * lms_l_ + 0.7827717662 * lms_m_ - 0.808675766 * lms_s_;

	// OKLab to OKLCH
	const lightness = labL;
	const chroma = Math.sqrt(labA * labA + labB * labB);
	const hue = wrapHue((Math.atan2(labB, labA) * 180) / Math.PI);

	return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(0)})`;
}
