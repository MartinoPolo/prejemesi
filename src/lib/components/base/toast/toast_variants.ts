import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const toastVariants = tv({
	base: 'flex items-center gap-3 rounded-[12px] border-[2.5px] p-3 shadow-sticker',
	variants: {
		// Colorful per-tone treatment: full status-colored border (card_variants precedent)
		// + tinted surface reusing the badge color-mix pattern (oklab — never oklch,
		// see color-mix hue-collapse memory) so the tone reads across both themes.
		tone: {
			info: 'border-status-info bg-[color-mix(in_oklab,var(--status-info)_22%,var(--card))]',
			success:
				'border-status-success bg-[color-mix(in_oklab,var(--status-success)_22%,var(--card))]',
			warning:
				'border-status-warning bg-[color-mix(in_oklab,var(--status-warning)_22%,var(--card))]',
			danger: 'border-status-danger bg-[color-mix(in_oklab,var(--status-danger)_22%,var(--card))]',
			loading: 'border-primary bg-[color-mix(in_oklab,var(--primary)_22%,var(--card))]',
		},
	},
	defaultVariants: {
		tone: 'info',
	},
});

export type ToastTone = keyof typeof toastVariants.variants.tone;

export const TOAST_TONES = Object.keys(toastVariants.variants.tone) as ToastTone[];

export const toastIconColors = {
	info: 'text-status-info',
	success: 'text-status-success',
	warning: 'text-status-warning',
	danger: 'text-status-danger',
	loading: 'text-primary',
} as const satisfies Record<ToastTone, string>;

/**
 * Per-tone title accent — status color pulled toward foreground (oklab mix) so it
 * stays readable on the tinted surface in both light and dark themes.
 */
export const toastTitleColors = {
	info: 'text-[color-mix(in_oklab,var(--status-info)_60%,var(--foreground))]',
	success: 'text-[color-mix(in_oklab,var(--status-success)_60%,var(--foreground))]',
	warning: 'text-[color-mix(in_oklab,var(--status-warning)_60%,var(--foreground))]',
	danger: 'text-[color-mix(in_oklab,var(--status-danger)_60%,var(--foreground))]',
	loading: 'text-[color-mix(in_oklab,var(--primary)_60%,var(--foreground))]',
} as const satisfies Record<ToastTone, string>;

export type ToastProps = {
	ref?: HTMLDivElement | null;
	class?: string;
	tone?: ToastTone;
	title: string;
	body?: string;
	icon?: Snippet;
	action?: Snippet;
	onDismiss?: () => void;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title'>;
