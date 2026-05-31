import type { WithElementRef, WithoutChildren } from '$lib/utils.js';
import type { HTMLTextareaAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const textareaVariants = tv({
	base: 'w-full rounded-md border border-border bg-background px-2.5 py-2 font-sans text-(length:--text-md) leading-normal text-foreground outline-none transition-[border-color,box-shadow] duration-120 ease-[ease] resize-vertical placeholder:text-foreground-subtle hover:border-border-strong disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-secondary disabled:text-foreground-subtle disabled:opacity-70 focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_22%,transparent)]',
	variants: {
		state: {
			default: '',
			error: 'border-status-danger shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-danger)_18%,transparent)]',
		},
	},
	defaultVariants: {
		state: 'default',
	},
});

export type TextareaState = keyof typeof textareaVariants.variants.state;

export const TEXTAREA_STATES = Object.keys(textareaVariants.variants.state) as TextareaState[];

export type TextareaProps = WithoutChildren<WithElementRef<HTMLTextareaAttributes>> & {
	state?: TextareaState;
};
