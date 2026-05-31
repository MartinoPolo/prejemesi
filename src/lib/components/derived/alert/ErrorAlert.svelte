<script lang="ts">
	import * as Alert from '$lib/components/base/alert/index.js';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		children: Snippet;
		class?: string;
	}

	let { title = 'Error', children, class: className }: Props = $props();
</script>

<Alert.Root tone="destructive" class={className}>
	<TriangleAlert size={16} />
	<Alert.Title>{title}</Alert.Title>
	<Alert.Description>
		{@render children()}
	</Alert.Description>
</Alert.Root>
