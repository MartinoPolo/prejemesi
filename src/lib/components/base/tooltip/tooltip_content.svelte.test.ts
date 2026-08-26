import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import TooltipTestHost from './TooltipTestHost.svelte';

const arrowBorders = {
	top: ['0px', '2px', '2px', '0px'],
	bottom: ['2px', '0px', '0px', '2px'],
	left: ['2px', '2px', '0px', '0px'],
	right: ['0px', '0px', '2px', '2px'],
} as const;

describe('TooltipContent silhouette', () => {
	for (const side of ['top', 'bottom', 'left', 'right'] as const) {
		it(`outlines the ${side} arrow as one shadowed silhouette`, async () => {
			const screen = render(TooltipTestHost, { side });
			const shell = document.querySelector<HTMLElement>('[data-slot="tooltip-content"]');

			expect(shell).not.toBeNull();
			await expect.poll(() => shell?.dataset.side).toBe(side);

			const bubble = shell?.firstElementChild as HTMLElement;
			const arrow = shell?.lastElementChild as HTMLElement;
			const wrapper = shell?.parentElement as HTMLElement;
			const shellStyle = getComputedStyle(shell!);
			const bubbleStyle = getComputedStyle(bubble);
			const arrowStyle = getComputedStyle(arrow);

			expect(shellStyle.filter).toContain('drop-shadow');
			expect(bubbleStyle.boxShadow).toBe('none');
			expect(arrow.dataset.side).toBe(side);
			expect(wrapper.hasAttribute('data-bits-floating-content-wrapper')).toBe(true);
			expect(getComputedStyle(wrapper).transform).not.toBe('none');
			expect([
				arrowStyle.borderTopWidth,
				arrowStyle.borderRightWidth,
				arrowStyle.borderBottomWidth,
				arrowStyle.borderLeftWidth,
			]).toEqual(arrowBorders[side]);

			await screen.unmount();
		});
	}

	it('merges caller visual classes into the bubble without displacing the portal shell', async () => {
		const screen = render(TooltipTestHost, { side: 'top' });
		const shell = document.querySelector<HTMLElement>('[data-slot="tooltip-content"]');
		expect(shell).not.toBeNull();
		await expect.poll(() => shell?.dataset.side).toBe('top');

		const bubble = shell?.firstElementChild as HTMLElement;
		const bubbleStyle = getComputedStyle(bubble);
		const wrapperStyle = getComputedStyle(shell!.parentElement!);

		expect(bubbleStyle.backgroundColor).toBe('rgb(18, 52, 86)');
		expect(bubbleStyle.paddingLeft).toBe('21px');
		expect(bubbleStyle.paddingRight).toBe('21px');
		expect(['absolute', 'fixed']).toContain(wrapperStyle.position);

		await screen.unmount();
	});
});
