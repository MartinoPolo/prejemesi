import { tv } from 'tailwind-variants';

export const demoNoticeVariants = tv({
	slots: {
		root: 'border-b border-border bg-card',
		content:
			'mx-auto flex max-w-[var(--content-max-width)] flex-wrap items-center justify-between gap-2 px-[var(--page-gutter)] py-2',
		actions: 'flex flex-wrap items-center gap-2',
	},
});
