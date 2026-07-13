import { tv } from 'tailwind-variants';

export const avatarVariants = tv({
	slots: {
		root: 'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl select-none',
		image: 'size-full',
		fallback:
			'flex size-full items-center justify-center bg-primary/10 font-semibold text-primary',
	},
	variants: {
		size: {
			/* sm matches header controls (--size-control-md = 32px). */
			sm: { root: 'size-8', fallback: 'text-sm' },
			md: { root: 'size-10', fallback: 'text-base' },
			lg: { root: 'size-12', fallback: 'text-lg' },
		},
		/* Anime-sky sticker treatment: ink border + hard offset shadow, matching the
		   outline header buttons it sits next to. The crop radius is the single source
		   of truth for the photo/initials corners (it overrides ImageFrame's own
		   shape radius via tailwind-merge). When bordered, keep the crop CONCENTRIC
		   with the ink border — inner radius = outer rounded-xl minus the 2.5px border
		   width — so the photo and border corners align instead of the photo reading
		   rounder (#137). Without a border there is nothing to inset, so the crop just
		   matches the container's rounded-xl. */
		bordered: {
			true: {
				root: 'border-[2.5px] border-ink bg-card shadow-sticker-sm',
				image: 'rounded-[calc(var(--radius-xl)-2.5px)]',
				fallback: 'rounded-[calc(var(--radius-xl)-2.5px)]',
			},
			false: {
				image: 'rounded-xl',
				fallback: 'rounded-xl',
			},
		},
	},
	defaultVariants: {
		size: 'sm',
		bordered: false,
	},
});

export type AvatarSize = keyof typeof avatarVariants.variants.size;

export const AVATAR_SIZES = Object.keys(avatarVariants.variants.size) as AvatarSize[];
