import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import ImageFrame from './ImageFrame.svelte';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const IMAGE =
	'data:image/svg+xml,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="red"/></svg>',
	);

describe('ImageFrame loading presentation', () => {
	it('layers an ordinary image load above its unresolved placeholder', async () => {
		const screen = await render(ImageFrame, {
			props: { class: 'h-24 w-32', src: IMAGE, alt: 'Gift' },
		});
		const image = screen.container.querySelector('img');
		const placeholder = screen.container.querySelector('[role="status"]');

		expect(image).not.toBeNull();
		expect(placeholder).not.toBeNull();
		expect(Number(getComputedStyle(image!).zIndex)).toBeGreaterThan(
			Number(getComputedStyle(placeholder!).zIndex),
		);
	});

	it('keeps an explicit loading operation above a successfully loaded image', async () => {
		const screen = await render(ImageFrame, {
			props: { class: 'h-24 w-32', src: IMAGE, alt: 'Uploaded gift' },
		});
		const image = screen.container.querySelector('img')!;
		await expect.poll(() => image.complete && image.naturalWidth > 0).toBe(true);

		await screen.rerender({
			class: 'h-24 w-32',
			src: IMAGE,
			alt: 'Uploaded gift',
			loading: true,
		});
		const placeholder = screen.container.querySelector('[role="status"]')!;

		expect(Number(getComputedStyle(placeholder).zIndex)).toBeGreaterThan(
			Number(getComputedStyle(image).zIndex),
		);
	});

	it('replaces a failed image with the accessible fallback', async () => {
		const screen = await render(ImageFrame, {
			props: {
				class: 'h-24 w-32',
				src: 'data:image/png;base64,not-an-image',
				alt: 'Unavailable gift',
				fallbackEmoji: '🎂',
			},
		});

		await expect
			.poll(() =>
				screen.container.querySelector('div[role="img"]')?.getAttribute('aria-label'),
			)
			.toBe('Unavailable gift');
		expect(screen.container.querySelector('img')).toBeNull();
	});
});

describe('ImageFrame wishlist image mat', () => {
	async function frameBackground(mat: string | null, fillColor: string | null = null) {
		const screen = await render(ImageFrame, {
			props: {
				class: 'h-24 w-32',
				src: IMAGE,
				alt: 'Gift',
				fitMode: 'contain-padded',
				tokenScope: 'wishlist',
				fillColor,
			},
		});
		if (mat !== null) {
			screen.container.dataset.mat = mat;
		}
		const frame = screen.container.querySelector<HTMLElement>('[data-testid="image-frame"]')!;
		return getComputedStyle(frame).backgroundColor;
	}

	function secondarySurface(): string {
		const probe = document.createElement('div');
		probe.style.backgroundColor = 'var(--secondary)';
		document.body.append(probe);
		const color = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return color;
	}

	it('fills letterboxing with the white or black wishlist mat', async () => {
		expect(await frameBackground('white')).toBe('rgb(255, 255, 255)');
		expect(await frameBackground('black')).toBe('rgb(23, 22, 28)');
	});

	it('falls back to the secondary surface outside a mat scope', async () => {
		expect(await frameBackground(null)).toBe(secondarySurface());
	});

	it('lets an explicit per-image fill win over the wishlist mat', async () => {
		expect(await frameBackground('black', '#ff0000')).toBe('rgb(255, 0, 0)');
	});
});
