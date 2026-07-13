/**
 * Size-appropriate image variants via Cloudflare Image Transformations
 * (issue #107, REQ-3/REQ-5). Card, list, thumbnail, and banner surfaces load a
 * width-bounded, `format=auto` transformation instead of the original object;
 * detail views keep the original (including GIF animation).
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

interface ImageVariantOptions {
	/** Upper bound in CSS pixels × device pixel ratio the surface renders at. */
	width: number;
}

/** Fixed output size for the Open Graph / Twitter card image (issue #117). */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * One variant per display surface. Widths cover the largest rendered size of
 * each surface at 2× device pixel ratio, so a single transformation per
 * surface serves all viewports (bounded, never upscaled via fit=scale-down).
 */
export const IMAGE_VARIANTS = {
	/** Gift card grid + dashboard wishlist card. */
	card: { width: 640 },
	/** Horizontal list-row thumbnail. */
	listThumb: { width: 320 },
	/** Small square thumbnail (nav dropdowns, dashboard list view). */
	thumbnail: { width: 192 },
	/** Wishlist page header image (the taped polaroid print, ~172px wide). */
	banner: { width: 480 },
} as const satisfies Record<string, ImageVariantOptions>;

export type ImageVariant = keyof typeof IMAGE_VARIANTS;

function isAnimatableGif(pathname: string): boolean {
	return pathname.toLowerCase().endsWith('.gif');
}

/**
 * Builds the `/cdn-cgi/image/` transformation URL for a stored image, or
 * returns the source unchanged when it cannot (or should not) be transformed.
 *
 * GIF sources add `anim=false`, so cards and lists load a single still frame
 * instead of the full animated original (REQ-5); the detail view requests the
 * original URL directly, preserving animation.
 */
export function transformedImageUrl(
	src: string | null,
	variant: ImageVariant | null | undefined,
): string | null {
	if (src === null || src === '' || variant == null) {
		return src;
	}

	const base = imagePublicBase();
	if (base === null || !src.startsWith(`${base}/`)) {
		return src;
	}

	const objectPath = src.slice(base.length + 1);
	const { width } = IMAGE_VARIANTS[variant];
	const options = [`width=${String(width)}`, 'fit=scale-down', 'format=auto'];
	if (isAnimatableGif(objectPath)) {
		options.push('anim=false');
	}

	return `${base}/cdn-cgi/image/${options.join(',')}/${objectPath}`;
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
 * URLs, local-dev proxy paths) — same rule as {@link transformedImageUrl}.
 */
export function socialCropImageUrl(src: string | null, focal: ImageFocalPoint): string | null {
	if (src === null || src === '') {
		return src;
	}

	const base = imagePublicBase();
	if (base === null || !src.startsWith(`${base}/`)) {
		return src;
	}

	const objectPath = src.slice(base.length + 1);
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
