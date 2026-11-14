import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import '../../app.css';
import { PALETTES } from './palettes.js';
import { DEPTH_STYLES } from './depth_styles.js';
import { DARK_WISHLIST_BACKGROUNDS } from './dark_wishlist_background.js';
import { badgeVariants, BADGE_STYLES } from '../components/base/badge/badge_variants.js';
import { avatarVariants } from '../components/derived/avatar/avatar_variants.js';
import { buttonVariants } from '../components/base/button/button_variants.js';
import { helpTextVariants } from '../components/base/help-text/help_text_variants.js';
import { toastTitleColors, toastVariants } from '../components/base/toast/toast_variants.js';
import { statusBadgeVariants } from '../components/derived/status-badge/status_badge_variants.js';
import { alertVariants } from '../components/base/alert/alert_variants.js';
import { fieldErrorVariants } from '../components/derived/field/field_variants.js';
import { moderatorPanelVariants } from '../components/blocks/moderator/moderator_panel_variants.js';

const originalClass = document.documentElement.className;
const originalPalette = document.documentElement.getAttribute('data-palette');

afterEach(() => {
	document.documentElement.className = originalClass;
	document.documentElement.removeAttribute('data-depth');
	document.documentElement.removeAttribute('data-dark-wishlist-background');
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

/** Contrast of a styled sample's text over its own background composited on `--card`. */
function sampleContrast(scope: HTMLElement, className: string): number {
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
	return contrastRatio(text, surface);
}

type ButtonIntent = keyof typeof buttonVariants.variants.intent;

/** Contrast of a rendered button's label over its face, resting and hovered, composited on `--card`. */
async function buttonContrast(
	scope: HTMLElement,
	intent: ButtonIntent,
): Promise<{ resting: number; hovered: number; hoverChangesFill: boolean }> {
	const { owner, surface: surfaceClass } = buttonVariants({ intent });
	const button = document.createElement('button');
	button.className = owner();
	const testId = `contrast-button-${crypto.randomUUID()}`;
	button.dataset.testid = testId;
	const face = document.createElement('span');
	face.className = surfaceClass();
	button.append(face);
	scope.append(button);
	const card = document.createElement('span');
	card.style.color = 'var(--card)';
	scope.append(card);
	const base = getComputedStyle(card).color;
	const faceContrast = () => {
		const style = getComputedStyle(face);
		const surface = compositedLuminance([base, style.backgroundColor]);
		const text = compositedLuminance([base, style.backgroundColor, style.color]);
		return { contrast: contrastRatio(text, surface), fill: style.backgroundColor };
	};
	try {
		const resting = faceContrast();
		await page.getByTestId(testId).hover();
		const hovered = faceContrast();
		return {
			resting: resting.contrast,
			hovered: hovered.contrast,
			hoverChangesFill: hovered.fill !== resting.fill,
		};
	} finally {
		button.remove();
		card.remove();
	}
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
	['--brand-link', '--card'],
	['--wishlist-card-plate-foreground', '--wishlist-card-plate'],
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
					const { hovered, hoverChangesFill } = await buttonContrast(scope, 'danger');
					expect(hoverChangesFill).toBe(true);
					expect(
						hovered,
						`${palette} ${mode} ${scopeName}: danger button hover: ${hovered.toFixed(2)}`,
					).toBeGreaterThanOrEqual(4.5);
				}
			}
		} finally {
			nested.remove();
		}
	});
});

describe('filled buttons across palettes', () => {
	const filledIntents = ['primary', 'primary-destructive'] as const satisfies ButtonIntent[];

	it.each(PALETTES)('%s keeps labels readable at rest and on hover', async (palette) => {
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
					for (const intent of filledIntents) {
						const { resting, hovered, hoverChangesFill } = await buttonContrast(
							scope,
							intent,
						);
						const label = `${palette} ${mode} ${scopeName}: ${intent}`;
						expect(hoverChangesFill, `${label} hover changes fill`).toBe(true);
						expect(resting, `${label}: ${resting.toFixed(2)}`).toBeGreaterThanOrEqual(
							4.5,
						);
						expect(
							hovered,
							`${label} hover: ${hovered.toFixed(2)}`,
						).toBeGreaterThanOrEqual(4.5);
					}
				}
			}
		} finally {
			nested.remove();
		}
	});
});

