import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { PALETTES, PALETTE_LABELS } from '$lib/theme/palettes.js';
import WishlistPalettePicker from './WishlistPalettePicker.svelte';

describe('WishlistPalettePicker', () => {
	it('renders compact, consistently sized choices in a centered bounded group', async () => {
		const onchange = vi.fn();
		const screen = render(WishlistPalettePicker, { value: 'sky', onchange });
		const group = screen.getByTestId('wishlist-palette-picker');

		await expect.element(group).toBeVisible();
		const groupRect = group.element().getBoundingClientRect();
		const buttons = Array.from(group.element().querySelectorAll<HTMLButtonElement>('button'));
		expect(buttons.length).toBeGreaterThan(1);
		const widths = buttons.map((button) => button.getBoundingClientRect().width);
		expect(new Set(widths.map(Math.round))).toEqual(new Set([128]));
		expect(Math.max(...widths)).toBeLessThan(groupRect.width / 2);
		expect(groupRect.width).toBeLessThanOrEqual(720);
		expect(groupRect.left + groupRect.width / 2).toBeCloseTo(window.innerWidth / 2, 0);

		const sky = screen.getByRole('button', { name: PALETTE_LABELS.sky });
		const mint = screen.getByRole('button', { name: PALETTE_LABELS.mint });
		await expect.element(sky).toHaveAttribute('aria-pressed', 'true');
		await mint.click();
		expect(onchange).toHaveBeenCalledOnce();
		expect(onchange).toHaveBeenCalledWith('mint');
		await screen.rerender({ value: 'mint', onchange });
		await expect.element(sky).toHaveAttribute('aria-pressed', 'false');
		await expect.element(mint).toHaveAttribute('aria-pressed', 'true');
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
