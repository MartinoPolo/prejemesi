import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const helpTextVariants = tv({
	base: 'mt-1 text-[11px] text-foreground-subtle',
	variants: {
		state: {
			default: '',
			error: 'text-status-danger',
			success: 'text-status-success',
		},
	},
	defaultVariants: {
		state: 'default',
	},
});

export type HelpTextState = keyof typeof helpTextVariants.variants.state;

export const HELP_TEXT_STATES = Object.keys(helpTextVariants.variants.state) as HelpTextState[];

export type HelpTextProps = WithElementRef<HTMLAttributes<HTMLParagraphElement>> & {
	state?: HelpTextState;
};
