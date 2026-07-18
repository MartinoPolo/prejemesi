<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { InputSize } from '$lib/components/base/input/index.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		size = 'md',
		children,
		...props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { size?: InputSize } = $props();
</script>

<div
	bind:this={ref}
	data-slot="input-group"
	data-size={size}
	role="group"
	class={cn(
		'group/input-group border-ink bg-card has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:ring-invalid-ring has-[[data-slot][aria-invalid=true]]:border-destructive data-[size=md]:h-(--size-control-md) data-[size=lg]:h-(--size-control-lg) rounded-btn border-[2.5px] transition-[color,box-shadow] in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-3 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5 relative flex w-full min-w-0 items-center outline-none has-[>textarea]:h-auto',
		className,
	)}
	{...props}
>
	{@render children?.()}
</div>
