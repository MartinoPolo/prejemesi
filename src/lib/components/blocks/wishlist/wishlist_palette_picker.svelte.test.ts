import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { PALETTES, PALETTE_LABELS } from '$lib/theme/palettes.js';
import WishlistPalettePicker from './WishlistPalettePicker.svelte';

describe('WishlistPalettePicker', () => {
	it('renders every palette as a compact, consistently sized centered choice group', async () => {
		const screen = render(WishlistPalettePicker, {
			value: 'sky',
			onchange: vi.fn(),
		});
		const group = screen.getByTestId('wishlist-palette-picker');
		const buttons = PALETTES.map((palette) =>
			screen.getByRole('button', { name: PALETTE_LABELS[palette] }),
		);

		await expect.element(group).toBeVisible();
		expect(buttons).toHaveLength(PALETTES.length);
		const widths = buttons.map((button) => button.element().getBoundingClientRect().width);
		expect(new Set(widths.map(Math.round))).toEqual(new Set([128]));
		expect(Math.max(...widths)).toBeLessThan(group.element().getBoundingClientRect().width / 2);
		await expect.element(buttons[0]!).toHaveAttribute('aria-pressed', 'true');
	});

	it('wraps choices without horizontal overflow at narrow widths', async () => {
		const screen = render(WishlistPalettePicker, {
			value: 'sky',
			onchange: vi.fn(),
		});
		const group = screen.getByTestId('wishlist-palette-picker').element();
		group.style.width = '112px';

		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
		for (const palette of PALETTES) {
			const choice = screen.getByRole('button', { name: PALETTE_LABELS[palette] }).element();
			expect(choice.getBoundingClientRect().width).toBeLessThanOrEqual(group.clientWidth);
		}
	});
});
