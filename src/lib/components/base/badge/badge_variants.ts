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
			/** Compact pill for a live number: the active-filter count (primary) or a tab total (neutral). */
			count: 'rounded-full border-0',
			/** Chip that sits on a photo: card face, ink border, ink text, sticker shadow. */
			overlay: `${badgeShape} border-ink shadow-sticker-sm`,
		},
		size: {
			default: 'h-5.5 px-2 text-(length:--text-xs)',
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
		/** An item total, such as a tab count: a light grey pill that sits quietly beside its label. */
		{
			badgeStyle: 'count',
			tone: 'neutral',
			class: 'bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] text-foreground',
		},
		{ badgeStyle: 'overlay', tone: 'neutral', class: 'text-ink' },
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
 * Flat information badge (category, priority, counts) without a shadow, except the `overlay` style
 * for chips on a photo. Gift state over an image uses `GiftStateOverlay`.
 */
export type BadgeProps = WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> & {
	/** Semantic color family. */
	tone?: BadgeTone;
	/**
	 * `outlined` tints the fill inside an ink border, `subtle` drops the border, `solid` fills with the
	 * tone, `count` is the compact pill for a live number (`tone="primary"` for active filters,
	 * `tone="neutral"` for tab totals),
	 * and `overlay` is the raised chip that stays legible on a photo (`tone="neutral"` for counters).
	 */
	badgeStyle?: BadgeStyle;
	size?: BadgeSize;
	/** Leading icon kept at its intrinsic size while the label truncates. */
	icon?: Snippet;
	children?: Snippet;
};
