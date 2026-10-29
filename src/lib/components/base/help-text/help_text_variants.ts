import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const helpTextVariants = tv({
	base: 'mt-1 text-(length:--text-sm) text-muted-foreground',
	variants: {
		state: {
			default: '',
			error: 'text-status-danger-text',
			success: 'text-status-success-text',
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
