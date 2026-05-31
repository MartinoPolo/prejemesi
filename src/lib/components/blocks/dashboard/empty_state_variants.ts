import { tv } from 'tailwind-variants';

export const emptyStateVariants = tv({
	slots: {
		root: 'flex flex-col items-center gap-4 px-6 py-18 text-center',
		glyph: 'flex size-18 items-center justify-center rounded-2xl bg-primary/10 text-3xl',
		title: 'font-heading text-lg font-bold text-foreground',
		description: 'max-w-xs text-sm leading-relaxed text-muted-foreground',
	},
});
