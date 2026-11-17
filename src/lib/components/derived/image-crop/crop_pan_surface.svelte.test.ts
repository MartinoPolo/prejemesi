import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	centeredCropRect,
	cropRectToFocalZoom,
	normalizedCropAspect,
	zoomCropRect,
	type ImageCropRect,
} from '$lib/modules/images/index.js';
import ImageFrame from '../image-frame/ImageFrame.svelte';
import CropPanSurface from './CropPanSurface.svelte';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const LANDSCAPE_RATIO = 4 / 3;
const LANDSCAPE =
	'data:image/svg+xml,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="teal"/></svg>',
	);
const SQUARE_ASPECT = 1;
const CARD_ASPECT = 4 / 3;
// A landscape photo in a square thumbnail: the cover window spans the full height
// and three quarters of the width, so it can pan horizontally.
const THUMB_NORMALIZED_ASPECT = normalizedCropAspect(SQUARE_ASPECT, LANDSCAPE_RATIO);
const SURFACE_PIXELS = 160;

interface SurfaceSetup {
	cropRect?: ImageCropRect;
	aspect?: number;
	disabled?: boolean;
	hintLabel?: string;
	fillColor?: string | null;
	sizeClass?: string;
}

async function renderSurface(setup: SurfaceSetup = {}) {
	const onchange = vi.fn<(rect: ImageCropRect) => void>();
	const screen = render(CropPanSurface, {
		src: LANDSCAPE,
		naturalRatio: LANDSCAPE_RATIO,
		aspect: setup.aspect ?? SQUARE_ASPECT,
		cropRect: setup.cropRect ?? centeredCropRect(THUMB_NORMALIZED_ASPECT),
		onchange,
		ariaLabel: 'Výřez pro Seznam',
		hintLabel: setup.hintLabel,
		disabled: setup.disabled,
		fillColor: setup.fillColor,
		class: setup.sizeClass ?? 'size-40',
	});
	const surface = screen.getByRole('application', { name: 'Výřez pro Seznam' });
	await expect.element(surface).toBeInTheDocument();
	const image = surface.element().querySelector('img')!;
	await expect.poll(() => image.complete && image.naturalWidth > 0).toBe(true);
	return { screen, surface: surface.element() as HTMLElement, onchange };
}

function pointer(type: string, clientX: number, clientY: number, pointerId = 1): PointerEvent {
	return new PointerEvent(type, {
		pointerId,
		button: 0,
		clientX,
		clientY,
		bubbles: true,
		cancelable: true,
	});
}

function key(name: string, options: KeyboardEventInit = {}): KeyboardEvent {
	return new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...options });
}

function lastRect(onchange: ReturnType<typeof vi.fn>): ImageCropRect {
	return onchange.mock.lastCall![0] as ImageCropRect;
}

