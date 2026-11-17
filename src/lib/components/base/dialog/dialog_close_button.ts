import {
	CIRCULAR_STICKER_OWNER_CLASSES,
	CIRCULAR_STICKER_SURFACE_CLASSES,
} from '$lib/components/base/button/button_variants.js';

const overlayStickerButtonClass = `absolute top-(--overlay-close-inset) size-(--size-control-lg) rounded-full ${CIRCULAR_STICKER_OWNER_CLASSES}`;
const overlayStickerSurfaceClass = `border-[2.5px] border-edge bg-card text-ink hover:bg-card hover:text-ink [&_svg]:size-4 ${CIRCULAR_STICKER_SURFACE_CLASSES}`;

export const overlayCloseButtonClass = `${overlayStickerButtonClass} end-(--overlay-close-inset)`;
export const overlayCloseButtonSurfaceClass = `dialog-close-surface ${overlayStickerSurfaceClass} [&_svg]:transition-[rotate] [&_svg]:duration-(--duration-normal) [&_svg]:ease-(--ease-standard) [&_svg]:delay-0`;

/** The close sticker mirrored to the start inset; its arrow nudges back on hover. */
export const overlayBackButtonClass = `${overlayStickerButtonClass} start-(--overlay-close-inset) group/dialog-back`;
export const overlayBackButtonSurfaceClass = overlayStickerSurfaceClass;
export const overlayBackIconClass =
	'transition-[translate] duration-(--duration-normal) ease-(--ease-standard) motion-safe:group-hover/dialog-back:-translate-x-0.5';
