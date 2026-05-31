import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const toastVariants = tv({
	base: 'flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-md',
	variants: {
		tone: {
			info: 'border-l-2 border-l-status-info',
			success: 'border-l-2 border-l-status-success',
			warning: 'border-l-2 border-l-status-warning',
			danger: 'border-l-2 border-l-status-danger',
			loading: 'border-l-2 border-l-primary',
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