describe('CropPanSurface pointer pan', () => {
	it('moves the window against the drag and keeps the view aspect', async () => {
		const { surface, onchange } = await renderSurface();
		const start = centeredCropRect(THUMB_NORMALIZED_ASPECT);

		surface.dispatchEvent(pointer('pointerdown', 100, 100));
		surface.dispatchEvent(pointer('pointermove', 80, 100));

		const rect = lastRect(onchange);
		// Dragging the photo 20 px left reveals more of its right side.
		expect(rect.x).toBeCloseTo(start.x + (20 * start.w) / SURFACE_PIXELS, 6);
		expect(rect.y).toBeCloseTo(start.y, 6);
		expect(rect.w / rect.h).toBeCloseTo(THUMB_NORMALIZED_ASPECT, 6);
		surface.dispatchEvent(pointer('pointerup', 80, 100));
	});

	it('keeps the window inside the photo and ignores a drag past the edge', async () => {
		const leftEdge = { ...centeredCropRect(THUMB_NORMALIZED_ASPECT), x: 0 };
		const { surface, onchange } = await renderSurface({ cropRect: leftEdge });

		surface.dispatchEvent(pointer('pointerdown', 50, 50));
		surface.dispatchEvent(pointer('pointermove', 150, 50));
		surface.dispatchEvent(pointer('pointerup', 150, 50));

		expect(onchange).not.toHaveBeenCalled();
	});

	it('clamps a long drag at the far edge', async () => {
		const { surface, onchange } = await renderSurface();

		surface.dispatchEvent(pointer('pointerdown', 150, 50));
		surface.dispatchEvent(pointer('pointermove', -500, 50));
		surface.dispatchEvent(pointer('pointerup', -500, 50));

		const rect = lastRect(onchange);
		expect(rect.x + rect.w).toBeCloseTo(1, 6);
	});

	it('hides the hint while dragging and shows it again on release', async () => {
		const { screen, surface } = await renderSurface({ hintLabel: 'Posuňte tažením' });
		const hint = screen.getByTestId('crop-pan-surface-hint');
		await expect.element(hint).toHaveTextContent('Posuňte tažením');
		await expect.poll(() => getComputedStyle(hint.element()).opacity).toBe('1');

		surface.dispatchEvent(pointer('pointerdown', 80, 80));
		await expect.poll(() => getComputedStyle(hint.element()).opacity).toBe('0');

		surface.dispatchEvent(pointer('pointerup', 80, 80));
		await expect.poll(() => getComputedStyle(hint.element()).opacity).toBe('1');
	});

	it('claims touch gestures so a finger drag pans instead of scrolling the page', async () => {
		const { surface } = await renderSurface();
		expect(getComputedStyle(surface).touchAction).toBe('none');
	});

	it('zooms by the ratio two pointers spread apart', async () => {
		const { surface, onchange } = await renderSurface();
		// Synthetic pointers are not active in the browser, so capturing the second one would throw.
		surface.setPointerCapture = vi.fn();

		surface.dispatchEvent(pointer('pointerdown', 60, 80, 1));
		surface.dispatchEvent(pointer('pointerdown', 100, 80, 2));
		surface.dispatchEvent(pointer('pointermove', 100, 80, 2));
		surface.dispatchEvent(pointer('pointermove', 140, 80, 2));

		// The fingers went from 40 px to 80 px apart, so the photo is shown twice as large.
		expect(cropRectToFocalZoom(lastRect(onchange)).zoom).toBeCloseTo(2, 6);
		surface.dispatchEvent(pointer('pointerup', 140, 80, 2));
		surface.dispatchEvent(pointer('pointerup', 60, 80, 1));
	});

	it('shows no hint without a hint label', async () => {
		const { screen } = await renderSurface();
		await expect.element(screen.getByTestId('crop-pan-surface-outline')).toBeInTheDocument();
		expect(screen.container.querySelector('[data-testid="crop-pan-surface-hint"]')).toBeNull();
	});
});

describe('CropPanSurface keyboard and wheel', () => {
	it('pans with the arrow keys', async () => {
		const { surface, onchange } = await renderSurface();
		const start = centeredCropRect(THUMB_NORMALIZED_ASPECT);

		surface.dispatchEvent(key('ArrowRight'));
		expect(lastRect(onchange).x).toBeGreaterThan(start.x);

		surface.dispatchEvent(key('ArrowLeft'));
		expect(lastRect(onchange).x).toBeLessThan(start.x);
	});

	it('zooms in and out around the centre with + and −', async () => {
		const { surface, onchange } = await renderSurface();
		const start = centeredCropRect(THUMB_NORMALIZED_ASPECT);

		const zoomIn = key('+');
		surface.dispatchEvent(zoomIn);
		expect(zoomIn.defaultPrevented).toBe(true);
		const zoomedIn = lastRect(onchange);
		expect(cropRectToFocalZoom(zoomedIn).zoom).toBeCloseTo(1.1, 6);
		expect(zoomedIn.x + zoomedIn.w / 2).toBeCloseTo(start.x + start.w / 2, 6);
		expect(zoomedIn.w / zoomedIn.h).toBeCloseTo(THUMB_NORMALIZED_ASPECT, 6);

		surface.dispatchEvent(key('-'));
		expect(cropRectToFocalZoom(lastRect(onchange)).zoom).toBeCloseTo(0.9, 6);
	});

	it('recenters at the current zoom with 0', async () => {
		const zoomedIn = zoomCropRect(
			centeredCropRect(THUMB_NORMALIZED_ASPECT),
			THUMB_NORMALIZED_ASPECT,
			2,
			{ x: 0, y: 0 },
		);
		const { surface, onchange } = await renderSurface({ cropRect: zoomedIn });

		surface.dispatchEvent(key('0'));

		const rect = lastRect(onchange);
		expect(cropRectToFocalZoom(rect).zoom).toBeCloseTo(2, 6);
		expect(rect.x + rect.w / 2).toBeCloseTo(0.5, 6);
		expect(rect.y + rect.h / 2).toBeCloseTo(0.5, 6);
	});

	it('leaves browser shortcuts alone', async () => {
		const { surface, onchange } = await renderSurface();
		const browserZoom = key('+', { ctrlKey: true });
		surface.dispatchEvent(browserZoom);
		expect(browserZoom.defaultPrevented).toBe(false);
		expect(onchange).not.toHaveBeenCalled();
	});

	it('zooms with the wheel without scrolling the page', async () => {
		const { surface, onchange } = await renderSurface();
		const bounds = surface.getBoundingClientRect();
		const wheel = new WheelEvent('wheel', {
			deltaY: -100,
			clientX: bounds.left + bounds.width / 2,
			clientY: bounds.top + bounds.height / 2,
			bubbles: true,
			cancelable: true,
		});

		surface.dispatchEvent(wheel);

		expect(wheel.defaultPrevented).toBe(true);
		expect(cropRectToFocalZoom(lastRect(onchange)).zoom).toBeGreaterThan(1);
	});
});

