<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();
</script>

<div class="mb-4 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
	<p class="mb-1 font-medium text-foreground">Keyboard shortcuts</p>
	<ul class="flex flex-col gap-0.5">
		{@render children()}
	</ul>
</div>
