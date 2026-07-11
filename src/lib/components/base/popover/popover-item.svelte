<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { PopoverItemProps } from './popover_types.js';

	let {
		ref = $bindable<HTMLDivElement | null>(null),
		class: className,
		active = false,
		children,
		...restProps
	}: PopoverItemProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="popover-item"
	data-state={active ? 'active' : undefined}
	role="menuitem"
	tabindex={0}
	class={cn(
		'flex min-h-7 w-full cursor-pointer select-none items-center gap-2 rounded-btn px-2 py-1 text-(length:--text-sm) font-medium text-foreground outline-none',
		'hover:bg-accent focus-visible:bg-accent',
		'data-[state=active]:text-primary',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>