describe('CropPanSurface disabled', () => {
	it('ignores edits and drops the outline, hint and tab stop', async () => {
		const { screen, surface, onchange } = await renderSurface({
			disabled: true,
			hintLabel: 'Posuňte tažením',
		});

		surface.dispatchEvent(key('ArrowRight'));
		surface.dispatchEvent(pointer('pointerdown', 100, 100));
		surface.dispatchEvent(pointer('pointermove', 50, 100));

		expect(onchange).not.toHaveBeenCalled();
		expect(surface.getAttribute('tabindex')).toBe('-1');
		expect(surface.getAttribute('aria-disabled')).toBe('true');
		expect(screen.container.querySelector('[data-testid="crop-pan-surface-hint"]')).toBeNull();
		expect(
			screen.container.querySelector('[data-testid="crop-pan-surface-outline"]'),
		).toBeNull();
	});
});

describe('CropPanSurface rendering', () => {
	async function expectSameAsImageFrame(setup: SurfaceSetup & { cropRect: ImageCropRect }) {
		const { surface } = await renderSurface(setup);
		const { focal, zoom } = cropRectToFocalZoom(setup.cropRect);
		const reference = render(ImageFrame, {
			class: setup.sizeClass,
			src: LANDSCAPE,
			alt: '',
			fitMode: 'cover-crop',
			focal,
			zoom,
			fillColor: setup.fillColor ?? null,
		});
		const referenceImage = reference.container.querySelector<HTMLImageElement>(
			'[data-testid="image-frame"] img',
		)!;
		await expect
			.poll(() => referenceImage.complete && referenceImage.naturalWidth > 0)
			.toBe(true);
		const surfaceImage = surface.querySelector('img')!;

		const relativeBox = (image: HTMLImageElement) => {
			const frameBox = image.closest('[data-testid="image-frame"]')!.getBoundingClientRect();
			const imageBox = image.getBoundingClientRect();
			return {
				left: imageBox.left - frameBox.left,
				top: imageBox.top - frameBox.top,
				width: imageBox.width,
				height: imageBox.height,
			};
		};
		await expect.poll(() => relativeBox(surfaceImage)).toEqual(relativeBox(referenceImage));
		for (const property of ['objectPosition', 'objectFit', 'transform'] as const) {
			expect(getComputedStyle(surfaceImage)[property]).toBe(
				getComputedStyle(referenceImage)[property],
			);
		}
		const surfaceFrame = surface.querySelector<HTMLElement>('[data-testid="image-frame"]')!;
		const referenceFrame = reference.container.querySelector<HTMLElement>(
			'[data-testid="image-frame"]',
		)!;
		expect(getComputedStyle(surfaceFrame).backgroundColor).toBe(
			getComputedStyle(referenceFrame).backgroundColor,
		);
	}

	it('draws a zoomed-in window exactly as ImageFrame renders it', async () => {
		const rect = zoomCropRect(
			centeredCropRect(THUMB_NORMALIZED_ASPECT),
			THUMB_NORMALIZED_ASPECT,
			1.8,
			{ x: 0.2, y: 0.7 },
		);
		await expectSameAsImageFrame({ cropRect: rect, sizeClass: 'size-40' });
	});

	it('draws a zoomed-out 4:3 window with the fill exactly as ImageFrame renders it', async () => {
		const cardAspect = normalizedCropAspect(CARD_ASPECT, LANDSCAPE_RATIO);
		const rect = zoomCropRect(centeredCropRect(cardAspect), cardAspect, 0.7, { x: 0, y: 0 });
		await expectSameAsImageFrame({
			cropRect: rect,
			aspect: CARD_ASPECT,
			fillColor: 'rgb(250, 240, 220)',
			sizeClass: 'h-36 w-48',
		});
	});
});
