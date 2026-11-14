import { afterEach, describe, expect, it } from 'vitest';
import '../../app.css';

const originalClass = document.documentElement.className;
const originalPalette = document.documentElement.getAttribute('data-palette');

afterEach(() => {
	document.documentElement.className = originalClass;
	if (originalPalette === null) {
		document.documentElement.removeAttribute('data-palette');
	} else {
		document.documentElement.setAttribute('data-palette', originalPalette);
	}
});

function textInkColor(scope: Element): string {
	const probe = document.createElement('span');
	probe.style.color = 'var(--ink)';
	scope.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	return color;
}

function edgeUtilityColor(scope: Element): string {
	const probe = document.createElement('span');
	probe.className = 'border-2 border-edge';
	// An unrelated text colour keeps a missing token from passing through the currentColor fallback.
	probe.style.color = 'rgb(1, 2, 3)';
	scope.append(probe);
	const color = getComputedStyle(probe).borderTopColor;
	probe.remove();
	return color;
}

function createScope(attributes: Readonly<Record<string, string>>): HTMLElement {
	const scope = document.createElement('div');
	for (const [name, value] of Object.entries(attributes)) {
		scope.setAttribute(name, value);
	}
	document.body.append(scope);
	return scope;
}

function luminanceOf(color: string): number {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	const context = canvas.getContext('2d')!;
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => {
		const channel = value / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function tokenColor(scope: Element, token: string): string {
	const probe = document.createElement('span');
	probe.style.color = `var(${token})`;
	scope.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	return color;
}

describe('sticker outline token', () => {
	it('outlines match text ink on the page and in a nested palette in light mode', () => {
		document.documentElement.classList.remove('dark');
		document.documentElement.setAttribute('data-palette', 'sky');
		const nested = createScope({ 'data-palette': 'grape' });
		try {
			for (const scope of [document.body, nested]) {
				expect(edgeUtilityColor(scope)).toBe(textInkColor(scope));
			}
		} finally {
			nested.remove();
		}
	});

	it('dark outlines are their own dark ink below the card, following each palette scope', () => {
		document.documentElement.classList.add('dark');
		document.documentElement.setAttribute('data-palette', 'sky');
		const scopes = [
			createScope({ 'data-palette': 'grape' }),
			createScope({ 'data-dark-palette': 'honey' }),
		];
		try {
			for (const scope of [document.body, ...scopes]) {
				const edge = edgeUtilityColor(scope);
				expect(edge).not.toBe(textInkColor(scope));
				expect(luminanceOf(edge)).toBeLessThan(luminanceOf(tokenColor(scope, '--card')));
				expect(luminanceOf(edge)).toBeLessThan(
					luminanceOf(tokenColor(scope, '--background')),
				);
			}
			expect(edgeUtilityColor(scopes[0]!)).not.toBe(edgeUtilityColor(document.body));
			expect(edgeUtilityColor(scopes[1]!)).not.toBe(edgeUtilityColor(document.body));
			const honeyPalette = createScope({ 'data-palette': 'honey' });
			try {
				for (const token of ['--edge', '--card', '--primary', '--background']) {
					expect(tokenColor(scopes[1]!, token), token).toBe(
						tokenColor(honeyPalette, token),
					);
				}
			} finally {
				honeyPalette.remove();
			}
		} finally {
			for (const scope of scopes) {
				scope.remove();
			}
		}
	});

	it('a dark-only layer palette leaves light mode in the viewer palette', () => {
		document.documentElement.classList.remove('dark');
		document.documentElement.setAttribute('data-palette', 'sky');
		const layer = createScope({ 'data-dark-palette': 'honey' });
		try {
			expect(edgeUtilityColor(layer)).toBe(edgeUtilityColor(document.body));
			expect(tokenColor(layer, '--primary')).toBe(tokenColor(document.body, '--primary'));
		} finally {
			layer.remove();
		}
	});

	it('outlines match text ink in a light-scope palette in dark mode', () => {
		document.documentElement.classList.add('dark');
		document.documentElement.setAttribute('data-palette', 'sky');
		const lightScope = createScope({ 'data-light-scope': '' });
		const nestedPalette = document.createElement('div');
		nestedPalette.setAttribute('data-palette', 'grape');
		lightScope.append(nestedPalette);
		const lightScopePalette = createScope({ 'data-light-scope': '', 'data-palette': 'grape' });
		try {
			for (const scope of [nestedPalette, lightScopePalette]) {
				expect(textInkColor(scope)).not.toBe(textInkColor(document.body));
				expect(edgeUtilityColor(scope)).toBe(textInkColor(scope));
			}
		} finally {
			lightScope.remove();
			lightScopePalette.remove();
		}
	});
});
