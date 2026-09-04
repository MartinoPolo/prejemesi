import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import { PALETTES } from '$lib/theme/palettes.js';

const { default: GiftStateOverlay } = await import('./GiftStateOverlay.svelte');

type Rgb = readonly [red: number, green: number, blue: number];

function convertCssColorToRgb(value: string): Rgb {
	const canvas = document.createElement('canvas');
	canvas.width = 1;
	canvas.height = 1;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (context === null) {
		throw new Error('Canvas 2D context is unavailable');
	}
	context.fillStyle = value;
	context.fillRect(0, 0, 1, 1);
	const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
	return [red!, green!, blue!] as const;
}

function luminance([red, green, blue]: Rgb): number {
	const linear = [red, green, blue].map((channel) => {
		const normalized = channel / 255;
		return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(first: Rgb, second: Rgb): number {
	const firstLuminance = luminance(first);
	const secondLuminance = luminance(second);
	return (
		(Math.max(firstLuminance, secondLuminance) + 0.05) /
		(Math.min(firstLuminance, secondLuminance) + 0.05)
	);
}

function computedBadgeColors(badge: HTMLElement): { background: Rgb; foreground: Rgb } {
	const style = getComputedStyle(badge);
	return {
		background: convertCssColorToRgb(style.backgroundColor),
		foreground: convertCssColorToRgb(style.color),
	};
}

function restoreRootTheme(
	root: HTMLElement,
	previousPalette: string | undefined,
	wasDark: boolean,
): void {
	root.classList.toggle('dark', wasDark);
	if (previousPalette === undefined) {
		delete root.dataset.palette;
	} else {
		root.dataset.palette = previousPalette;
	}
}

describe('GiftStateOverlay', () => {
	it('uses the approved exact green and white treatment for own reservations', async () => {
		const screen = await render(GiftStateOverlay, {
			model: { kind: 'own-reservation' },
		});

		const label = screen.getByText('Rezervováno vámi').element() as HTMLElement;
		const badge = label.parentElement as HTMLElement;
		expect(getComputedStyle(badge).backgroundColor).toBe('rgb(22, 131, 79)');
		expect(getComputedStyle(badge).color).toBe('rgb(255, 255, 255)');
	});

	it('keeps unavailable dark navy readable and stable in light and dark modes', async () => {
		const root = document.documentElement;
		const previousPalette = root.dataset.palette;
		const wasDark = root.classList.contains('dark');
		root.dataset.palette = 'sky';

		try {
			const screen = await render(GiftStateOverlay, { model: { kind: 'unavailable' } });
			const label = screen.getByText('Rezervováno někým jiným').element() as HTMLElement;
			const badge = label.parentElement as HTMLElement;

			for (const dark of [false, true]) {
				root.classList.toggle('dark', dark);
				const colors = computedBadgeColors(badge);
				expect(colors.background).toEqual([22, 59, 96]);
				expect(colors.foreground).toEqual([255, 255, 255]);
				expect(contrast(colors.background, colors.foreground)).toBeGreaterThanOrEqual(4.5);
			}
		} finally {
			restoreRootTheme(root, previousPalette, wasDark);
		}
	});

	it('keeps Received readable in every palette in light and dark modes', async () => {
		const root = document.documentElement;
		const previousPalette = root.dataset.palette;
		const wasDark = root.classList.contains('dark');

		try {
			const screen = await render(GiftStateOverlay, { model: { kind: 'received' } });
			const label = screen.getByText('Přijato').element() as HTMLElement;
			const badge = label.parentElement as HTMLElement;

			for (const palette of PALETTES) {
				root.dataset.palette = palette;
				for (const dark of [false, true]) {
					root.classList.toggle('dark', dark);
					const colors = computedBadgeColors(badge);
					expect(
						contrast(colors.background, colors.foreground),
						`${palette} palette in ${dark ? 'dark' : 'light'} mode`,
					).toBeGreaterThanOrEqual(4.5);
				}
			}
		} finally {
			restoreRootTheme(root, previousPalette, wasDark);
		}
	});

	it.each([
		{
			label: 'standalone unavailable',
			model: { kind: 'unavailable' } as const,
			background: [22, 59, 96] as const,
		},
		{
			label: 'received with unavailable support',
			model: { kind: 'received', supportKind: 'unavailable' } as const,
			background: null,
		},
	])(
		'contains all $label text in a centered badge on a 128px host',
		async ({ model, background }) => {
			const host = document.createElement('div');
			host.style.position = 'relative';
			host.style.width = '128px';
			host.style.height = '128px';
			document.body.appendChild(host);

			try {
				await render(GiftStateOverlay, { model }, { baseElement: host });
				await document.fonts.ready;
				const overlay = host.querySelector(
					'[data-testid="gift-state-overlay"]',
				) as HTMLElement;
				const badge = overlay.querySelector(':scope > span') as HTMLElement;
				const hostRect = host.getBoundingClientRect();
				const badgeRect = badge.getBoundingClientRect();

				expect(badgeRect.left + badgeRect.width / 2).toBeCloseTo(
					hostRect.left + hostRect.width / 2,
					1,
				);
				expect(badgeRect.top + badgeRect.height / 2).toBeCloseTo(
					hostRect.top + hostRect.height / 2,
					1,
				);
				for (const text of badge.querySelectorAll<HTMLElement>(
					'[data-state-primary], [data-reservation-support]',
				)) {
					const textRect = text.getBoundingClientRect();
					expect(textRect.left).toBeGreaterThanOrEqual(badgeRect.left - 0.5);
					expect(textRect.right).toBeLessThanOrEqual(badgeRect.right + 0.5);
					expect(textRect.top).toBeGreaterThanOrEqual(badgeRect.top - 0.5);
					expect(textRect.bottom).toBeLessThanOrEqual(badgeRect.bottom + 0.5);
				}

				const colors = computedBadgeColors(badge);
				if (background !== null) {
					expect(colors.background).toEqual(background);
				}
				expect(colors.foreground).toEqual([255, 255, 255]);
				expect(contrast(colors.background, colors.foreground)).toBeGreaterThanOrEqual(4.5);
			} finally {
				host.remove();
			}
		},
	);

	it('shows permitted reservation support under Received while a recipient-safe model has no trace', async () => {
		const screen = await render(GiftStateOverlay, {
			model: { kind: 'received', supportKind: 'own-reservation' },
		});
		await expect.element(screen.getByText('Přijato')).toBeVisible();
		await expect.element(screen.getByText('Rezervováno vámi')).toBeVisible();

		await screen.rerender({ model: { kind: 'received' } });
		await expect.element(screen.getByText('Přijato')).toBeVisible();
		expect(document.body.textContent).not.toContain('Rezervováno');
		expect(document.querySelector('[data-reservation-support]')).toBeNull();
	});

	it('keeps Received dominant above partial-capacity support', async () => {
		const screen = await render(GiftStateOverlay, {
			model: {
				kind: 'received',
				supportKind: 'partial',
				remaining: 2,
				total: 3,
			},
		});

		await expect.element(screen.getByText('Přijato')).toBeVisible();
		await expect.element(screen.getByText('Volné 2/3')).toBeVisible();
		expect(document.querySelector('[data-state-primary]')?.textContent).toBe('Přijato');
		expect(document.querySelector('[data-reservation-support]')?.textContent).toBe('Volné 2/3');
	});

	it('shows finite remaining capacity beneath the primary own-reservation state', async () => {
		const screen = await render(GiftStateOverlay, {
			model: {
				kind: 'own-reservation',
				supportKind: 'partial',
				remaining: 2,
				total: 3,
			},
		});

		await expect.element(screen.getByText('Rezervováno vámi')).toBeVisible();
		await expect.element(screen.getByText('Volné 2/3')).toBeVisible();
		await expect.element(screen.getByTestId('gift-state-overlay')).toBeVisible();
		expect(document.querySelector('[role="status"]')).toBeNull();
	});

	it('uses distinct exact ownership copy', async () => {
		const screen = await render(GiftStateOverlay, { model: { kind: 'own-reservation' } });
		await expect.element(screen.getByText('Rezervováno vámi')).toBeVisible();

		await screen.rerender({ model: { kind: 'unavailable' } });
		await expect.element(screen.getByText('Rezervováno někým jiným')).toBeVisible();
	});

	it('renders translated English state labels visibly', async () => {
		overwriteGetLocale(() => 'en');
		try {
			const screen = await render(GiftStateOverlay, {
				model: { kind: 'partial', remaining: 2, total: 3 },
			});
			await expect.element(screen.getByText('Available 2/3')).toBeVisible();

			await screen.rerender({ model: { kind: 'unavailable' } });
			await expect.element(screen.getByText('Reserved by someone else')).toBeVisible();
		} finally {
			overwriteGetLocale(() => 'cs');
		}
	});
});
