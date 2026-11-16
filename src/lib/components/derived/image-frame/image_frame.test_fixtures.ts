import { expect } from 'vitest';

interface EdgeGaps {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

/**
 * Gaps in CSS pixels between a frame's edges and the photo an `object-fit: contain`
 * image paints inside it (centered in the image's content box, per CSS defaults).
 */
async function containedPhotoGaps(frame: HTMLElement, image: HTMLImageElement): Promise<EdgeGaps> {
	await expect.poll(() => image.complete && image.naturalWidth > 0).toBe(true);
	const style = getComputedStyle(image);
	const insetOf = (side: 'Top' | 'Right' | 'Bottom' | 'Left') =>
		Number.parseFloat(style[`padding${side}`]) + Number.parseFloat(style[`border${side}Width`]);
	const imageBox = image.getBoundingClientRect();
	const contentLeft = imageBox.left + insetOf('Left');
	const contentTop = imageBox.top + insetOf('Top');
	const contentWidth = imageBox.width - insetOf('Left') - insetOf('Right');
	const contentHeight = imageBox.height - insetOf('Top') - insetOf('Bottom');
	const scale = Math.min(contentWidth / image.naturalWidth, contentHeight / image.naturalHeight);
	const photoWidth = image.naturalWidth * scale;
	const photoHeight = image.naturalHeight * scale;
	const photoLeft = contentLeft + (contentWidth - photoWidth) / 2;
	const photoTop = contentTop + (contentHeight - photoHeight) / 2;
	const frameBox = frame.getBoundingClientRect();
	return {
		top: photoTop - frameBox.top,
		right: frameBox.right - (photoLeft + photoWidth),
		bottom: frameBox.bottom - (photoTop + photoHeight),
		left: photoLeft - frameBox.left,
	};
}

/**
 * A letterboxed photo spans the frame's full width or height, with the fill only on
 * the other axis.
 */
export async function expectPhotoEdgeToEdge(
	frame: HTMLElement,
	image: HTMLImageElement,
	spannedAxis: 'width' | 'height',
): Promise<void> {
	const gaps = await containedPhotoGaps(frame, image);
	const [touching, filled] =
		spannedAxis === 'height'
			? [
					[gaps.top, gaps.bottom],
					[gaps.left, gaps.right],
				]
			: [
					[gaps.left, gaps.right],
					[gaps.top, gaps.bottom],
				];
	for (const gap of touching) {
		expect(Math.abs(gap)).toBeLessThan(0.5);
	}
	for (const gap of filled) {
		expect(gap).toBeGreaterThan(1);
	}
}
