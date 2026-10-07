import type { Snippet } from 'svelte';
import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

const SELECTED_TAB_FACE_CLASSES = 'border-ink bg-card shadow-sticker-sm';

/** Paints the selected tab face that slides between tabs; mirrors the active tab face. */
export const TAB_INDICATOR_CLASSES = `rounded-btn border-2 ${SELECTED_TAB_FACE_CLASSES}`;

export const tabsContainerVariants = tv({
	base: 'inline-flex bg-background border-[2.5px] border-ink p-[5px] rounded-[12px] gap-1',
});

export const tabVariants = tv({
	base: 'inline-flex items-center gap-1.5 px-3 py-1.25 text-xs font-semibold rounded-btn text-muted-foreground cursor-pointer transition-[background-color,color,box-shadow] border-2 border-transparent bg-transparent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed',
	variants: {
		active: {
			true: `text-foreground ${SELECTED_TAB_FACE_CLASSES}`,
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
