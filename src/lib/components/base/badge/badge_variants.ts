import type { Snippet } from 'svelte';
import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const badgeVariants = tv({
	base: 'inline-flex items-center justify-center gap-1 font-bold border-2 tracking-[0.01em] whitespace-nowrap [&_[data-icon]]:shrink-0',
	variants: {
		tone: {
			neutral: 'bg-card text-muted-foreground border-ink',
			success:
				'bg-[color-mix(in_oklab,var(--status-success)_14%,var(--card))] text-status-success border-ink',
			warning:
				'bg-[color-mix(in_oklab,var(--status-warning)_14%,var(--card))] text-[color-mix(in_oklab,var(--status-warning)_70%,var(--foreground))] border-ink',
			danger: 'bg-[color-mix(in_oklab,var(--status-danger)_14%,var(--card))] text-status-danger border-ink',
			info: 'bg-[color-mix(in_oklab,var(--status-info)_14%,var(--card))] text-status-info border-ink',
			primary:
				'bg-[color-mix(in_oklab,var(--primary)_14%,var(--card))] text-primary border-ink',
			accent: 'bg-accent-loud text-accent-loud-foreground border-ink',
		},
		badgeStyle: {
			outlined: '',
			subtle: 'border-transparent',
			solid: 'border-ink',
		},
		format: {
			default: '',
			mono: 'font-mono text-[10.5px]',
		},
		size: {
			default: 'h-5 px-1.75 text-[11px] rounded-full',
			compact: 'px-1.5 py-0.5 text-[10px] leading-tight rounded',
			/** Matches Button `sm` metrics — for prominent chips (e.g. wishlist header meta row). */
			lg: 'h-(--size-control-sm) gap-1.5 px-2.5 text-(length:--text-sm) rounded-full [&_[data-icon]]:size-3.5',
		},
	},
	compoundVariants: [
		{ badgeStyle: 'solid', tone: 'success', class: 'bg-status-success text-white' },
		{ badgeStyle: 'solid', tone: 'warning', class: 'bg-status-warning text-black' },
		{ badgeStyle: 'solid', tone: 'danger', class: 'bg-status-danger text-white' },
		{ badgeStyle: 'solid', tone: 'info', class: 'bg-status-info text-white' },
		{ badgeStyle: 'solid', tone: 'primary', class: 'bg-primary text-primary-foreground' },
		{
			badgeStyle: 'solid',
			tone: 'accent',
			class: 'bg-accent-loud text-accent-loud-foreground',
		},
		{ badgeStyle: 'solid', tone: 'neutral', class: 'bg-muted-foreground text-background' },
	],
	defaultVariants: {
		tone: 'neutral',
		badgeStyle: 'outlined',
		format: 'default',
		size: 'default',
	},
});

export type BadgeTone = keyof typeof badgeVariants.variants.tone;
export type BadgeStyle = keyof typeof badgeVariants.variants.badgeStyle;
export type BadgeFormat = keyof typeof badgeVariants.variants.format;
export type BadgeSize = keyof typeof badgeVariants.variants.size;

export const BADGE_TONES = Object.keys(badgeVariants.variants.tone) as BadgeTone[];
export const BADGE_STYLES = Object.keys(badgeVariants.variants.badgeStyle) as BadgeStyle[];
export const BADGE_FORMATS = Object.keys(badgeVariants.variants.format) as BadgeFormat[];
export const BADGE_SIZES = Object.keys(badgeVariants.variants.size) as BadgeSize[];

export const BADGE_DOT_OPTIONS = ['static', 'pulsing'] as const;
export type BadgeDot = (typeof BADGE_DOT_OPTIONS)[number];

export type BadgeProps = WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> & {
	tone?: BadgeTone;
	badgeStyle?: BadgeStyle;
	format?: BadgeFormat;
	size?: BadgeSize;
	collapsed?: boolean;
	dot?: BadgeDot;
	icon?: Snippet;
	children?: Snippet;
};
