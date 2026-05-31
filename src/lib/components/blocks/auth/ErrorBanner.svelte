<script lang="ts">
	import * as Alert from '$lib/components/base/alert/index.js';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	interface ErrorBannerProps {
		message: string;
	}

	let { message }: ErrorBannerProps = $props();
</script>

{#if message}
	<Alert.Root tone="destructive" class="mb-5">
		<CircleAlert />
		<Alert.Description>{message}</Alert.Description>
	</Alert.Root>
{/if}