const statusTextSamples = {
	neutral: [
		badgeVariants({ tone: 'neutral', badgeStyle: 'count' }),
		badgeVariants({ tone: 'neutral', badgeStyle: 'overlay' }),
	],
	success: [
		...BADGE_STYLES.filter(
			(badgeStyle) => badgeStyle !== 'solid' && badgeStyle !== 'count',
		).map((badgeStyle) => badgeVariants({ tone: 'success', badgeStyle })),
		statusBadgeVariants({ status: 'success' }),
		`${toastVariants({ tone: 'success' })} ${toastTitleColors.success}`,
		helpTextVariants({ state: 'success' }),
		alertVariants({ tone: 'success' }),
	],
	warning: [
		...BADGE_STYLES.map((badgeStyle) => badgeVariants({ tone: 'warning', badgeStyle })),
		statusBadgeVariants({ status: 'warning' }),
		`${toastVariants({ tone: 'warning' })} ${toastTitleColors.warning}`,
		alertVariants({ tone: 'warning' }),
	],
	danger: [
		...BADGE_STYLES.map((badgeStyle) => badgeVariants({ tone: 'danger', badgeStyle })),
		statusBadgeVariants({ status: 'danger' }),
		`${toastVariants({ tone: 'danger' })} ${toastTitleColors.danger}`,
		helpTextVariants({ state: 'error' }),
		fieldErrorVariants(),
		alertVariants({ tone: 'danger' }),
	],
	link: [
		...BADGE_STYLES.filter(
			(badgeStyle) => badgeStyle !== 'solid' && badgeStyle !== 'count',
		).flatMap((badgeStyle) => [
			badgeVariants({ tone: 'info', badgeStyle }),
			badgeVariants({ tone: 'primary', badgeStyle }),
		]),
		statusBadgeVariants({ status: 'info' }),
		`${toastVariants({ tone: 'info' })} ${toastTitleColors.info}`,
		`${toastVariants({ tone: 'loading' })} ${toastTitleColors.loading}`,
		moderatorPanelVariants().moderatorAvatar(),
		buttonVariants({ intent: 'link' }).surface(),
		alertVariants({ tone: 'info' }),
	],
};

describe.each(Object.entries(statusTextSamples))(
	'%s text across palette surfaces',
	(_, samples) => {
		it.each(PALETTES)('%s stays readable in light and dark root/nested scopes', (palette) => {
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
						for (const className of samples) {
							const contrast = sampleContrast(scope, className);
							expect(
								contrast,
								`${palette} ${mode} ${scopeName}: ${className}: ${contrast.toFixed(2)}`,
							).toBeGreaterThanOrEqual(4.5);
						}
					}
				}
			} finally {
				nested.remove();
			}
		});
	},
);

function tokenContrast(scope: HTMLElement, foreground: string, background: string): number {
	return contrastRatio(luminance(scope, foreground, background), luminance(scope, background));
}

