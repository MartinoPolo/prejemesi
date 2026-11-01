export interface PhotoBox {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** Gaps between a frame's edges and a box inside it. */
export function gapsWithin(frameBox: DOMRect, inner: PhotoBox) {
	return {
		left: inner.left - frameBox.left,
		top: inner.top - frameBox.top,
		right: frameBox.right - (inner.left + inner.width),
		bottom: frameBox.bottom - (inner.top + inner.height),
	};
}

/** Where an `object-contain` image actually paints: its natural aspect, centred in its content box. */
export function paintedPhotoBox(image: HTMLImageElement): PhotoBox {
	const elementBox = image.getBoundingClientRect();
	const style = getComputedStyle(image);
	const paddingLeft = parseFloat(style.paddingLeft);
	const paddingTop = parseFloat(style.paddingTop);
	const contentWidth = elementBox.width - paddingLeft - parseFloat(style.paddingRight);
	const contentHeight = elementBox.height - paddingTop - parseFloat(style.paddingBottom);
	const scale = Math.min(contentWidth / image.naturalWidth, contentHeight / image.naturalHeight);
	const width = image.naturalWidth * scale;
	const height = image.naturalHeight * scale;
	return {
		left: elementBox.left + paddingLeft + (contentWidth - width) / 2,
		top: elementBox.top + paddingTop + (contentHeight - height) / 2,
		width,
		height,
	};
}
