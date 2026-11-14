import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTES } from './palettes.js';

const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

function paletteBlock(palette: string): string {
	const block = new RegExp(`\\[data-palette='${palette}'\\][^{]*\\{([^}]*)\\}`).exec(css);
	expect(block, `missing palette block: ${palette}`).not.toBeNull();
	return block![1]!;
}

function primitive(block: string, name: string): string | undefined {
	return new RegExp(`--p-${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim();
}

function linearChannel(value: number): number {
	const channel = value / 255;
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** OKLCH chroma and hue of a hex colour (Björn Ottosson's OKLab matrices). */
function oklchOf(hex: string): { chroma: number; hue: number } {
	const value = Number.parseInt(hex.slice(1), 16);
	const [red, green, blue] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(
		linearChannel,
	) as [number, number, number];
	const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
	const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
	const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
	const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short;
	const b = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short;
	const hue = (Math.atan2(b, a) * 180) / Math.PI;
	return { chroma: Math.hypot(a, b), hue: hue < 0 ? hue + 360 : hue };
}

function expectComponentsMatch(block: string, colorName: string, label: string) {
	const hex = primitive(block, colorName);
	const chroma = primitive(block, `${colorName}-chroma`);
	const hue = primitive(block, `${colorName}-hue`);
	expect(hex, `${label}: --p-${colorName}`).toMatch(/^#[\da-f]{6}$/i);
	expect(chroma, `${label}: --p-${colorName}-chroma`).toBeDefined();
	expect(hue, `${label}: --p-${colorName}-hue`).toBeDefined();
	const expected = oklchOf(hex!);
	expect(Number(chroma), `${label} chroma`).toBeCloseTo(expected.chroma, 3);
	expect(Number(hue), `${label} hue`).toBeCloseTo(expected.hue, 0);
}

describe('palette OKLCH components', () => {
	it.each(PALETTES)('%s declares the chroma and hue of its brand hex', (palette) => {
		expectComponentsMatch(paletteBlock(palette), 'brand', palette);
	});

	it.each(PALETTES)('%s declares accent components wherever it declares an accent', (palette) => {
		const block = paletteBlock(palette);
		if (primitive(block, 'accent') !== undefined) {
			expectComponentsMatch(block, 'accent', palette);
		}
	});
});
