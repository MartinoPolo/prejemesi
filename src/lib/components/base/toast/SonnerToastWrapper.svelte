<script lang="ts">
	import Toast from './Toast.svelte';
	import type { ToastTone } from './toast_variants.js';
	import { Button } from '$lib/components/base/button/index.js';

	interface Props {
		tone?: ToastTone;
		title: string;
		body?: string;
		dismissible?: boolean;
		closeToast?: () => void;
		actionLabel?: string;
		onAction?: () => void;
	}

	let {
		tone = 'info',
		title,
		body,
		dismissible = true,
		closeToast,
		actionLabel,
		onAction,
	}: Props = $props();
</script>

{#snippet toastAction()}
	<Button
		intent="outline"
		size="sm"
		onclick={() => {
			onAction?.();
			closeToast?.();
		}}>{actionLabel}</Button
	>
{/snippet}

<Toast
	{tone}
	{title}
	{body}
	action={actionLabel !== undefined && onAction !== undefined ? toastAction : undefined}
	onDismiss={dismissible && closeToast ? closeToast : undefined}
/>
