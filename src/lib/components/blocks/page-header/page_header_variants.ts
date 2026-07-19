import { tv } from 'tailwind-variants';

/**
 * Anime-sky page header (issue #102 REQ-16, `anime-dashboard.html`): DynaPuff
 * title sharing one wrapping row with the toolbar, fade-up entrance.
 */
export const pageHeaderVariants = tv({
	slots: {
		root: 'flex flex-wrap items-center justify-between gap-x-4 gap-y-3 motion-safe:animate-fade-up',
		title: 'font-heading font-semibold tracking-tight text-foreground',
		toolbar: 'flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2',
	},
	variants: {
		size: {
			sm: { root: 'pb-3', title: 'text-xl' },
			md: { root: 'pb-5', title: 'text-[clamp(26px,3.4vw,34px)]' },
			lg: { root: 'pb-6', title: 'text-[clamp(28px,3.6vw,38px)]' },
		},
	},
	defaultVariants: {
		size: 'md',
	},
});

export type PageHeaderSize = keyof typeof pageHeaderVariants.variants.size;
