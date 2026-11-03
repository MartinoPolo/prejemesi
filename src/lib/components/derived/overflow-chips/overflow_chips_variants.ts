import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';
import { badgeVariants } from '$lib/components/base/badge/index.js';

export const overflowChipsVariants = tv({
	slots: {
		root: 'flex min-w-0 gap-1',
		moreChip: badgeVariants({ tone: 'neutral' }),
		moreTrigger: [
			badgeVariants({ tone: 'neutral' }),
			'cursor-pointer hover:bg-[color-mix(in_oklab,var(--brand)_12%,var(--card))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
		],
		popover: 'w-max max-w-[min(18rem,calc(100vw-1rem))] min-w-0',
		popoverList: 'm-0 flex list-none flex-wrap gap-1.5 px-2 pt-0.5 pb-1.5',
	},
	variants: {
		layout: {
			/** "+N" follows the visible chips on the same line. */
			inline: { root: 'items-start' },
			/** The visible chips take the whole line and "+N" drops below them. */
			stacked: { root: 'flex-col items-start' },
		},
		dimmed: {
			true: { moreChip: 'opacity-50', moreTrigger: 'opacity-50' },
			false: {},
		},
	},
	defaultVariants: {
		layout: 'inline',
		dimmed: false,
	},
});

export type OverflowChipsLayout = keyof typeof overflowChipsVariants.variants.layout;

export const OVERFLOW_CHIPS_LAYOUTS = Object.keys(
	overflowChipsVariants.variants.layout,
) as OverflowChipsLayout[];

export type OverflowChipsProps<Item> = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
	/** Every item in display order. */
	items: readonly Item[];
	/** How many leading items fit on the row; the rest collapse into "+N". */
	visibleCount: number;
	itemKey: (item: Item) => string | number;
	/** Readable name of an item, listed for screen readers when it is hidden behind "+N". */
	itemLabel: (item: Item) => string;
	/** A chip on the row. */
	chip: Snippet<[item: Item, index: number]>;
	/** A chip in the popover list; defaults to `chip`. */
	popoverChip?: Snippet<[item: Item]>;
	/** Accessible name of the "+N" trigger. */
	moreLabel: (hiddenCount: number) => string;
	popoverTitle: string;
	/** When false, "+N" is a static chip, so a surrounding press (selection, reorder) owns it. */
	interactive?: boolean;
	dimmed?: boolean;
	layout?: OverflowChipsLayout;
};
