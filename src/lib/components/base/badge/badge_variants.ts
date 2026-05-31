import type { Snippet } from 'svelte';
import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const badgeVariants = tv({
	base: 'inline-flex items-center justify-center gap-1 font-medium border tracking-[0.01em] whitespace-nowrap',
	variants: {
		tone: {
			neutral: 'bg-surface-2 text-foreground-muted border-border',
			success:
				'bg-[color-mix(in_oklch,var(--status-success)_14%,transparent)] text-status-success border-[color-mix(in_oklch,var(--status-success)_30%,transparent)]',
			warning:
				'bg-[color-mix(in_oklch,var(--status-warning)_14%,transparent)] text-[color-mix(in_oklch,var(--status-warning)_70%,var(--foreground))] border-[color-mix(in_oklch,var(--status-warning)_30%,transparent)]',
			danger: 'bg-[color-mix(in_oklch,var(--status-danger)_14%,transparent)] text-status-danger border-[color-mix(in_oklch,var(--status-danger)_30%,transparent)]',
			info: 'bg-[color-mix(in_oklch,var(--status-info)_14%,transparent)] text-status-info border-[color-mix(in_oklch,var(--status-info)_30%,transparent)]',
			primary:
				'bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] text-primary border-[color-mix(in_oklch,var(--primary)_30%,transparent)]',
			accent: 'bg-[color-mix(in_oklch,var(--accent)_16%,transparent)] text-[color-mix(in_oklch,var(--accent)_70%,var(--foreground))] border-[color-mix(in_oklch,var(--accent)_32%,transparent)]',
		},
		badgeStyle: {
			outlined: '',
			subtle: 'border-transparent',
			solid: 'border-transparent',
		},
		format: {
			default: '',
			mono: 'font-mono text-[10.5px]',
		},
		size: {
			default: 'h-5 px-1.75 text-[11px] rounded-full',
			compact: 'px-1.5 py-0.5 text-[10px] leading-tight rounded',
		},
	},
	compoundVariants: [
		{ badgeStyle: 'solid', tone: 'success', class: 'bg-status-success text-white' },
		{ badgeStyle: 'solid', tone: 'warning', class: 'bg-status-warning text-black' },
		{ badgeStyle: 'solid', tone: 'danger', class: 'bg-status-danger text-white' },
		{ badgeStyle: 'solid', tone: 'info', class: 'bg-status-info text-white' },
		{ badgeStyle: 'solid', tone: 'primary', class: 'bg-primary text-primary-foreground' },
		{ badgeStyle: 'solid', tone: 'accent', class: 'bg-accent text-white' },
		{ badgeStyle: 'solid', tone: 'neutral', class: 'bg-foreground-muted text-background' },
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
