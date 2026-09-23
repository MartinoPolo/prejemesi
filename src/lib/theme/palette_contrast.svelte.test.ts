import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import '../../app.css';
import { PALETTES } from './palettes.js';
import { badgeVariants, BADGE_STYLES } from '../components/base/badge/badge_variants.js';
import { avatarVariants } from '../components/derived/avatar/avatar_variants.js';
import { buttonVariants } from '../components/base/button/button_variants.js';

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

function luminance(scope: HTMLElement, token: string, background?: string): number {
	const probe = document.createElement('span');
	scope.append(probe);
	const colors = (background !== undefined ? [background, token] : [token]).map((color) => {
		probe.style.color = `var(${color})`;
		return getComputedStyle(probe).color;
	});
	probe.remove();
	return compositedLuminance(colors);
}

function compositedLuminance(colors: readonly string[]): number {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Canvas unavailable');
	}
	for (const color of colors) {
		context.fillStyle = color;
		context.fillRect(0, 0, 1, 1);
	}
	const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => {
		const channel = value / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrastRatio(text: number, surface: number): number {
	return (Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05);
}

const textPairs = [
	['--foreground', '--background'],
	['--card-foreground', '--card'],
	['--popover-foreground', '--popover'],
	['--primary-foreground', '--primary'],
	['--primary-foreground', '--primary-hover'],
	['--brand', '--background'],
	['--brand', '--card'],
	['--brand', '--accent'],
	['--secondary-foreground', '--secondary'],
	['--accent-foreground', '--accent'],
	['--accent-loud-foreground', '--accent-loud'],
	['--note-ink', '--note-tint'],
	...['--background', '--card', '--secondary', '--muted', '--accent'].map((surface) => [
		'--muted-foreground',
		surface,
	]),
];

describe('danger text across palette surfaces', () => {
	it.each(PALETTES)('%s stays readable in light and dark root/nested scopes', async (palette) => {
		const nested = document.createElement('div');
		nested.setAttribute('data-palette', palette);
		document.body.append(nested);
		try {
			for (const mode of ['light', 'dark']) {
				document.documentElement.classList.toggle('dark', mode === 'dark');
				document.documentElement.setAttribute('data-palette', palette);
				for (const [scopeName, scope] of [
					['root', document.documentElement],
					['nested', nested],
				] as const) {
					for (const surfaceToken of ['--card', '--popover', '--accent']) {
						const surface = luminance(scope, surfaceToken);
						const text = luminance(scope, '--status-danger-text', surfaceToken);
						const contrast = contrastRatio(text, surface);
						expect(
							contrast,
							`${palette} ${mode} ${scopeName}: danger on ${surfaceToken}: ${contrast.toFixed(2)}`,
						).toBeGreaterThanOrEqual(4.5);
					}
					const { owner, surface: surfaceClass } = buttonVariants({ intent: 'danger' });
					const button = document.createElement('button');
					button.className = owner();
					button.dataset.testid = 'contrast-danger-button';
					const face = document.createElement('span');
					face.className = surfaceClass();
					button.append(face);
					scope.append(button);
					try {
						const restingBackground = getComputedStyle(face).backgroundColor;
						await page.getByTestId('contrast-danger-button').hover();
						const style = getComputedStyle(face);
						expect(style.backgroundColor).not.toBe(restingBackground);
						const card = document.createElement('span');
						card.style.color = 'var(--card)';
						scope.append(card);
						const base = getComputedStyle(card).color;
						card.remove();
						const surface = compositedLuminance([base, style.backgroundColor]);
						const text = compositedLuminance([
							base,
							style.backgroundColor,
							style.color,
						]);
						const contrast = contrastRatio(text, surface);
						expect(
							contrast,
							`${palette} ${mode} ${scopeName}: danger button hover: ${contrast.toFixed(2)}`,
						).toBeGreaterThanOrEqual(4.5);
					} finally {
						button.remove();
					}
				}
			}
		} finally {
			nested.remove();
		}
	});
});

describe('restrained dark palettes', () => {
	it.each(PALETTES)(
		'%s keeps dark surfaces and readable semantic text in both scopes',
		(palette) => {
			document.documentElement.classList.add('dark');
			document.documentElement.setAttribute('data-palette', palette);
			const nested = document.createElement('div');
			nested.setAttribute('data-palette', palette);
			document.body.append(nested);
			try {
				for (const scope of [document.documentElement, nested]) {
					expect(luminance(scope, '--background')).toBeLessThan(0.01);
					expect(luminance(scope, '--card')).toBeGreaterThan(
						luminance(scope, '--background'),
					);
					expect(luminance(scope, '--card')).toBeLessThan(0.025);
					const samples = [
						...BADGE_STYLES.map((badgeStyle) =>
							badgeVariants({ tone: 'primary', badgeStyle }),
						),
						avatarVariants().fallback(),
						avatarVariants({ appearance: 'recipient' }).fallback(),
					];
					for (const className of samples) {
						const sample = document.createElement('span');
						sample.className = className;
						scope.append(sample);
						const style = getComputedStyle(sample);
						const backing = document.createElement('span');
						backing.style.color = 'var(--card)';
						scope.append(backing);
						const surfaces = [getComputedStyle(backing).color, style.backgroundColor];
						const surface = compositedLuminance(surfaces);
						const text = compositedLuminance([...surfaces, style.color]);
						sample.remove();
						backing.remove();
						expect(
							(Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05),
							`${palette}: ${className}`,
						).toBeGreaterThanOrEqual(4.5);
					}
					for (const [foreground, background] of textPairs) {
						const text = luminance(scope, foreground!, background!);
						const surface = luminance(scope, background!);
						const contrast =
							(Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05);
						expect(
							contrast,
							`${palette}: ${foreground} on ${background}`,
						).toBeGreaterThanOrEqual(4.5);
					}
				}
			} finally {
				nested.remove();
			}
		},
	);
});
