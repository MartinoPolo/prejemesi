<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import DropdownMenuPortal from './dropdown-menu-portal.svelte';

	let {
		ref = $bindable(null),
		align = 'start',
		alignOffset = -4,
		sideOffset = 2,
		sticky = 'always',
		collisionPadding = 8,
		class: className,
		...restProps
	}: DropdownMenuPrimitive.SubContentProps = $props();
</script>

<!-- Keep floating coordinates independent of the parent menu's entrance transform. -->
<DropdownMenuPortal>
	<DropdownMenuPrimitive.SubContent
		bind:ref
		{align}
		{alignOffset}
		{sideOffset}
		{sticky}
		{collisionPadding}
		data-slot="dropdown-menu-sub-content"
		class={cn(
			'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 bg-popover text-popover-foreground min-w-24 rounded-panel border-[2.5px] border-ink p-1.5 shadow-sticker duration-100 z-(--z-modal) max-h-[calc(100dvh-1rem)] w-auto overflow-x-hidden overflow-y-auto outline-none',
			className,
		)}
		{...restProps}
	/>
</DropdownMenuPortal>
