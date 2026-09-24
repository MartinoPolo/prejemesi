import type { WithElementRef, WithoutChildren } from '$lib/utils.js';
import type { HTMLInputAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';
import {
	CONTROL_SIZES,
	CONTROL_SIZE_CLASSES,
	RESPONSIVE_CONTROL_SIZE_CLASSES,
	RESPONSIVE_CONTROL_TEXT_SIZE_CLASSES,
	CONTROL_TEXT_SIZE_CLASSES,
	type ControlSize,
} from '../control_sizing.js';

export const inputVariants = tv({
	base: 'w-full rounded-btn border-[2.5px] border-ink bg-card font-sans font-medium text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70 read-only:bg-muted read-only:text-muted-foreground focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]',
	variants: {
		size: {
			responsive: `${RESPONSIVE_CONTROL_SIZE_CLASSES} ${RESPONSIVE_CONTROL_TEXT_SIZE_CLASSES}`,
			sm: `${CONTROL_SIZE_CLASSES.sm} ${CONTROL_TEXT_SIZE_CLASSES.sm}`,
			md: `${CONTROL_SIZE_CLASSES.md} ${CONTROL_TEXT_SIZE_CLASSES.md}`,
			lg: `${CONTROL_SIZE_CLASSES.lg} ${CONTROL_TEXT_SIZE_CLASSES.lg}`,
			xl: `${CONTROL_SIZE_CLASSES.xl} ${CONTROL_TEXT_SIZE_CLASSES.xl}`,
		},
		state: {
			default: '',
			success:
				'border-status-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--status-success)_18%,transparent)]',
			error: 'border-status-danger shadow-[0_0_0_3px_color-mix(in_oklab,var(--status-danger)_18%,transparent)]',
			loading:
				'animate-shimmer bg-[length:200%_100%] bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklab,var(--primary)_12%,transparent)_50%,transparent_100%)]',
		},
	},
	defaultVariants: {
		size: 'responsive',
		state: 'default',
	},
});

export type InputSize = ControlSize;
export const INPUT_SIZES = [...CONTROL_SIZES];
export type InputState = keyof typeof inputVariants.variants.state;

export const INPUT_STATES = Object.keys(inputVariants.variants.state) as InputState[];

export type InputProps = Omit<WithoutChildren<WithElementRef<HTMLInputAttributes>>, 'size'> & {
	size?: InputSize;
	state?: InputState;
	files?: FileList | null;
};
