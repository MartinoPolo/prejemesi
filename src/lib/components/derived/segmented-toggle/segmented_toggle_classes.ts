import { tv } from 'tailwind-variants';

export const segmentedToggleVariants = tv({
	slots: {
		root: 'h-10 gap-0 overflow-visible rounded-lg bg-secondary outline-2 outline-ink shadow-sticker-sm sm:h-8',
		item: 'size-10 rounded-md border-0 shadow-none data-[state=on]:bg-card data-[state=on]:shadow-sticker-sm sm:size-8',
	},
});
