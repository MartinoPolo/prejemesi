import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';
import { asExhaustiveArray } from '$lib/utils/variants.js';

export const buttonVariants = tv({
	base: 'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium leading-none outline-none select-none cursor-pointer transition-[background,border-color,color,transform,filter,box-shadow] duration-120 ease-[ease] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45 [&_[data-icon]]:pointer-events-none [&_[data-icon]]:shrink-0',
	variants: {
		intent: {
			primary:
				'bg-primary text-primary-foreground shadow-sm hover:bg-[color-mix(in_oklch,var(--primary)_88%,white_12%)] dark:hover:bg-[color-mix(in_oklch,var(--primary)_88%,black_12%)]',
			secondary:
				'border-border bg-surface-2 text-foreground hover:bg-surface-3 hover:border-border-strong',
			ghost: 'bg-transparent text-foreground-muted hover:bg-surface-hover hover:text-foreground',
			'ghost-overlay':
				'bg-transparent border-transparent text-current opacity-60 hover:opacity-90 hover:bg-[color-mix(in_oklch,currentColor_10%,transparent)]',
			danger: 'bg-transparent text-status-danger border-[color-mix(in_oklch,var(--status-danger)_35%,transparent)] hover:bg-[color-mix(in_oklch,var(--status-danger)_12%,transparent)]',
			'primary-destructive':
				'bg-status-danger text-white shadow-sm hover:bg-[color-mix(in_oklch,var(--status-danger)_88%,white_12%)] dark:hover:bg-[color-mix(in_oklch,var(--status-danger)_88%,black_12%)]',
			outline: 'border-border bg-background hover:bg-accent hover:text-accent-foreground',
			link: 'text-primary underline-offset-4 hover:underline',
		},
		size: {
			xs: 'h-7 px-1.5 text-(length:--text-xs) rounded-sm [&_[data-icon]]:size-3',
			sm: 'h-(--size-control-sm) px-2.25 text-(length:--text-sm) rounded-sm [&_[data-icon]]:size-3.5',
			md: 'h-(--size-control-md) px-3 text-(length:--text-md) [&_[data-icon]]:size-4',
			lg: 'h-(--size-control-lg) px-4 text-(length:--text-base) [&_[data-icon]]:size-4',
			icon: 'size-(--size-control-md) p-0 [&_[data-icon]]:size-4',
			'icon-xs': 'size-7 p-0 [&_[data-icon]]:size-3',
			'icon-sm': 'size-(--size-control-sm) p-0 [&_[data-icon]]:size-3.5',
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
	'xs',
	'sm',
	'md',
	'lg',
] as const satisfies ReadonlyArray<ButtonSize>;
export const BUTTON_ICON_SIZES = [
	'icon-xs',
	'icon',
	'icon-sm',
] as const satisfies ReadonlyArray<ButtonSize>;
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
