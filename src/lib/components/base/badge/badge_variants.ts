import type { Snippet } from 'svelte';
import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

/** Shape shared by every badge-like chip so radius and border weight stay in one place. */
export const badgeShape = 'rounded-badge border-2';

const FILLED_BADGE_STYLES = ['solid', 'count'] as const;

export const badgeVariants = tv({
	base: 'inline-flex items-center justify-center gap-1 font-bold tracking-[0.01em] whitespace-nowrap tabular-nums [&_[data-icon]]:shrink-0',
	variants: {
		tone: {
			neutral: 'bg-card text-muted-foreground border-ink',
			success:
				'bg-[color-mix(in_oklab,var(--status-success)_14%,var(--card))] text-status-success-text border-ink',
			warning:
				'bg-[color-mix(in_oklab,var(--status-warning)_14%,var(--card))] text-status-warning-text border-ink',
			danger: 'bg-[color-mix(in_oklab,var(--status-danger)_14%,var(--card))] text-status-danger-text border-ink',
			info: 'bg-[color-mix(in_oklab,var(--status-info)_14%,var(--card))] text-brand-link border-ink',
			primary:
				'bg-[color-mix(in_oklab,var(--primary)_14%,var(--card))] text-brand-link border-ink',
			accent: 'bg-accent-loud text-accent-loud-foreground border-ink',
		},
		badgeStyle: {
			outlined: badgeShape,
			subtle: `${badgeShape} border-transparent`,
			solid: `${badgeShape} border-ink`,
			/** Compact filled pill for a live number, such as the active-filter count on a trigger. */
			count: 'rounded-full border-0',
		},
		size: {
			default: 'h-5 px-1.75 text-[11px]',
			/** Matches Button `sm` metrics — for prominent chips (e.g. wishlist header meta row). */
			lg: 'h-(--size-control-sm) gap-1.5 px-2.5 text-(length:--text-sm) [&_[data-icon]]:size-3.5',
		},
	},
	compoundVariants: [
		{
			badgeStyle: [...FILLED_BADGE_STYLES],
			tone: 'success',
			class: 'bg-status-success text-white',
		},
		{
			badgeStyle: [...FILLED_BADGE_STYLES],
			tone: 'warning',
			class: 'bg-status-warning text-black',
		},
		{
			badgeStyle: [...FILLED_BADGE_STYLES],
			tone: 'danger',
			class: 'bg-status-danger-fill text-white',
		},
		{ badgeStyle: [...FILLED_BADGE_STYLES], tone: 'info', class: 'bg-status-info text-white' },
		{
			badgeStyle: [...FILLED_BADGE_STYLES],
			tone: 'primary',
			class: 'bg-primary text-primary-foreground',
		},
		{
			badgeStyle: [...FILLED_BADGE_STYLES],
			tone: 'accent',
			class: 'bg-accent-loud text-accent-loud-foreground',
		},
		{
			badgeStyle: [...FILLED_BADGE_STYLES],
			tone: 'neutral',
			class: 'bg-muted-foreground text-background',
		},
		{
			badgeStyle: 'count',
			class: 'h-4 min-w-4.25 px-1 text-[10.5px] leading-4 font-semibold tracking-normal',
		},
	],
	defaultVariants: {
		tone: 'neutral',
		badgeStyle: 'outlined',
		size: 'default',
	},
});

export type BadgeTone = keyof typeof badgeVariants.variants.tone;
export type BadgeStyle = keyof typeof badgeVariants.variants.badgeStyle;
export type BadgeSize = keyof typeof badgeVariants.variants.size;

export const BADGE_TONES = Object.keys(badgeVariants.variants.tone) as BadgeTone[];
export const BADGE_STYLES = Object.keys(badgeVariants.variants.badgeStyle) as BadgeStyle[];
export const BADGE_SIZES = Object.keys(badgeVariants.variants.size) as BadgeSize[];

/**
 * Flat information badge (category, priority, counts) that never carries a shadow. Gift state over
 * an image uses `GiftStateOverlay`, whose solid badges are the elevated exception.
 */
export type BadgeProps = WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> & {
	/** Semantic color family. */
	tone?: BadgeTone;
	/**
	 * `outlined` tints the fill inside an ink border, `subtle` drops the border, `solid` fills with the
	 * tone, and `count` is the compact filled pill for a live number (`tone="primary"` for active filters).
	 */
	badgeStyle?: BadgeStyle;
	size?: BadgeSize;
	/** Leading icon kept at its intrinsic size while the label truncates. */
	icon?: Snippet;
	children?: Snippet;
};
