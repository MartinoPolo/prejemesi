import { tv } from 'tailwind-variants';

/**
 * Filled end segment that shares the group's border, radius and height (issue #442). Its outer
 * corners follow the nested-corner rule: group radius minus the group border.
 */
export const inputGroupSegmentVariants = tv({
	base: "order-last flex shrink-0 items-center justify-center gap-1.5 self-stretch whitespace-nowrap rounded-e-[calc(var(--radius-btn)-2.5px)] border-s-[2.5px] border-ink bg-primary px-3 text-(length:--text-base) font-bold text-primary-foreground select-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
	variants: {
		interactive: {
			true: 'cursor-pointer outline-none transition-colors hover:bg-(--primary-hover) focus-visible:ring-3 focus-visible:ring-ring/50',
			false: '',
		},
	},
	defaultVariants: {
		interactive: true,
	},
});
