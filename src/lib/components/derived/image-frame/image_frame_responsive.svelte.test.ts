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
		// The original fails too, so the frame soon swaps the image for its fallback; record every
		// rendered state instead of polling a single moment that may already be gone.
		const renderedImages: { src: string | null; srcset: boolean; sizes: boolean }[] = [];
		const recordImage = () => {
			const image = document.querySelector<HTMLImageElement>(
				'[data-testid="image-frame"] img',
			);
			if (image !== null) {
				renderedImages.push({
					src: image.getAttribute('src'),
					srcset: image.hasAttribute('srcset'),
					sizes: image.hasAttribute('sizes'),
				});
			}
		};
		const observer = new MutationObserver(recordImage);
		observer.observe(document.body, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['src', 'srcset', 'sizes'],
		});
		const onerror = vi.fn();
		try {
			await render(ImageFrame, {
				props: { class: 'h-24 w-32', src: original, alt: 'Gift', variant: 'card', onerror },
			});
			recordImage();

			await expect.poll(() => onerror.mock.calls.length).toBe(1);
			expect(renderedImages.some((image) => image.src !== original && image.srcset)).toBe(
				true,
			);
			expect(renderedImages).toContainEqual({ src: original, srcset: false, sizes: false });
		} finally {
			observer.disconnect();
		}
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
