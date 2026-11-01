import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import ImageFrame from './ImageFrame.svelte';
import { gapsWithin, paintedPhotoBox, type PhotoBox } from './painted_photo_box.test_fixtures.js';

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

describe('ImageFrame Fit margin', () => {
	type FitMarginMode = 'contain-padded' | 'cover-crop' | 'auto';
	// 128 × 96 frame: its shorter side is 96px, so a 0.1 margin is 9.6px.
	const tenthOfShorterSide = [9.6, 9.6, 9.6, 9.6].map((inset) => expect.closeTo(inset, 1));

	function frameProps(fitMode: FitMarginMode, margin: number) {
		return { class: 'h-24 w-32', src: IMAGE, alt: 'Gift', fitMode, margin };
	}

	function insetsWithin(frameBox: DOMRect, inner: PhotoBox) {
		const gaps = gapsWithin(frameBox, inner);
		return [gaps.left, gaps.top, gaps.right, gaps.bottom];
	}

	async function renderFrame(fitMode: FitMarginMode, margin: number, target?: HTMLElement) {
		const screen = await render(ImageFrame, { target, props: frameProps(fitMode, margin) });
		const frame = screen.container.querySelector<HTMLElement>('[data-testid="image-frame"]')!;
		const image = screen.container.querySelector('img')!;
		const insets = () =>
			insetsWithin(frame.getBoundingClientRect(), image.getBoundingClientRect());
		const photoInsets = () =>
			insetsWithin(frame.getBoundingClientRect(), paintedPhotoBox(image));
		return { screen, frame, image, insets, photoInsets };
	}

	async function loadedFrame(fitMode: FitMarginMode, margin: number) {
		const rendered = await renderFrame(fitMode, margin);
		await expect
			.poll(() => rendered.image.complete && rendered.image.naturalWidth > 0)
			.toBe(true);
		return rendered;
	}

	it('contains a Fit photo whole, a margin share of the shorter side further in', async () => {
		const withoutMargin = await loadedFrame('contain-padded', 0);
		const withMargin = await loadedFrame('contain-padded', 0.1);

		const photo = paintedPhotoBox(withMargin.image);
		expect(photo.width / photo.height).toBeCloseTo(64 / 48, 2);
		// The 4:3 photo is height-bound inside the inset box, so the margin adds exactly
		// 9.6px above and below it, and at least that much on its centred sides.
		const [, paddedTop, , paddedBottom] = withoutMargin.photoInsets();
		const [left, top, right, bottom] = withMargin.photoInsets();
		expect(top - paddedTop).toBeCloseTo(9.6, 1);
		expect(bottom - paddedBottom).toBeCloseTo(9.6, 1);
		expect(left).toBeCloseTo(right, 1);
		expect(left).toBeGreaterThanOrEqual(top);
	});

	it('keeps the same image element when the Fit margin is toggled', async () => {
		const { screen, image, insets } = await loadedFrame('contain-padded', 0);

		await screen.rerender(frameProps('contain-padded', 0.1));
		expect(screen.container.querySelector('img')).toBe(image);
		expect(insets()).toEqual(tenthOfShorterSide);

		await screen.rerender(frameProps('contain-padded', 0));
		expect(screen.container.querySelector('img')).toBe(image);
		expect(insets()).toEqual([0, 0, 0, 0]);
	});

	it('insets a Fit image on first paint, before the frame is measured', async () => {
		// Mounting hidden leaves the frame measured at 0×0; revealing it and reading layout
		// synchronously happens before any resize observation, like a server-rendered card
		// before hydration.
		const hiddenTarget = document.body.appendChild(document.createElement('div'));
		hiddenTarget.style.display = 'none';
		onTestFinished(() => hiddenTarget.remove());
		const { insets } = await renderFrame('contain-padded', 0.1, hiddenTarget);
		hiddenTarget.style.display = '';
		expect(insets()).toEqual(tenthOfShorterSide);
	});

	it('leaves Fit without a margin, Fill and legacy auto edge to edge', async () => {
		for (const [fitMode, margin] of [
			['contain-padded', 0],
			['cover-crop', 0.1],
			['auto', 0.1],
		] as const) {
			const { insets } = await loadedFrame(fitMode, margin);
			expect(insets()).toEqual([0, 0, 0, 0]);
		}
	});

	it('keeps Fill and legacy auto images directly in the frame', async () => {
		for (const fitMode of ['cover-crop', 'auto'] as const) {
			const { frame, image } = await loadedFrame(fitMode, 0.1);
			expect(image.parentElement).toBe(frame);
		}
	});

	it('shows a natural image whole and edge to edge even with a Fit margin', async () => {
		// Only the width is given, so the natural image's own aspect sizes the frame.
		const screen = await render(ImageFrame, {
			props: {
				class: 'w-32',
				src: IMAGE,
				alt: 'Gift',
				natural: true,
				fitMode: 'contain-padded',
				margin: 0.1,
			},
		});
		const frame = screen.container.querySelector<HTMLElement>('[data-testid="image-frame"]')!;
		const image = screen.container.querySelector('img')!;
		await expect.poll(() => image.complete && image.naturalWidth > 0).toBe(true);

		const frameBox = frame.getBoundingClientRect();
		const imageBox = image.getBoundingClientRect();
		// The 64 × 48 image at the frame's 128px width.
		expect(imageBox.height).toBeCloseTo(96, 1);
		expect([
			imageBox.left - frameBox.left,
			imageBox.top - frameBox.top,
			frameBox.right - imageBox.right,
			frameBox.bottom - imageBox.bottom,
		]).toEqual([0, 0, 0, 0]);
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
