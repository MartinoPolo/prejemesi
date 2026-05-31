import { tv } from 'tailwind-variants';

export const likeButtonVariants = tv({
	slots: {
		root: 'group/like inline-flex items-center gap-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm',
		icon: 'transition-all duration-200',
		count: 'text-xs tabular-nums',
	},
	variants: {
		liked: {
			true: {
				root: 'text-liked',
				icon: 'fill-liked',
			},
			false: {
				root: 'text-muted-foreground hover:text-liked',
				icon: 'fill-transparent',
			},
		},
		size: {
			sm: {
				icon: 'size-3.5',
				count: 'text-[11px]',
			},
			md: {
				icon: 'size-4',
				count: 'text-xs',
			},
		},
	},
	defaultVariants: {
		liked: false,
		size: 'md',
	},
});

export type LikeButtonSize = keyof typeof likeButtonVariants.variants.size;
