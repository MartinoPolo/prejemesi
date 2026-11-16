import { tv } from 'tailwind-variants';

export const imageFrameVariants = tv({
	slots: {
		root: 'relative isolate block overflow-hidden bg-[var(--frame-fill)]',
		image: 'relative z-10 block size-full',
		fallback: 'flex size-full flex-col items-center justify-center gap-2 text-center',
		fallbackIcon: 'text-4xl leading-none text-brand',
		fallbackLabel: 'text-xs text-muted-foreground',
		skeleton: 'absolute inset-0 z-0 size-full rounded-none',
	},
	variants: {
		/** Concrete fit applied to the image (after `auto` has been resolved). */
		fit: {
			/* Edge to edge, exactly as the crop stage draws Fit, so stepping in from Fit
			   to Manual zoom is a small continuous change. */
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
		// Ordinary load progress is a backdrop so an SSR-painted image stays visible
		// before hydration resolves it. Explicit parent loading remains a true cover.
		loadingOverlay: {
			true: { skeleton: 'z-20' },
			false: {},
		},
	},
	defaultVariants: {
		fit: 'cover-crop',
		shape: 'square',
		interactive: false,
		loadingOverlay: false,
	},
});

/** Resolved fit values usable as a variant axis (excludes `auto`). */
export type ImageFrameResolvedFit = keyof typeof imageFrameVariants.variants.fit;

export type ImageFrameShape = keyof typeof imageFrameVariants.variants.shape;
