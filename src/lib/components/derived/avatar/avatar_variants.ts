import { tv } from 'tailwind-variants';

export const avatarVariants = tv({
	slots: {
		root: 'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl select-none',
		image: 'size-full rounded-xl',
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
		/* Anime-sky sticker treatment: ink border + hard offset shadow, matching
		   the outline header buttons it sits next to. */
		bordered: {
			true: { root: 'border-[2.5px] border-ink bg-card shadow-sticker-sm' },
			false: {},
		},
	},
	defaultVariants: {
		size: 'sm',
		bordered: false,
	},
});

export type AvatarSize = keyof typeof avatarVariants.variants.size;

export const AVATAR_SIZES = Object.keys(avatarVariants.variants.size) as AvatarSize[];
