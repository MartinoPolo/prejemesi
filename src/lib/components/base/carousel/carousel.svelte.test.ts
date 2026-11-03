import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import CarouselTestFixture from './carousel_test_fixture.svelte';

function rowViewport(): HTMLElement {
	return document.querySelector<HTMLElement>('[data-slot="carousel-content"]')!;
}

function nextFrames(count: number): Promise<void> {
	return new Promise((resolve) => {
		const step = (remaining: number) =>
			remaining === 0 ? resolve() : requestAnimationFrame(() => step(remaining - 1));
		step(count);
	});
}

describe('Carousel keyboard scrolling', () => {
	it('scrolls the focused row on ArrowRight and still calls the consumer keydown handler', async () => {
		const consumerKeyDown = vi.fn();
		const screen = render(CarouselTestFixture, { onkeydown: consumerKeyDown });
		const row = screen.getByRole('region', { name: 'Example row' });
		(row.element() as HTMLElement).focus();
		await expect.element(row).toHaveFocus();

		await userEvent.keyboard('{ArrowRight}');

		await expect.poll(() => rowViewport().scrollLeft).toBeGreaterThan(0);
		expect(consumerKeyDown).toHaveBeenCalledWith(
			expect.objectContaining({ key: 'ArrowRight' }),
		);
		await screen.unmount();
	});

	it('leaves an arrow key pressed inside a slide to the slide control', async () => {
		const screen = render(CarouselTestFixture);
		const button = screen.getByRole('button', { name: 'First' });
		(button.element() as HTMLElement).focus();
		await expect.element(button).toHaveFocus();

		await userEvent.keyboard('{ArrowRight}');
		await nextFrames(10);

		expect(rowViewport().scrollLeft).toBe(0);
		await screen.unmount();
	});
});
