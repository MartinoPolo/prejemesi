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

function resolvedToken(scope: Element, token: string): string {
	const probe = document.createElement('span');
	probe.style.color = `var(${token})`;
	scope.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	return color;
}

function inheritedTextColor(scope: Element): string {
	const text = document.createElement('p');
	text.textContent = 'Inherited text';
	scope.append(text);
	const color = getComputedStyle(text).color;
	text.remove();
	return color;
}

describe('nested palette scope text colour', () => {
	it.each(['light', 'dark'] as const)(
		'inherited text follows the wishlist foreground in %s mode while the viewer chrome keeps its own',
		(mode) => {
			document.documentElement.classList.toggle('dark', mode === 'dark');
			document.documentElement.setAttribute('data-palette', 'sky');
			const chrome = document.createElement('nav');
			const wishlistScope = document.createElement('div');
			wishlistScope.setAttribute('data-palette', 'grape');
			const heading = document.createElement('h1');
			wishlistScope.append(heading);
			document.body.append(chrome, wishlistScope);
			try {
				const viewerForeground = resolvedToken(document.body, '--foreground');
				const wishlistForeground = resolvedToken(wishlistScope, '--foreground');
				expect(wishlistForeground).not.toBe(viewerForeground);

				expect(getComputedStyle(heading).color).toBe(wishlistForeground);
				expect(inheritedTextColor(wishlistScope)).toBe(wishlistForeground);
				expect(inheritedTextColor(chrome)).toBe(viewerForeground);
			} finally {
				chrome.remove();
				wishlistScope.remove();
			}
		},
	);

	it('a colour utility on the scope element still wins over the scope foreground', () => {
		document.documentElement.setAttribute('data-palette', 'sky');
		const wishlistScope = document.createElement('div');
		wishlistScope.setAttribute('data-palette', 'grape');
		wishlistScope.className = 'text-primary';
		document.body.append(wishlistScope);
		try {
			expect(getComputedStyle(wishlistScope).color).toBe(
				resolvedToken(wishlistScope, '--primary'),
			);
		} finally {
			wishlistScope.remove();
		}
	});
});
