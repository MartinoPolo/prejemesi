<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { cn } from '$lib/utils.js';

	interface Props {
		children: Snippet;
		class?: string;
	}

	let { children, class: className }: Props = $props();
</script>

<!-- A one-line title still leaves the header as tall as the close button and its inset, so the
     button never hangs below the divider. -->
<Sheet.Header
	class={cn(
		'border-border min-h-[calc(2*var(--overlay-close-inset)+var(--size-control-lg))] shrink-0 justify-center border-b px-4 py-3 pe-(--overlay-close-clearance)',
		className,
	)}
>
	{@render children()}
</Sheet.Header>
