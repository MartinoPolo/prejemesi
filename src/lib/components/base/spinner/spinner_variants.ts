import type { SVGAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';
import { CONTROL_SIZES, type ControlSize } from '../control_sizing.js';

/**
 * A ring: a faint full-circle track with a quarter arc that spins over it, drawn in the text colour.
 * Sizes match the icon sizes of same-sized controls. Inside a Button or other control, the
 * control's own icon sizing wins, so a spinner there needs no size.
 */
export const spinnerVariants = tv({
	base: 'shrink-0 motion-safe:animate-spin motion-safe:[animation-duration:0.7s]',
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

export type SpinnerProps = SVGAttributes<SVGSVGElement> & {
	size?: SpinnerSize;
	/** Announces the spinner to assistive technology; without it the spinner is decorative. */
	label?: string;
};
