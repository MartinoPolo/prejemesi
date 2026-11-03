import type { IconProps } from '@lucide/svelte';
import { tv } from 'tailwind-variants';
import { CONTROL_SIZES, type ControlSize } from '../control_sizing.js';

/**
 * Sizes match the icon sizes of same-sized controls. Inside a Button or other control, the
 * control's own icon sizing wins, so a spinner there needs no size.
 */
export const spinnerVariants = tv({
	base: 'shrink-0 motion-safe:animate-spin',
	variants: {
		size: {
			sm: 'size-3.5',
			md: 'size-4',
			lg: 'size-4',
			xl: 'size-5',
		} satisfies Record<ControlSize, string>,
	},
	defaultVariants: {
		size: 'md',
	},
});

export type SpinnerSize = ControlSize;

export const SPINNER_SIZES = [...CONTROL_SIZES];

export type SpinnerProps = Omit<IconProps, 'size'> & {
	size?: SpinnerSize;
	/** Announces the spinner to assistive technology; without it the spinner is decorative. */
	label?: string;
};
