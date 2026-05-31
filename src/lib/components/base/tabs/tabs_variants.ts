import type { Snippet } from 'svelte';
import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const tabsContainerVariants = tv({
	base: 'inline-flex bg-secondary border border-border p-0.75 rounded-md gap-0.5',
});

export const tabVariants = tv({
	base: 'inline-flex items-center gap-1.5 px-3 py-1.25 text-xs font-medium rounded-sm text-muted-foreground cursor-pointer transition-all duration-120 ease-[ease] border-none bg-transparent hover:text-foreground hover:bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] active:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]',
	variants: {
		active: {
			true: 'bg-background text-foreground shadow-sm hover:bg-surface-hover',
			false: '',
		},
	},
	defaultVariants: {
		active: false,
	},
});

export type TabsContainerProps = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
	children?: Snippet;
};

export type TabProps = WithElementRef<HTMLButtonAttributes, HTMLButtonElement> & {
	active?: boolean;
	children?: Snippet;
};
