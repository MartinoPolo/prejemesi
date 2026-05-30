<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { statusBadgeVariants, type StatusBadgeStatus } from './status-badge-variants.js';
	import type { Snippet } from 'svelte';

	interface Props {
		status?: StatusBadgeStatus;
		class?: string;
		children: Snippet;
	}

	let { status = 'info', class: className, children }: Props = $props();
</script>

<span class={cn(statusBadgeVariants({ status }), className)}>
	{@render children()}
</span>
