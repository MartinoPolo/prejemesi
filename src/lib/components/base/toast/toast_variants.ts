import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const toastVariants = tv({
	base: 'flex items-center gap-3 rounded-[12px] border-[2.5px] border-ink bg-card p-3 shadow-sticker',
	variants: {
		tone: {
			info: 'border-l-[6px] border-l-status-info',
			success: 'border-l-[6px] border-l-status-success',
			warning: 'border-l-[6px] border-l-status-warning',
			danger: 'border-l-[6px] border-l-status-danger',
			loading: 'border-l-[6px] border-l-primary',
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
