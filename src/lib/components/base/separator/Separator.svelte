<script lang="ts">
	import { Separator as SeparatorPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		'data-slot': dataSlot = 'separator',
		...restProps
	}: SeparatorPrimitive.RootProps = $props();
</script>

<SeparatorPrimitive.Root
	bind:ref
	data-slot={dataSlot}
	class={cn(
		'border-dashed border-ink-faint shrink-0 data-[orientation=horizontal]:h-0 data-[orientation=horizontal]:w-full data-[orientation=horizontal]:border-t-2 data-[orientation=vertical]:w-0 data-[orientation=vertical]:border-l-2',
		// this is different in shadcn/ui but self-stretch breaks things for us
		'data-[orientation=vertical]:h-full',
		className,
	)}
	{...restProps}
/>
