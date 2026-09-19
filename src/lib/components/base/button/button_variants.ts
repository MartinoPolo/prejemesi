import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';
import {
	CONTROL_ICON_SIZE_CLASSES,
	CONTROL_SIZES,
	CONTROL_SIZE_CLASSES,
	RESPONSIVE_CONTROL_SIZE_CLASSES,
	RESPONSIVE_CONTROL_TEXT_SIZE_CLASSES,
	CONTROL_TEXT_SIZE_CLASSES,
	type ControlSize,
} from '../control_sizing.js';

const FILLED_BUTTON_KBD_CLASSES =
	'[&_[data-slot=kbd]]:border-[color-mix(in_oklab,currentColor_28%,transparent)] [&_[data-slot=kbd]]:bg-[color-mix(in_oklab,currentColor_16%,transparent)] [&_[data-slot=kbd]]:text-current';

export const CIRCULAR_STICKER_OWNER_CLASSES = 'elevation-owner elevation-owner-raised';
export const CIRCULAR_STICKER_SURFACE_CLASSES = 'elevation-surface rounded-full';
export const ANCHORED_CIRCULAR_STICKER_OWNER_CLASSES = `${CIRCULAR_STICKER_OWNER_CLASSES} elevation-owner-anchored`;

/** Paint-only classes for raised outline control surfaces (selects use this on their surface). */
export const OUTLINE_CONTROL_SURFACE_CLASSES =
	'border-ink bg-card text-foreground group-hover:bg-accent group-hover:text-accent-foreground';

export const buttonVariants = tv({
	slots: {
		owner: 'group relative inline-flex shrink-0 whitespace-nowrap rounded-btn font-semibold leading-none outline-none select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45',
		surface:
			'elevation-surface inline-flex size-full min-h-inherit min-w-inherit items-center justify-center gap-1.5 rounded-[inherit] border-[2.5px] border-transparent transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard) delay-0 [&_[data-icon]]:pointer-events-none [&_[data-icon]]:shrink-0',
	},
	variants: {
		intent: {
			primary: {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface: `border-ink bg-primary text-primary-foreground group-hover:bg-(--primary-hover) ${FILLED_BUTTON_KBD_CLASSES}`,
			},
			secondary: {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface: 'border-ink bg-card text-ink group-hover:bg-panel-hover',
			},
			'secondary-filled': {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface: `border-ink bg-foreground text-background group-hover:bg-[color-mix(in_oklab,var(--foreground)_86%,var(--background))] ${FILLED_BUTTON_KBD_CLASSES}`,
			},
			ghost: {
				surface:
					'bg-transparent text-muted-foreground group-hover:bg-accent group-hover:text-foreground',
			},
			'ghost-overlay': {
				surface:
					'bg-transparent text-current opacity-60 group-hover:opacity-90 group-hover:bg-[color-mix(in_oklab,currentColor_10%,transparent)]',
			},
			danger: {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface:
					'border-status-danger bg-card text-status-danger group-hover:bg-[color-mix(in_oklab,var(--status-danger)_10%,transparent)]',
			},
			'primary-destructive': {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface: `border-ink bg-status-danger text-white group-hover:bg-[color-mix(in_oklab,var(--status-danger)_86%,white)] ${FILLED_BUTTON_KBD_CLASSES}`,
			},
			outline: {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface: OUTLINE_CONTROL_SURFACE_CLASSES,
			},
			link: { surface: 'text-brand underline-offset-4 group-hover:underline' },
		},
		size: {
			responsive: {
				owner: RESPONSIVE_CONTROL_SIZE_CLASSES,
				surface: CONTROL_ICON_SIZE_CLASSES.lg,
			},
			sm: { owner: CONTROL_SIZE_CLASSES.sm, surface: CONTROL_ICON_SIZE_CLASSES.sm },
			md: { owner: CONTROL_SIZE_CLASSES.md, surface: CONTROL_ICON_SIZE_CLASSES.md },
			lg: { owner: CONTROL_SIZE_CLASSES.lg, surface: CONTROL_ICON_SIZE_CLASSES.lg },
			xl: { owner: CONTROL_SIZE_CLASSES.xl, surface: CONTROL_ICON_SIZE_CLASSES.xl },
		},
		format: {
			text: { surface: '' },
			icon: { owner: 'aspect-square', surface: 'p-0' },
		},
	},
	compoundVariants: [
		{
			size: 'responsive',
			format: 'text',
			class: { surface: RESPONSIVE_CONTROL_TEXT_SIZE_CLASSES },
		},
		{ size: 'sm', format: 'text', class: { surface: CONTROL_TEXT_SIZE_CLASSES.sm } },
		{ size: 'md', format: 'text', class: { surface: CONTROL_TEXT_SIZE_CLASSES.md } },
		{ size: 'lg', format: 'text', class: { surface: CONTROL_TEXT_SIZE_CLASSES.lg } },
		{ size: 'xl', format: 'text', class: { surface: CONTROL_TEXT_SIZE_CLASSES.xl } },
	],
	defaultVariants: { intent: 'primary', size: 'responsive', format: 'text' },
});

export type ButtonIntent = keyof typeof buttonVariants.variants.intent;
export type ButtonSize = ControlSize;
export type ButtonFormat = keyof typeof buttonVariants.variants.format;
export const BUTTON_INTENTS = Object.keys(buttonVariants.variants.intent) as ButtonIntent[];
export const BUTTON_SIZES = [...CONTROL_SIZES];
export const BUTTON_TEXT_SIZES = BUTTON_SIZES;
export const BUTTON_FORMATS = Object.keys(buttonVariants.variants.format) as ButtonFormat[];

export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
	WithElementRef<HTMLAnchorAttributes> & {
		intent?: ButtonIntent;
		size?: ButtonSize;
		format?: ButtonFormat;
		/** Paint and internal layout classes for the moving surface. */
		surfaceClass?: string;
	};
