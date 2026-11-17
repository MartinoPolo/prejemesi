/** Viewer-owned sticker depth preference, independent from palette and wishlist data. */
export const DEPTH_STYLES = ['soft', 'ink', 'black'] as const;

export type DepthStyle = (typeof DEPTH_STYLES)[number];

export const DEFAULT_DEPTH_STYLE: DepthStyle = 'soft';
export const DEPTH_STYLE_COOKIE_NAME = 'app-depth';

export function isDepthStyle(value: unknown): value is DepthStyle {
	return typeof value === 'string' && (DEPTH_STYLES as readonly string[]).includes(value);
}
