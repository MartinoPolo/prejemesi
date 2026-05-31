import { tv } from 'tailwind-variants';

export const pageHeaderVariants = tv({
	slots: {
		root: 'flex items-center justify-between gap-4',
		title: 'font-bold tracking-tight',
		toolbar: 'flex items-center gap-2 flex-shrink-0',
	},
	variants: {
		size: {
			sm: { root: 'pb-3', title: 'text-lg' },
			md: { root: 'pb-4', title: 'text-2xl' },
			lg: { root: 'pb-6', title: 'text-3xl' },
		},
	},
	defaultVariants: {
		size: 'md',
	},
});

export type PageHeaderSize = keyof typeof pageHeaderVariants.variants.size;
