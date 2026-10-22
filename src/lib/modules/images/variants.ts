/**
 * Size-appropriate image variants via Cloudflare Image Transformations
 * (issue #107, REQ-3/REQ-5). Card, list, thumbnail, and header surfaces load
 * width-bounded, `format=auto` transformations instead of the original object;
 * the Gift viewer keeps the original (including GIF animation).
 *
 * Every transformable image offers the same fixed width ladder as a `srcset`,
 * and ImageFrame declares the CSS width the image actually paints at (cover
 * overscan and focal zoom included) via `sizes`, so the browser picks the
 * smallest rung covering that width × device pixel ratio (issue #523). The
 * ladder keeps unique transformations per image bounded; `fit=scale-down`
 * caps every rung at the source size.
 *
 * Transformation URLs only apply to images hosted on the PUBLIC_R2_URL domain
 * (an R2 custom domain on the zone with Transformations enabled). External
 * URLs, local-dev proxy paths, and blob previews pass through untouched.
 *
 * Delivery is fail-open: when a transformation cannot be served (free tier
 * allows 5,000 unique transformations/month), ImageFrame falls back to the
 * original URL on error, so images never break.
 */

import { imagePublicBase } from './public_url.js';
import type { ImageFocalPoint } from './types.js';

/** Fixed output size for the Open Graph / Twitter card image (issue #117). */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * Transformation widths offered to the browser. The top rung bounds the
 * heaviest delivery: a zoomed card on a 2× display needs no more in practice.
 */
export const IMAGE_TRANSFORM_WIDTHS = [160, 320, 480, 640, 960, 1280, 1920] as const;

/**
 * Surfaces that load transformations, with the typical CSS width of their
 * frame box. The width only seeds `sizes` for server-rendered markup until
 * ImageFrame measures the real box.
 */
export const IMAGE_VARIANTS = {
	/** Gift card grid + dashboard wishlist card. */
	card: { cssWidth: 360 },
	/** Horizontal list-row thumbnail. */
	listThumb: { cssWidth: 120 },
	/** Small square thumbnail (nav dropdowns, dashboard list view). */
	thumbnail: { cssWidth: 48 },
	/** Wishlist page header image (the taped polaroid print). */
	banner: { cssWidth: 152 },
} as const satisfies Record<string, { cssWidth: number }>;

export type ImageVariant = keyof typeof IMAGE_VARIANTS;

/** `src`/`srcset`/`sizes` attributes for a transformable image. */
export interface ResponsiveImageSource {
	src: string;
	srcset: string;
	sizes: string;
}

function isAnimatableGif(pathname: string): boolean {
	return pathname.toLowerCase().endsWith('.gif');
}

/** Object path below the public base, or null when `src` is not R2-hosted. */
function transformableObjectPath(src: string | null): string | null {
	if (src === null || src === '') {
		return null;
	}
	const base = imagePublicBase();
	if (base === null || !src.startsWith(`${base}/`)) {
		return null;
	}
	return src.slice(base.length + 1);
}

/**
 * Builds the `/cdn-cgi/image/` transformation URL bounded to `width` pixels.
 * GIF sources add `anim=false`, so cards and lists load a single still frame
 * instead of the full animated original (REQ-5).
 */
function transformationUrl(objectPath: string, width: number): string {
	const base = imagePublicBase() ?? '';
	const options = [`width=${String(width)}`, 'fit=scale-down', 'format=auto'];
	if (isAnimatableGif(objectPath)) {
		options.push('anim=false');
	}
	return `${base}/cdn-cgi/image/${options.join(',')}/${objectPath}`;
}

/** Smallest ladder width delivering at least `requiredWidth` pixels (top rung when none does). */
export function ladderWidthFor(requiredWidth: number): number {
	return (
		IMAGE_TRANSFORM_WIDTHS.find((width) => width >= requiredWidth) ??
		IMAGE_TRANSFORM_WIDTHS[IMAGE_TRANSFORM_WIDTHS.length - 1]
	);
}

/**
 * Responsive attributes for a stored image painted `paintedCssWidth` CSS pixels
 * wide, or null when the source cannot (or should not) be transformed — the
 * caller then loads the original. The `src` fallback assumes a 2× display.
 */
export function responsiveImageSource(
	src: string | null,
	variant: ImageVariant | null | undefined,
	paintedCssWidth: number,
): ResponsiveImageSource | null {
	if (variant == null) {
		return null;
	}
	const objectPath = transformableObjectPath(src);
	if (objectPath === null) {
		return null;
	}
	const cssWidth = Math.max(1, Math.ceil(paintedCssWidth));
	return {
		src: transformationUrl(objectPath, ladderWidthFor(cssWidth * 2)),
		srcset: IMAGE_TRANSFORM_WIDTHS.map(
			(width) => `${transformationUrl(objectPath, width)} ${String(width)}w`,
		).join(', '),
		sizes: `${String(cssWidth)}px`,
	};
}

/**
 * Builds a fixed 1200×630 `/cdn-cgi/image/` crop for the Open Graph / Twitter
 * card preview, honoring the social slot's saved focal point (issue #117: the
 * OG image previously always served the unmodified source, ignoring any crop
 * the owner drew for the `social` slot). `fit=cover` fills the exact frame and
 * `gravity` — Cloudflare's 0..1 focal-point fraction — pins the crop to the
 * same point the in-app ImageFrame renders via `object-position`, so the
 * crawler-visible crop matches what visitors see in the editor preview.
 * Falls through to the source unchanged for non-R2-hosted images (external
 * URLs, local-dev proxy paths) — same rule as {@link responsiveImageSource}.
 */
export function socialCropImageUrl(src: string | null, focal: ImageFocalPoint): string | null {
	const objectPath = transformableObjectPath(src);
	if (objectPath === null) {
		return src;
	}

	const base = imagePublicBase() ?? '';
	const gravityX = (Math.min(Math.max(focal.x, 0), 100) / 100).toFixed(2);
	const gravityY = (Math.min(Math.max(focal.y, 0), 100) / 100).toFixed(2);
	const options = [
		`width=${String(OG_IMAGE_WIDTH)}`,
		`height=${String(OG_IMAGE_HEIGHT)}`,
		'fit=cover',
		`gravity=${gravityX}x${gravityY}`,
		'format=jpeg',
	];
	if (isAnimatableGif(objectPath)) {
		options.push('anim=false');
	}

	return `${base}/cdn-cgi/image/${options.join(',')}/${objectPath}`;
}
