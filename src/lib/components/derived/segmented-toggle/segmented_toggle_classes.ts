import { tv } from 'tailwind-variants';

export const segmentedToggleVariants = tv({
	slots: {
		root: 'gap-px overflow-visible rounded-btn border-2 border-ink bg-secondary p-px shadow-sticker-sm',
		item: 'size-10 rounded-[calc(var(--radius-btn)-2px)] border-0 shadow-none focus-visible:!outline-offset-2 focus-visible:!outline-ring data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:outline-2 data-[state=on]:outline-offset-[-2px] data-[state=on]:outline-ink sm:size-8',
	},
});
