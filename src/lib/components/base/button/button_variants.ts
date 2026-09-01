import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';
import { asExhaustiveArray } from '$lib/utils/variants.js';

const FILLED_BUTTON_KBD_CLASSES =
	'[&_[data-slot=kbd]]:border-[color-mix(in_oklab,currentColor_28%,transparent)] [&_[data-slot=kbd]]:bg-[color-mix(in_oklab,currentColor_16%,transparent)] [&_[data-slot=kbd]]:text-current';

/**
 * Keeps the hover hit area stable while a hover lift translates the button up:
 * an always-present pseudo-element extends the hover zone below the button by
 * the lift distance, so hovering the bottom edge cannot flicker (lift →
 * un-hover → drop → re-hover loop).
 */
const LIFT_HIT_AREA_CLASSES =
	"after:absolute after:inset-x-0 after:top-full after:h-2 after:content-['']";

const REDUCED_STICKER_MOTION_CLASSES =
	'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0 motion-reduce:active:scale-100';

/**
 * Flat sticker button: ink border, hard offset shadow, coherent lift on hover, press-down on active.
 * While the button is an open overlay trigger (bits-ui sets `data-state="open"` on popover,
 * dropdown-menu, and sheet triggers), the hover lift is suppressed — lifting the trigger would
 * drag the anchored overlay along with it.
 */
const STICKER_BUTTON_CLASSES = `border-ink shadow-sticker hover:-translate-y-0.5 hover:shadow-sticker-lift active:translate-y-0 active:shadow-sticker-sm data-[state=open]:hover:translate-y-0 data-[state=open]:hover:shadow-sticker ${REDUCED_STICKER_MOTION_CLASSES} ${LIFT_HIT_AREA_CLASSES}`;

/** Shared elevation language for compact circular sticker controls, without layout positioning. */
export const CIRCULAR_STICKER_BUTTON_CLASSES = `shadow-sticker-sm hover:-translate-y-0.5 hover:shadow-sticker-lift active:translate-y-0 active:shadow-sticker-sm ${REDUCED_STICKER_MOTION_CLASSES} ${LIFT_HIT_AREA_CLASSES}`;

/**
 * Circular elevation for anchored overlay triggers. Their surface remains stationary while open
 * so anchored content does not move, while hover still provides lifted shadow feedback.
 */
export const ANCHORED_CIRCULAR_STICKER_BUTTON_CLASSES = `${CIRCULAR_STICKER_BUTTON_CLASSES} data-[state=open]:hover:translate-y-0 aria-[expanded=true]:hover:translate-y-0 data-[state=open]:hover:shadow-sticker-lift aria-[expanded=true]:hover:shadow-sticker-lift`;

export const OUTLINE_CONTROL_SURFACE_CLASSES = `bg-card text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:border-ink focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring ${STICKER_BUTTON_CLASSES}`;

export const buttonVariants = tv({
	base: 'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-btn border-[2.5px] border-transparent font-semibold leading-none outline-none select-none cursor-pointer transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard) delay-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45 [&_[data-icon]]:pointer-events-none [&_[data-icon]]:shrink-0',
	variants: {
		intent: {
			primary: `bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_86%,white)] ${STICKER_BUTTON_CLASSES} ${FILLED_BUTTON_KBD_CLASSES}`,
			secondary: `bg-card text-ink hover:bg-panel-hover ${STICKER_BUTTON_CLASSES}`,
			ghost: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
			'ghost-overlay':
				'bg-transparent border-transparent text-current opacity-60 hover:opacity-90 hover:bg-[color-mix(in_oklab,currentColor_10%,transparent)]',
			danger: 'bg-card text-status-danger border-status-danger shadow-sticker-sm hover:bg-[color-mix(in_oklab,var(--status-danger)_10%,transparent)]',
			'primary-destructive': `bg-status-danger text-white hover:bg-[color-mix(in_oklab,var(--status-danger)_86%,white)] ${STICKER_BUTTON_CLASSES} ${FILLED_BUTTON_KBD_CLASSES}`,
			outline: OUTLINE_CONTROL_SURFACE_CLASSES,
			link: 'text-primary underline-offset-4 hover:underline',
		},
		size: {
			sm: 'h-(--size-control-sm) px-2.25 text-(length:--text-sm) [&_[data-icon]]:size-3.5',
			md: 'h-(--size-control-md) px-3 text-(length:--text-md) [&_[data-icon]]:size-4',
			lg: 'h-(--size-control-lg) px-4 text-(length:--text-base) [&_[data-icon]]:size-4',
			xl: 'h-(--size-control-xl) px-5 text-(length:--text-lg) [&_[data-icon]]:size-5',
			icon: 'size-(--size-control-md) p-0 [&_svg]:size-4',
			'icon-sm': 'size-(--size-control-sm) p-0 [&_svg]:size-3.5',
		},
	},
	defaultVariants: {
		intent: 'primary',
		size: 'md',
	},
});

export type ButtonIntent = keyof typeof buttonVariants.variants.intent;
export type ButtonSize = keyof typeof buttonVariants.variants.size;

export const BUTTON_INTENTS = Object.keys(buttonVariants.variants.intent) as ButtonIntent[];

export const BUTTON_TEXT_SIZES = [
	'sm',
	'md',
	'lg',
	'xl',
] as const satisfies ReadonlyArray<ButtonSize>;
export const BUTTON_ICON_SIZES = ['icon', 'icon-sm'] as const satisfies ReadonlyArray<ButtonSize>;
// Exhaustiveness is enforced here: adding a new size to tv() without updating
// BUTTON_TEXT_SIZES or BUTTON_ICON_SIZES causes a compile error on this line.
export const BUTTON_SIZES = asExhaustiveArray<ButtonSize>()([
	...BUTTON_TEXT_SIZES,
	...BUTTON_ICON_SIZES,
]);

export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
	WithElementRef<HTMLAnchorAttributes> & {
		intent?: ButtonIntent;
		size?: ButtonSize;
	};
