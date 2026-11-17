/**
 * How urgently a frame fetches its image: `lazy` waits until it nears the viewport, `eager`
 * fetches at once, and `high` also raises the fetch priority for the likely LCP image.
 */
export const IMAGE_LOAD_PRIORITIES = {
	lazy: 'lazy',
	eager: 'eager',
	high: 'high',
} as const;

export type ImageLoadPriority = (typeof IMAGE_LOAD_PRIORITIES)[keyof typeof IMAGE_LOAD_PRIORITIES];
