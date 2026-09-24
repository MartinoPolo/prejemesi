import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { PALETTES, PALETTE_LABELS } from '$lib/theme/palettes.js';
import WishlistPalettePicker from './WishlistPalettePicker.svelte';

const { expectPixelsNear, expectPixelsAtMost } = createPixelAssertions(expect);

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
		for (const width of widths) {
			expectPixelsNear(width, 128);
		}
		expectPixelsAtMost(Math.max(...widths), groupRect.width / 2);
		expectPixelsAtMost(groupRect.width, 720);
		expectPixelsNear(groupRect.left + groupRect.width / 2, window.innerWidth / 2);

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
		expectPixelsAtMost(group.scrollWidth, group.clientWidth);
		for (const palette of PALETTES) {
			const choice = screen.getByRole('button', { name: PALETTE_LABELS[palette] }).element();
			expectPixelsAtMost(choice.getBoundingClientRect().width, group.clientWidth);
		}
	});
});
