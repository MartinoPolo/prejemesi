/**
 * Editor-facing image display modes (issue #116 follow-up). The gift and
 * wishlist image editors offer exactly three choices – Fill (automatic
 * centered cover), Fit (the whole image letterboxed on both axes) and Manual
 * (user-drawn crops) – while persisted metadata keeps the renderer's
 * {@link ImageFitMode} enum: `fill` and `manual` both persist `cover-crop`
 * geometry and differ only in whether the user drew the framing. Legacy rows
 * persisted with `auto` present as Fill in the editors and keep their `auto`
 * fitMode verbatim until the user actually touches the mode, so saving an
 * untouched form never silently changes how a legacy image renders.
 */

import { IMAGE_FIT_MODES, type ImageFitMode } from './fit_modes.js';
import { imageMetaToFrameProps } from './crop.js';
import { IMAGE_ZOOM_BASE, type ImageMetadata } from './types.js';

export const IMAGE_EDITOR_MODES = {
	fill: 'fill',
	fit: 'fit',
	manual: 'manual',
} as const;

export type ImageEditorMode = (typeof IMAGE_EDITOR_MODES)[keyof typeof IMAGE_EDITOR_MODES];

export const IMAGE_EDITOR_MODE_VALUES = Object.values(IMAGE_EDITOR_MODES);

/** Tolerances for "still the automatic centered framing" classification. */
const CENTERED_FOCAL_EPSILON = 0.5;
const CENTERED_ZOOM_EPSILON = 0.05;

/** The persisted renderer fitMode an editor mode maps to. */
export function fitModeForEditorMode(mode: ImageEditorMode): ImageFitMode {
	return mode === IMAGE_EDITOR_MODES.fit
		? IMAGE_FIT_MODES.containPadded
		: IMAGE_FIT_MODES.coverCrop;
}

/**
 * Editor mode implied by persisted GIFT metadata: manual crops live in
 * `meta.targets`, so cover-crop without targets is the automatic Fill.
 * Legacy `auto` rows present as Fill.
 */
export function giftEditorModeFromMeta(meta: ImageMetadata | null | undefined): ImageEditorMode {
	if (meta == null) {
		return IMAGE_EDITOR_MODES.fill;
	}
	if (meta.fitMode === IMAGE_FIT_MODES.containPadded) {
		return IMAGE_EDITOR_MODES.fit;
	}
	if (
		meta.fitMode === IMAGE_FIT_MODES.coverCrop &&
		meta.targets !== undefined &&
		Object.keys(meta.targets).length > 0
	) {
		return IMAGE_EDITOR_MODES.manual;
	}
	return IMAGE_EDITOR_MODES.fill;
}

/**
 * Editor mode implied by persisted WISHLIST SLOT metadata: a slot has no
 * `targets`, so a cover-crop that still renders the automatic centered framing
 * (focal 50/50 at zoom 1) is Fill and anything user-drawn is Manual.
 */
export function slotEditorModeFromMeta(meta: ImageMetadata | null | undefined): ImageEditorMode {
	if (meta == null) {
		return IMAGE_EDITOR_MODES.fill;
	}
	if (meta.fitMode === IMAGE_FIT_MODES.containPadded) {
		return IMAGE_EDITOR_MODES.fit;
	}
	if (meta.fitMode !== IMAGE_FIT_MODES.coverCrop) {
		// Legacy `auto` (and any future non-crop mode) presents as Fill.
		return IMAGE_EDITOR_MODES.fill;
	}
	const { focal, zoom } = imageMetaToFrameProps(meta);
	const isCentered =
		Math.abs(zoom - IMAGE_ZOOM_BASE) < CENTERED_ZOOM_EPSILON &&
		Math.abs(focal.x - 50) < CENTERED_FOCAL_EPSILON &&
		Math.abs(focal.y - 50) < CENTERED_FOCAL_EPSILON;
	return isCentered ? IMAGE_EDITOR_MODES.fill : IMAGE_EDITOR_MODES.manual;
}

/** Centered cover metadata Fill persists (also the fresh-upload default). */
export function fillImageMeta(bgColor: string | null = null): ImageMetadata {
	return {
		fitMode: IMAGE_FIT_MODES.coverCrop,
		cropRect: null,
		focal: { x: 50, y: 50 },
		zoom: IMAGE_ZOOM_BASE,
		bgColor,
	};
}

/** Fit metadata: the entire image letterboxed on both axes. */
export function fitImageMeta(bgColor: string | null = null): ImageMetadata {
	return { ...fillImageMeta(bgColor), fitMode: IMAGE_FIT_MODES.containPadded };
}
