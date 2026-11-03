<script lang="ts">
	import type { Snippet } from 'svelte';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import * as Alert from '$lib/components/base/alert/index.js';

	interface AuthSuccessBannerProps {
		children: Snippet;
	}

	let { children }: AuthSuccessBannerProps = $props();
</script>

<Alert.Root tone="success" role="status" class="mb-5">
	<CircleCheckIcon aria-hidden="true" />
	<Alert.Description>
		{@render children()}
	</Alert.Description>
</Alert.Root>
