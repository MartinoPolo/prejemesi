import { toast } from 'svelte-sonner';
import type { ToastTone } from './toast_variants.js';
import SonnerToastWrapper from './SonnerToastWrapper.svelte';

export interface ShowToastOptions {
	tone?: ToastTone;
	title: string;
	body?: string;
	duration?: number;
	dismissible?: boolean;
	actionLabel?: string;
	onAction?: () => void;
}

export function showToast(options: ShowToastOptions): string | number {
	const {
		tone = 'info',
		title,
		body,
		duration,
		dismissible = true,
		actionLabel,
		onAction,
	} = options;

	return toast.custom(SonnerToastWrapper, {
		duration,
		componentProps: {
			tone,
			title,
			body,
			dismissible,
			actionLabel,
			onAction,
		},
	});
}

export const toastSuccess = (title: string, body?: string): string | number =>
	showToast({ tone: 'success', title, body });

export const toastError = (title: string, body?: string): string | number =>
	showToast({ tone: 'danger', title, body });

export const toastWarning = (title: string, body?: string): string | number =>
	showToast({ tone: 'warning', title, body });

export const toastInfo = (title: string, body?: string): string | number =>
	showToast({ tone: 'info', title, body });

export const toastLoading = (title: string, body?: string): string | number =>
	showToast({ tone: 'loading', title, body });
