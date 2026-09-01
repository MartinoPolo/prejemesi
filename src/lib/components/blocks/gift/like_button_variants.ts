import { tv } from 'tailwind-variants';

/**
 * Anime-sky like control (issue #102 REQ-14 + round-2 delta): ghost ink chip
 * with the colored heart; hover tints it with the like blush and lifts it as one surface.
 * `md` matches the mockup card footer and the gift detail modal's action bar
 * (matches `ReserveButton`'s `md` there so the two stay height-aligned), `sm`
 * the compact rows. `ghost` is the borderless card/list chip; `sticker` is the
 * ink-bordered hard-shadow pill used in the detail modal's action bar.
 */
export const likeButtonVariants = tv({
	slots: {
		root: 'group/like inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-transparent font-bold text-foreground transition-[background-color,transform] hover:bg-like-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:scale-108',
		icon: 'text-heart transition-all duration-200',
		count: 'tabular-nums',
	},
	variants: {
		liked: {
			true: {
				icon: 'fill-heart',
			},
			false: {
				icon: 'fill-transparent',
			},
		},
		size: {
			sm: {
				root: 'px-1.5 py-0.5 text-[13px]',
				icon: 'size-3.5',
				count: 'text-[12px]',
			},
			md: {
				root: 'px-2 py-1 text-sm',
				icon: 'size-4',
				count: 'text-[13px]',
			},
			lg: {
				root: 'min-h-[52px] min-w-[52px] gap-2 px-4 text-base',
				icon: 'size-5',
				count: 'text-sm',
			},
		},
		appearance: {
			ghost: {},
			sticker: {
				root: 'rounded-[7px] border-ink bg-card shadow-sticker transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard) delay-0 hover:bg-like-tint hover:shadow-sticker-lift motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-100 motion-reduce:transition-none',
			},
		},
	},
	defaultVariants: {
		liked: false,
		size: 'md',
		appearance: 'ghost',
	},
});

export type LikeButtonSize = keyof typeof likeButtonVariants.variants.size;
export type LikeButtonAppearance = keyof typeof likeButtonVariants.variants.appearance;
