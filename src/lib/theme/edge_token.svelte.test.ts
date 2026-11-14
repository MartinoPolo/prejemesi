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

describe('sticker outline token', () => {
	it.each(['light', 'dark'] as const)(
		'outlines match text ink on the page, in a nested palette and in a dark subtree in %s mode',
		(mode) => {
			document.documentElement.classList.toggle('dark', mode === 'dark');
			document.documentElement.setAttribute('data-palette', 'sky');
			const scopes = [
				createScope({ 'data-palette': 'grape' }),
				createScope({ class: 'dark' }),
			];
			try {
				for (const scope of [document.body, ...scopes]) {
					expect(edgeUtilityColor(scope)).toBe(textInkColor(scope));
				}
			} finally {
				for (const scope of scopes) {
					scope.remove();
				}
			}
		},
	);

	it('outlines match text ink in a palette nested inside a dark subtree of a light page', () => {
		document.documentElement.setAttribute('data-palette', 'sky');
		const darkSubtree = createScope({ class: 'dark' });
		const nestedPalette = document.createElement('div');
		nestedPalette.setAttribute('data-palette', 'grape');
		darkSubtree.append(nestedPalette);
		try {
			expect(textInkColor(nestedPalette)).not.toBe(textInkColor(document.body));
			expect(edgeUtilityColor(nestedPalette)).toBe(textInkColor(nestedPalette));
		} finally {
			darkSubtree.remove();
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
