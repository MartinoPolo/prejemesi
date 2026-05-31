<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable<HTMLHRElement | null>(null),
		class: className,
		...restProps
	}: { ref?: HTMLHRElement | null; class?: string } & HTMLAttributes<HTMLHRElement> = $props();
</script>

<hr
	bind:this={ref}
	data-slot="popover-divider"
	class={cn('my-1 border-t border-border', className)}
	{...restProps}
/>