describe('lights-off dark palettes', () => {
	const darkTextPairs = [
		...textPairs,
		['--foreground', '--surface'],
		['--muted-foreground', '--popover'],
		['--muted-foreground', '--surface'],
		['--link', '--card'],
		['--link', '--background'],
	];
	// Ascending lightness keeps each raised layer distinct; the dark outline sits below the page.
	const surfaceLadder = ['--accent', '--secondary', '--muted', '--card', '--popover'];

	it.each(PALETTES)(
		'%s keeps the surface ladder and readable text at every depth in page, nested and layer scopes',
		(palette) => {
			document.documentElement.classList.add('dark');
			document.documentElement.setAttribute('data-palette', palette);
			const nested = document.createElement('div');
			nested.setAttribute('data-palette', palette);
			const layer = document.createElement('div');
			layer.setAttribute('data-dark-palette', palette);
			document.body.append(nested, layer);
			try {
				for (const depth of DEPTH_STYLES) {
					document.documentElement.setAttribute('data-depth', depth);
					for (const scope of [document.documentElement, nested, layer]) {
						const label = `${palette} ${depth}`;
						let previous = luminance(scope, '--background');
						expect(
							luminance(scope, '--edge'),
							`${label}: edge below page`,
						).toBeLessThan(previous);
						for (const surface of surfaceLadder) {
							const current = luminance(scope, surface);
							expect(
								current,
								`${label}: ${surface} above the layer below`,
							).toBeGreaterThan(previous);
							previous = current;
						}
						const samples = [
							...BADGE_STYLES.map((badgeStyle) =>
								badgeVariants({ tone: 'primary', badgeStyle }),
							),
							...['success', 'info'].map((tone) =>
								badgeVariants({
									tone: tone as 'success' | 'info',
									badgeStyle: 'solid',
								}),
							),
							avatarVariants().fallback(),
							avatarVariants({ appearance: 'recipient' }).fallback(),
						];
						for (const className of samples) {
							const contrast = sampleContrast(scope, className);
							expect(
								contrast,
								`${label}: ${className}: ${contrast.toFixed(2)}`,
							).toBeGreaterThanOrEqual(4.5);
						}
						for (const [foreground, background] of darkTextPairs) {
							const contrast = tokenContrast(scope, foreground!, background!);
							expect(
								contrast,
								`${label}: ${foreground} on ${background}: ${contrast.toFixed(2)}`,
							).toBeGreaterThanOrEqual(4.5);
						}
						for (const surface of ['--background', ...surfaceLadder]) {
							const contrast = tokenContrast(scope, '--edge-control', surface);
							expect(
								contrast,
								`${label}: control outline on ${surface}: ${contrast.toFixed(2)}`,
							).toBeGreaterThanOrEqual(3);
						}
					}
				}
			} finally {
				nested.remove();
				layer.remove();
			}
		},
	);
});

