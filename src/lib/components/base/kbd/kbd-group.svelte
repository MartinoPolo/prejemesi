<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLSpanElement> & { children?: Snippet } = $props();
</script>

<span
	data-slot="kbd-group"
	class={cn('inline-flex items-center gap-0.5', className)}
	{...restProps}
>
	{@render children?.()}
</span>
