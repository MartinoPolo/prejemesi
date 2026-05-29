<script lang="ts">
	import * as Alert from '$lib/components/ui/alert/index.js';
	import Info from '@lucide/svelte/icons/info';
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		children: Snippet;
		class?: string;
	}

	let { title = 'Information', children, class: className }: Props = $props();
</script>

<Alert.Root class={className}>
	<Info size={16} />
	<Alert.Title>{title}</Alert.Title>
	<Alert.Description>
		{@render children()}
	</Alert.Description>
</Alert.Root>
