import type { WithElementRef, WithoutChildren } from '$lib/utils.js';
import type { HTMLInputAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const inputVariants = tv({
	base: 'h-(--size-control-md) w-full rounded-md border border-border bg-surface px-2.5 font-sans text-(length:--text-md) text-foreground outline-none transition-[border-color,box-shadow] duration-120 ease-[ease] placeholder:text-foreground-subtle hover:border-border-strong disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-foreground-subtle disabled:opacity-70 read-only:bg-surface-2 read-only:text-foreground-muted focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_22%,transparent)]',
	variants: {
		state: {
			default: '',
			success:
				'border-status-success shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-success)_18%,transparent)]',
			error: 'border-status-danger shadow-[0_0_0_3px_color-mix(in_oklch,var(--status-danger)_18%,transparent)]',
			loading:
				'animate-shimmer bg-[length:200%_100%] bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklch,var(--primary)_12%,transparent)_50%,transparent_100%)]',
		},
	},
	defaultVariants: {
		state: 'default',
	},
});

export type InputState = keyof typeof inputVariants.variants.state;

export const INPUT_STATES = Object.keys(inputVariants.variants.state) as InputState[];

export type InputProps = WithoutChildren<WithElementRef<HTMLInputAttributes>> & {
	state?: InputState;
	files?: FileList | null;
};
