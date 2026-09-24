import { tv } from 'tailwind-variants';
import {
	CONTROL_ICON_SIZE_CLASSES,
	CONTROL_SIZE_CLASSES,
	RESPONSIVE_CONTROL_SIZE_CLASSES,
	type ControlSize,
} from '$lib/components/base/control_sizing.js';

/**
 * Anime-sky like control (issue #102 REQ-14 + round-2 delta): ghost ink chip
 * with the colored heart; hover tints it with the like blush and lifts it as one surface.
 * Omitted size follows the shared responsive action scale and explicit sizes stay fixed.
 * `sm` remains the compact-row exception. `ghost` is the borderless card/list chip and
 * `sticker` is the ink-bordered hard-shadow treatment used in the detail modal's action bar.
 */
export const likeButtonVariants = tv({
	slots: {
		root: 'group/like inline-flex cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
		surface:
			'elevation-surface inline-flex size-full items-center justify-center gap-1 rounded-[inherit] border-0 bg-transparent font-bold text-foreground shadow-none transition-[background-color,translate,scale] duration-(--duration-normal) ease-(--ease-standard) group-hover/like:bg-like-tint',
		icon: 'text-heart [filter:drop-shadow(0_1px_1px_var(--card))_drop-shadow(0_-1px_1px_var(--card))] transition-all duration-200',
		count: 'whitespace-nowrap tabular-nums [filter:drop-shadow(0_1px_1px_var(--card))_drop-shadow(0_-1px_1px_var(--card))]',
	},
	variants: {
		liked: {
			true: {
				icon: 'fill-heart',
			},
			false: {
				icon: 'fill-card',
			},
		},
		size: {
			responsive: {
				root: `${RESPONSIVE_CONTROL_SIZE_CLASSES} min-w-(--size-control-lg) sm:min-w-(--size-control-md)`,
				surface: `px-1 py-1 text-sm ${CONTROL_ICON_SIZE_CLASSES.lg}`,
				count: 'text-[13px]',
			},
			sm: {
				root: `${CONTROL_SIZE_CLASSES.sm} min-w-(--size-control-sm)`,
				surface: `px-1.5 py-0.5 text-[13px] ${CONTROL_ICON_SIZE_CLASSES.sm}`,
				count: 'text-[12px]',
			},
			md: {
				root: `${CONTROL_SIZE_CLASSES.md} min-w-(--size-control-md)`,
				surface: `px-1 py-1 text-sm ${CONTROL_ICON_SIZE_CLASSES.md}`,
				count: 'text-[13px]',
			},
			lg: {
				root: `${CONTROL_SIZE_CLASSES.lg} min-w-(--size-control-lg)`,
				surface: `gap-2 px-4 text-base ${CONTROL_ICON_SIZE_CLASSES.lg}`,
				count: 'text-sm',
			},
			xl: {
				root: `${CONTROL_SIZE_CLASSES.xl} min-w-(--size-control-xl)`,
				surface: `gap-2 px-4 text-base ${CONTROL_ICON_SIZE_CLASSES.xl}`,
				count: 'text-sm',
			},
		},
		appearance: {
			ghost: {},
			sticker: {
				root: 'elevation-owner elevation-owner-raised elevation-owner-like relative rounded-[7px]',
				surface: 'border-2 border-ink bg-card shadow-sticker',
			},
		},
	},
	defaultVariants: {
		liked: false,
		size: 'responsive',
		appearance: 'ghost',
	},
});

export type LikeButtonSize = ControlSize;
export type LikeButtonAppearance = keyof typeof likeButtonVariants.variants.appearance;