describe('dark wishlist page backgrounds', () => {
	const wishlistTextPairs = [
		['--foreground', '--background'],
		['--muted-foreground', '--background'],
		['--wishlist-heading-ink', '--background'],
		['--brand', '--background'],
		['--wishlist-heading-ink', '--card'],
	];

	it.each(PALETTES)(
		'%s wishlist text stays readable on every background option for cool and warm viewers',
		(palette) => {
			document.documentElement.classList.add('dark');
			const shell = document.createElement('div');
			shell.className = 'wishlist-page-shell';
			shell.setAttribute('data-palette', palette);
			document.body.append(shell);
			try {
				for (const viewer of ['sky', 'peach']) {
					document.documentElement.setAttribute('data-palette', viewer);
					for (const option of DARK_WISHLIST_BACKGROUNDS) {
						document.documentElement.setAttribute(
							'data-dark-wishlist-background',
							option,
						);
						for (const [foreground, background] of wishlistTextPairs) {
							const contrast = tokenContrast(shell, foreground!, background!);
							expect(
								contrast,
								`${palette} for ${viewer} viewer, ${option}: ${foreground} on ${background}: ${contrast.toFixed(2)}`,
							).toBeGreaterThanOrEqual(4.5);
						}
						for (const surface of ['--background', '--card']) {
							const contrast = tokenContrast(shell, '--edge-control', surface);
							expect(
								contrast,
								`${palette} for ${viewer} viewer, ${option}: control outline on ${surface}: ${contrast.toFixed(2)}`,
							).toBeGreaterThanOrEqual(3);
						}
					}
				}
			} finally {
				shell.remove();
			}
		},
	);

	it('the page background follows the selected option', () => {
		document.documentElement.classList.add('dark');
		document.documentElement.setAttribute('data-palette', 'sky');
		const shell = document.createElement('div');
		shell.className = 'wishlist-page-shell';
		shell.setAttribute('data-palette', 'honey');
		document.body.append(shell);
		const backgroundOf = (option: string) => {
			document.documentElement.setAttribute('data-dark-wishlist-background', option);
			const probe = document.createElement('span');
			probe.style.color = 'var(--background)';
			shell.append(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		};
		const viewerProbe = document.createElement('span');
		viewerProbe.style.color = 'var(--background)';
		document.body.append(viewerProbe);
		try {
			const viewerBackground = getComputedStyle(viewerProbe).color;
			const [wishlist, app, tint] = ['wishlist', 'app', 'tint'].map(backgroundOf);
			expect(app).toBe(viewerBackground);
			const honeyPage = document.createElement('div');
			honeyPage.setAttribute('data-palette', 'honey');
			document.body.append(honeyPage);
			const honeyProbe = document.createElement('span');
			honeyProbe.style.color = 'var(--palette-page-background)';
			honeyPage.append(honeyProbe);
			expect(wishlist).toBe(getComputedStyle(honeyProbe).color);
			honeyPage.remove();
			// The tint stays nearer the viewer's page than the wishlist's.
			const [wishlistLuminance, appLuminance, tintLuminance] = [wishlist, app, tint].map(
				(color) => compositedLuminance([color!]),
			);
			expect(Math.abs(tintLuminance! - appLuminance!)).toBeLessThan(
				Math.abs(wishlistLuminance! - appLuminance!),
			);
			expect(wishlist).not.toBe(viewerBackground);
			expect(tint).not.toBe(viewerBackground);
			expect(tint).not.toBe(wishlist);
		} finally {
			shell.remove();
			viewerProbe.remove();
		}
	});
});

describe('light palettes', () => {
	// Light `--brand` is a fill and icon colour; coloured light text uses `--brand-link` or status text tokens.
	const lightTextPairs = [
		...textPairs.filter(([foreground]) => foreground !== '--brand'),
		...['--background', '--card', '--secondary', '--muted', '--accent'].map((surface) => [
			'--brand-link',
			surface,
		]),
	];

	it.each(PALETTES)('%s keeps token text pairs readable in both scopes', (palette) => {
		document.documentElement.classList.remove('dark');
		document.documentElement.setAttribute('data-palette', palette);
		const nested = document.createElement('div');
		nested.setAttribute('data-palette', palette);
		document.body.append(nested);
		try {
			for (const scope of [document.documentElement, nested]) {
				for (const [foreground, background] of lightTextPairs) {
					const contrast = contrastRatio(
						luminance(scope, foreground!, background!),
						luminance(scope, background!),
					);
					expect(
						contrast,
						`${palette}: ${foreground} on ${background}: ${contrast.toFixed(2)}`,
					).toBeGreaterThanOrEqual(4.5);
				}
			}
		} finally {
			nested.remove();
		}
	});
});

describe('info callouts', () => {
	// An info callout explains; on a green palette a brand tint would read as a success.
	it.each(PALETTES)('%s tints info callouts blue in light and dark', (palette) => {
		document.documentElement.setAttribute('data-palette', palette);
		const callout = document.createElement('div');
		callout.className = alertVariants({ tone: 'info' });
		document.body.append(callout);
		try {
			for (const mode of ['light', 'dark']) {
				document.documentElement.classList.toggle('dark', mode === 'dark');
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = 1;
				const context = canvas.getContext('2d')!;
				context.fillStyle = getComputedStyle(callout).backgroundColor;
				context.fillRect(0, 0, 1, 1);
				const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
				expect(blue, `${palette} ${mode}: rgb(${red}, ${green}, ${blue})`).toBeGreaterThan(
					Math.max(red!, green!),
				);
			}
		} finally {
			callout.remove();
		}
	});
});

describe('light wishlist page background', () => {
	it('ignores the dark-only background preference', () => {
		document.documentElement.classList.remove('dark');
		document.documentElement.setAttribute('data-palette', 'sky');
		const shell = document.createElement('div');
		shell.className = 'wishlist-page-shell';
		shell.setAttribute('data-palette', 'honey');
		document.body.append(shell);
		try {
			const backgrounds = DARK_WISHLIST_BACKGROUNDS.map((option) => {
				document.documentElement.setAttribute('data-dark-wishlist-background', option);
				return luminance(shell, '--background');
			});
			expect(new Set(backgrounds).size).toBe(1);
		} finally {
			shell.remove();
		}
	});
});
