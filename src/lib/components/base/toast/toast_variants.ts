import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const toastVariants = tv({
	base: 'flex items-center gap-3 rounded-[12px] border-[2.5px] border-ink p-3 shadow-sticker',
	variants: {
		// Tinted backgrounds reuse the badge color-mix pattern (oklab — never oklch,
		// see color-mix hue-collapse memory) so the tone reads across all palettes.
		tone: {
			info: 'border-l-[6px] border-l-status-info bg-[color-mix(in_oklab,var(--status-info)_14%,var(--card))]',
			success:
				'border-l-[6px] border-l-status-success bg-[color-mix(in_oklab,var(--status-success)_14%,var(--card))]',
			warning:
				'border-l-[6px] border-l-status-warning bg-[color-mix(in_oklab,var(--status-warning)_14%,var(--card))]',
			danger: 'border-l-[6px] border-l-status-danger bg-[color-mix(in_oklab,var(--status-danger)_14%,var(--card))]',
			loading:
				'border-l-[6px] border-l-primary bg-[color-mix(in_oklab,var(--primary)_14%,var(--card))]',
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
