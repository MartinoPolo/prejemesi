import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import ImageFrame from './ImageFrame.svelte';

// A closed local port makes every transformation request fail fast.
const PUBLIC_BASE = 'http://127.0.0.1:9';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_R2_URL: 'http://127.0.0.1:9' } }));

describe('ImageFrame responsive transformations', () => {
	it('offers a srcset for stored images and drops it when falling back to the original', async () => {
		const original = `${PUBLIC_BASE}/gifts/a.jpg`;
		const screen = await render(ImageFrame, {
			props: { class: 'h-24 w-32', src: original, alt: 'Gift', variant: 'card' },
		});
		const image = () => screen.container.querySelector('img');

		await expect.poll(() => image()?.getAttribute('src')).toBe(original);
		expect(image()?.hasAttribute('srcset')).toBe(false);
		expect(image()?.hasAttribute('sizes')).toBe(false);
	});

	it('loads the original without a srcset when no variant is requested', async () => {
		const original = `${PUBLIC_BASE}/gifts/b.jpg`;
		const screen = await render(ImageFrame, {
			props: { class: 'h-24 w-32', src: original, alt: 'Gift' },
		});
		const image = screen.container.querySelector('img');

		expect(image?.getAttribute('src')).toBe(original);
		expect(image?.hasAttribute('srcset')).toBe(false);
	});
});
