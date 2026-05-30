<script lang="ts">
	import * as Alert from '$lib/components/base/alert/index.js';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		children: Snippet;
		class?: string;
	}

	let { title = 'Success', children, class: className }: Props = $props();
</script>

<Alert.Root class="border-primary/50 text-primary [&>svg]:text-primary {className ?? ''}">
	<CircleCheck size={16} />
	<Alert.Title>{title}</Alert.Title>
	<Alert.Description>
		{@render children()}
	</Alert.Description>
</Alert.Root>
