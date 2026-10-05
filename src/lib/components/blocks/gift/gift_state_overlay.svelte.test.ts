import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import { PALETTES } from '$lib/theme/palettes.js';
import type { GiftOverlayEntry } from '$lib/modules/gifts/gift_display_state.js';

const { default: GiftStateOverlay } = await import('./GiftStateOverlay.svelte');

const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

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

function primary(
	kind: 'received' | 'own-reservation' | 'own-purchased' | 'unavailable',
): GiftOverlayEntry {
	return { kind, role: 'primary' };
}

describe('GiftStateOverlay', () => {
	it('uses the approved exact green and white treatment for own reservations', async () => {
		const screen = await render(GiftStateOverlay, {
			entries: [primary('own-reservation')],
		});

		const badge = screen.getByText('Rezervováno vámi').element() as HTMLElement;
		expect(getComputedStyle(badge).backgroundColor).toBe('rgb(22, 131, 79)');
		expect(getComputedStyle(badge).color).toBe('rgb(255, 255, 255)');
	});

	it.each(['own-reservation', 'own-purchased', 'unavailable'] as const)(
		'gives %s its own dark-mode fill that keeps white text readable',
		async (kind) => {
			const root = document.documentElement;
			const previousPalette = root.dataset.palette;
			const wasDark = root.classList.contains('dark');
			root.dataset.palette = 'sky';

			try {
				const screen = await render(GiftStateOverlay, { entries: [primary(kind)] });
				const badge = screen.container.querySelector<HTMLElement>('[data-state-primary]')!;
				root.classList.toggle('dark', false);
				const light = computedBadgeColors(badge);
				root.classList.toggle('dark', true);
				const dark = computedBadgeColors(badge);

				expect(dark.background).not.toEqual(light.background);
				expect(dark.foreground).toEqual([255, 255, 255]);
				expect(contrast(dark.background, dark.foreground)).toBeGreaterThanOrEqual(4.5);
			} finally {
				restoreRootTheme(root, previousPalette, wasDark);
			}
		},
	);

	it('keeps Received readable in every palette in light and dark modes', async () => {
		const root = document.documentElement;
		const previousPalette = root.dataset.palette;
		const wasDark = root.classList.contains('dark');

		try {
			const screen = await render(GiftStateOverlay, { entries: [primary('received')] });
			const badge = screen.getByText('Přijato').element() as HTMLElement;

			for (const palette of PALETTES) {
				root.dataset.palette = palette;
				for (const dark of [false, true]) {
					root.classList.toggle('dark', dark);
					const colors = computedBadgeColors(badge);
					expect(
						contrast(colors.background, colors.foreground),
						`${palette} palette in ${dark ? 'dark' : 'light'} mode`,
					).toBeGreaterThanOrEqual(2);
					expect(getComputedStyle(badge).textShadow).not.toBe('none');
				}
			}
		} finally {
			restoreRootTheme(root, previousPalette, wasDark);
		}
	});

	it.each([
		{
			label: 'standalone unavailable',
			entries: [primary('unavailable')],
			background: [22, 59, 96] as const,
		},
		{
			label: 'received with unavailable support',
			entries: [primary('received'), { kind: 'unavailable', role: 'support' }],
			background: null,
		},
	] satisfies { label: string; entries: GiftOverlayEntry[]; background: Rgb | null }[])(
		'contains every $label pill in one centered stack on a 128px host',
		async ({ entries, background }) => {
			const host = document.createElement('div');
			host.style.position = 'relative';
			host.style.width = '128px';
			host.style.height = '128px';
			document.body.appendChild(host);

			try {
				await render(GiftStateOverlay, { entries }, { baseElement: host });
				await document.fonts.ready;
				const overlay = host.querySelector(
					'[data-testid="gift-state-overlay"]',
				) as HTMLElement;
				const pills = Array.from(overlay.children) as HTMLElement[];
				const hostRect = host.getBoundingClientRect();
				const pillRects = pills.map((pill) => pill.getBoundingClientRect());
				const stackLeft = Math.min(...pillRects.map((rect) => rect.left));
				const stackRight = Math.max(...pillRects.map((rect) => rect.right));
				const stackTop = Math.min(...pillRects.map((rect) => rect.top));
				const stackBottom = Math.max(...pillRects.map((rect) => rect.bottom));

				expect(pills.length).toBeLessThanOrEqual(2);
				expectPixelsNear((stackLeft + stackRight) / 2, hostRect.left + hostRect.width / 2);
				expectPixelsNear((stackTop + stackBottom) / 2, hostRect.top + hostRect.height / 2);
				for (const [index, pill] of pills.entries()) {
					const pillRect = pillRects[index]!;
					expectPixelsAtLeast(pillRect.left, hostRect.left);
					expectPixelsAtMost(pillRect.right, hostRect.right);
					expectPixelsAtLeast(pillRect.top, hostRect.top);
					expectPixelsAtMost(pillRect.bottom, hostRect.bottom);
					const colors = computedBadgeColors(pill);
					if (index === 0 && background !== null) {
						expect(colors.background).toEqual(background);
					}
					expect(colors.foreground).toEqual([255, 255, 255]);
					const minimumContrast = pill.dataset.stateKind === 'received' ? 2 : 4.5;
					expect(contrast(colors.background, colors.foreground)).toBeGreaterThanOrEqual(
						minimumContrast,
					);
				}
			} finally {
				host.remove();
			}
		},
	);

	it('uses the primary padded auto-width sticker treatment for Received', async () => {
		const host = document.createElement('div');
		host.style.position = 'relative';
		host.style.width = '280px';
		host.style.height = '160px';
		document.body.appendChild(host);
		try {
			await render(
				GiftStateOverlay,
				{ entries: [primary('received')] },
				{ baseElement: host },
			);
			const badge = host.querySelector('[data-state-primary]') as HTMLElement;
			const style = getComputedStyle(badge);
			expect(badge.className).toContain('bg-primary');
			expect(badge.className).toContain('text-primary-foreground');
			expect(badge.className).not.toContain('footer-bg');
			expectPixelsAtLeast(Number.parseFloat(style.paddingLeft), 8);
			expectPixelsAtLeast(Number.parseFloat(style.paddingTop), 4);
			expect(badge.getBoundingClientRect().width).toBeLessThan(
				host.getBoundingClientRect().width / 2,
			);
		} finally {
			host.remove();
		}
	});

	it.each([
		{ kind: 'own-reservation' },
		{ kind: 'unavailable' },
		{ kind: 'partial', remaining: 2, total: 3 },
	] as const)(
		'matches the standalone $kind visual treatment when layered under Received',
		async (state) => {
			const layered = await render(GiftStateOverlay, {
				entries: [primary('received'), { ...state, role: 'support' }],
			});
			const support = layered.container.querySelector(
				'[data-reservation-support]',
			) as HTMLElement;
			const supportStyle = getComputedStyle(support);
			const layeredTreatment = {
				background: supportStyle.backgroundColor,
				color: supportStyle.color,
				fontSize: supportStyle.fontSize,
				fontWeight: supportStyle.fontWeight,
				padding: supportStyle.padding,
				border: supportStyle.border,
				boxShadow: supportStyle.boxShadow,
			};
			await layered.unmount();

			const standalone = await render(GiftStateOverlay, {
				entries: [{ ...state, role: 'primary' }],
			});
			const standaloneBadge = standalone.container.querySelector(
				'[data-state-primary]',
			) as HTMLElement;
			const primaryStyle = getComputedStyle(standaloneBadge);
			expect(layeredTreatment).toEqual({
				background: primaryStyle.backgroundColor,
				color: primaryStyle.color,
				fontSize: primaryStyle.fontSize,
				fontWeight: primaryStyle.fontWeight,
				padding: primaryStyle.padding,
				border: primaryStyle.border,
				boxShadow: primaryStyle.boxShadow,
			});
			await standalone.unmount();
		},
	);

	it('renders permitted state as a second full-size sibling pill while recipient-safe entries leave no trace', async () => {
		const screen = await render(GiftStateOverlay, {
			entries: [primary('received'), { kind: 'own-reservation', role: 'support' }],
		});
		const overlay = screen.getByTestId('gift-state-overlay').element() as HTMLElement;
		const received = screen.getByText('Přijato').element() as HTMLElement;
		const reservation = screen.getByText('Rezervováno vámi').element() as HTMLElement;

		expect(overlay.children).toHaveLength(2);
		expect(received.parentElement).toBe(overlay);
		expect(reservation.parentElement).toBe(overlay);
		expect(getComputedStyle(received).fontSize).toBe(getComputedStyle(reservation).fontSize);
		expect(getComputedStyle(received).padding).toBe(getComputedStyle(reservation).padding);
		expect(getComputedStyle(received).borderWidth).toBe(
			getComputedStyle(reservation).borderWidth,
		);
		expect(getComputedStyle(received).boxShadow).toBe(getComputedStyle(reservation).boxShadow);

		await screen.rerender({ entries: [primary('received')] });
		await expect.element(screen.getByText('Přijato')).toBeVisible();
		expect(document.body.textContent).not.toContain('Rezervováno');
		expect(document.querySelector('[data-reservation-support]')).toBeNull();
	});

	it('keeps Received dominant above partial-capacity support', async () => {
		const screen = await render(GiftStateOverlay, {
			entries: [
				primary('received'),
				{ kind: 'partial', remaining: 2, total: 3, role: 'support' },
			],
		});

		await expect.element(screen.getByText('Přijato')).toBeVisible();
		await expect.element(screen.getByText('Volné 2/3')).toBeVisible();
		expect(document.querySelector('[data-state-primary]')?.textContent).toBe('Přijato');
		expect(document.querySelector('[data-reservation-support]')?.textContent).toBe('Volné 2/3');
	});

	it('shows finite remaining capacity beneath the primary own-reservation state', async () => {
		const screen = await render(GiftStateOverlay, {
			entries: [
				primary('own-reservation'),
				{ kind: 'partial', remaining: 2, total: 3, role: 'support' },
			],
		});

		await expect.element(screen.getByText('Rezervováno vámi')).toBeVisible();
		await expect.element(screen.getByText('Volné 2/3')).toBeVisible();
		await expect.element(screen.getByTestId('gift-state-overlay')).toBeVisible();
		expect(document.querySelector('[role="status"]')).toBeNull();
	});

	it('uses distinct exact ownership copy', async () => {
		const screen = await render(GiftStateOverlay, { entries: [primary('own-reservation')] });
		await expect.element(screen.getByText('Rezervováno vámi')).toBeVisible();

		await screen.rerender({ entries: [primary('unavailable')] });
		await expect.element(screen.getByText('Rezervováno někým jiným')).toBeVisible();
	});

	it('renders every state as a level, statically shadowed badge with the shared radius', async () => {
		const screen = await render(GiftStateOverlay, {
			entries: [primary('received'), { kind: 'own-purchased', role: 'support' }],
		});
		const badges = Array.from(
			screen.container.querySelectorAll<HTMLElement>('[data-state-kind]'),
		);

		expect(badges).toHaveLength(2);
		for (const badge of badges) {
			const style = getComputedStyle(badge);
			expect(style.transform).toBe('none');
			expect(style.rotate).toBe('none');
			expect(style.borderTopLeftRadius).toBe('12px');
			expect(style.boxShadow).not.toBe('none');
		}
	});

	it('gives each state a distinct fill with readable text in light and dark modes', async () => {
		const root = document.documentElement;
		const previousPalette = root.dataset.palette;
		const wasDark = root.classList.contains('dark');
		root.dataset.palette = 'sky';
		const entries: GiftOverlayEntry[] = [
			primary('own-reservation'),
			primary('own-purchased'),
			primary('unavailable'),
			primary('received'),
			{ kind: 'partial', remaining: 1, total: 2, role: 'primary' },
		];

		try {
			for (const dark of [false, true]) {
				root.classList.toggle('dark', dark);
				const backgrounds: string[] = [];
				for (const entry of entries) {
					const screen = await render(GiftStateOverlay, { entries: [entry] });
					const badge =
						screen.container.querySelector<HTMLElement>('[data-state-primary]')!;
					const colors = computedBadgeColors(badge);
					backgrounds.push(colors.background.join(','));
					if (entry.kind !== 'received') {
						expect(
							contrast(colors.background, colors.foreground),
							`${entry.kind} in ${dark ? 'dark' : 'light'} mode`,
						).toBeGreaterThanOrEqual(4.5);
					}
					await screen.unmount();
				}
				expect(new Set(backgrounds).size).toBe(entries.length);
			}
		} finally {
			restoreRootTheme(root, previousPalette, wasDark);
		}
	});

	it('labels the viewer’s own bought reservation as Koupeno in the bought brown', async () => {
		const screen = await render(GiftStateOverlay, { entries: [primary('own-purchased')] });

		const badge = screen.getByText('Koupeno', { exact: true }).element() as HTMLElement;
		expect(getComputedStyle(badge).backgroundColor).toBe('rgb(122, 74, 36)');
		expect(document.body.textContent).not.toContain('Rezervováno vámi');
	});

	it('combines an authorized reserver name into the single other-reservation badge', async () => {
		const screen = await render(GiftStateOverlay, {
			entries: [
				{
					kind: 'unavailable',
					otherReservers: { kind: 'single', name: 'Jana' },
					role: 'primary',
				},
			],
		});
		const overlay = screen.getByTestId('gift-state-overlay').element() as HTMLElement;

		await expect.element(screen.getByText('Rezervoval(a) Jana')).toBeVisible();
		expect(overlay.children).toHaveLength(1);
		expect(document.body.textContent).not.toContain('Rezervováno někým jiným');
		expect(document.querySelector('[data-reserver-identity]')).toBeNull();

		await screen.rerender({
			entries: [
				{ kind: 'unavailable', otherReservers: { kind: 'multiple' }, role: 'primary' },
			],
		});
		await expect.element(screen.getByText('Rezervováno více lidmi')).toBeVisible();
	});

	it('renders an explicit other-reservation entry as the navy badge after the state badges', async () => {
		const screen = await render(GiftStateOverlay, {
			entries: [
				{ kind: 'partial', remaining: 1, total: 2, role: 'primary' },
				{
					kind: 'unavailable',
					otherReservers: { kind: 'single', name: 'Jana' },
					role: 'other-reservation',
				},
			],
		});

		const identity = screen.getByText('Rezervoval(a) Jana').element() as HTMLElement;
		expect(identity.dataset.stateKind).toBe('unavailable');
		expect(identity.hasAttribute('data-other-reservation')).toBe(true);
		expect(identity.previousElementSibling?.hasAttribute('data-state-primary')).toBe(true);
		expect(getComputedStyle(identity).backgroundColor).toBe('rgb(22, 59, 96)');
		await expect.element(screen.getByText('Volné 1/2')).toBeVisible();
	});

	it('renders translated English state labels visibly', async () => {
		overwriteGetLocale(() => 'en');
		try {
			const screen = await render(GiftStateOverlay, {
				entries: [{ kind: 'partial', remaining: 2, total: 3, role: 'primary' }],
			});
			await expect.element(screen.getByText('Available 2/3')).toBeVisible();

			await screen.rerender({ entries: [primary('unavailable')] });
			await expect.element(screen.getByText('Reserved by someone else')).toBeVisible();
		} finally {
			overwriteGetLocale(() => 'cs');
		}
	});
});
