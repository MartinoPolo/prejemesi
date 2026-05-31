<script lang="ts">
	import Toast from './Toast.svelte';
	import type { ToastTone } from './toast_variants.js';

	interface Props {
		tone?: ToastTone;
		title: string;
		body?: string;
		dismissible?: boolean;
		closeToast?: () => void;
	}

	let { tone = 'info', title, body, dismissible = true, closeToast }: Props = $props();
</script>

<Toast {tone} {title} {body} onDismiss={dismissible && closeToast ? closeToast : undefined} />
