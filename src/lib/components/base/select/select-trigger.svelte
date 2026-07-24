<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	type SelectState = 'default' | 'error';

	let {
		ref = $bindable(null),
		class: className,
		children,
		size = 'md',
		state = 'default' as SelectState,
		...restProps
	}: WithoutChild<SelectPrimitive.TriggerProps> & {
		size?: 'sm' | 'md' | 'lg';
		state?: SelectState;
	} = $props();
</script>

<SelectPrimitive.Trigger
	bind:ref
	data-slot="select-trigger"
	data-size={size}
	data-state={state}
	class={cn(
		"border-ink data-placeholder:text-muted-foreground bg-card focus-visible:border-ring focus-visible:ring-ring/25 aria-invalid:ring-invalid-ring aria-invalid:border-invalid-border gap-1.5 rounded-btn border-[2.5px] pr-2 pl-2.5 font-semibold transition-[color,box-shadow,border-color] focus-visible:ring-3 aria-invalid:ring-3 data-[size=sm]:h-(--size-control-sm) data-[size=sm]:text-(length:--text-sm) data-[size=md]:h-(--size-control-md) data-[size=md]:text-(length:--text-md) data-[size=lg]:h-(--size-control-lg) data-[size=lg]:text-(length:--text-base) *:data-[slot=select-value]:flex *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-4 flex w-fit min-w-0 max-w-full items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
		state === 'error' &&
			'border-status-danger shadow-[0_0_0_3px_color-mix(in_oklab,var(--status-danger)_18%,transparent)]',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
	<ChevronDownIcon class="text-muted-foreground size-4 pointer-events-none" />
</SelectPrimitive.Trigger>
