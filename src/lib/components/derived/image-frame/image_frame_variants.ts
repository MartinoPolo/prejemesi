import { tv } from 'tailwind-variants';

export const imageFrameVariants = tv({
	slots: {
		root: 'relative block overflow-hidden bg-[var(--frame-fill)]',
		image: 'block size-full',
		fallback: 'flex size-full flex-col items-center justify-center gap-2 text-center',
		fallbackIcon: 'text-4xl leading-none text-wishlist-icon',
		fallbackLabel: 'text-xs text-foreground-subtle',
		skeleton: 'absolute inset-0 z-10 size-full rounded-none',
	},
	variants: {
		/** Concrete fit applied to the image (after `auto` has been resolved). */
		fit: {
			'contain-padded': { image: 'object-contain' },
			'cover-crop': { image: 'object-cover' },
		},
		shape: {
			square: { root: 'rounded-md' },
			circle: { root: 'rounded-full' },
		},
		interactive: {
			true: {
				root: 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
			},
			false: {},
		},
	},
	defaultVariants: {
		fit: 'cover-crop',
		shape: 'square',
		interactive: false,
	},
});

/** Resolved fit values usable as a variant axis (excludes `auto`). */
export type ImageFrameResolvedFit = keyof typeof imageFrameVariants.variants.fit;

export type ImageFrameShape = keyof typeof imageFrameVariants.variants.shape;
