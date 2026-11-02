import { afterEach, describe, expect, it } from 'vitest';
import '../../app.css';
import { WISHLIST_THEME_IDS, WISHLIST_THEMES } from './wishlist_themes.js';

const originalClass = document.documentElement.className;

afterEach(() => {
	document.documentElement.className = originalClass;
	document.querySelectorAll('[data-wishlist-theme]').forEach((scope) => scope.remove());
});

function tokenLuminance(scope: HTMLElement, token: string): number {
	const probe = document.createElement('span');
	probe.style.color = `var(${token})`;
	scope.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Canvas unavailable');
	}
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => {
		const channel = value / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrastRatio(first: number, second: number): number {
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function renderThemeScope(themeId: (typeof WISHLIST_THEME_IDS)[number]): HTMLElement {
	const scope = document.createElement('div');
	scope.dataset.palette = WISHLIST_THEMES[themeId].palette;
	scope.dataset.wishlistTheme = themeId;
	document.body.append(scope);
	return scope;
}

describe.each(['light', 'dark'] as const)('wishlist motifs in %s mode', (mode) => {
	it.each(WISHLIST_THEME_IDS)(`%s paints a ${mode} backdrop`, (themeId) => {
		document.documentElement.classList.toggle('dark', mode === 'dark');
		const backdropLuminance = tokenLuminance(renderThemeScope(themeId), '--theme-top');

		if (mode === 'light') {
			expect(backdropLuminance).toBeGreaterThan(0.5);
		} else {
			expect(backdropLuminance).toBeLessThan(0.15);
		}
	});

	// Outline-free line art (snowflakes, rules, dots) needs WCAG non-text contrast on its backdrop.
	it.each(WISHLIST_THEME_IDS)('%s line art stands out from its backdrop', (themeId) => {
		document.documentElement.classList.toggle('dark', mode === 'dark');
		const scope = renderThemeScope(themeId);

		expect(
			contrastRatio(tokenLuminance(scope, '--m-line'), tokenLuminance(scope, '--theme-top')),
		).toBeGreaterThanOrEqual(3);
	});
});
