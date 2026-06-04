<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import CheckIcon from '@lucide/svelte/icons/check';

	let {
		ref = $bindable(null),
		class: className,
		value,
		label,
		children: childrenProp,
		indicator = 'check',
		...restProps
	}: WithoutChild<SelectPrimitive.ItemProps> & {
		/** `check`: trailing check on the selected row. `checkbox`: leading toggle box (multi-select affordance). */
		indicator?: 'check' | 'checkbox';
	} = $props();
</script>

<SelectPrimitive.Item
	bind:ref
	{value}
	data-slot="select-item"
	class={cn(
		"focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 focus:bg-accent data-highlighted:bg-accent data-highlighted:text-accent-foreground focus:text-accent-foreground relative flex w-full cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		indicator === 'checkbox' && 'pr-2 pl-2',
		className,
	)}
	{...restProps}
>
	{#snippet children({ selected, highlighted })}
		{#if indicator === 'checkbox'}
			<span
				class={cn(
					'border-input flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs [&_svg]:size-3.5',
					selected === true && 'bg-primary text-primary-foreground border-primary',
				)}
			>
				{#if selected}
					<CheckIcon />
				{/if}
			</span>
		{:else}
			<span class="absolute end-2 flex size-3.5 items-center justify-center">
				{#if selected}
					<CheckIcon class="cn-select-item-indicator-icon" />
				{/if}
			</span>
		{/if}
		{#if childrenProp}
			{@render childrenProp({ selected, highlighted })}
		{:else}
			{label != null && label !== '' ? label : value}
		{/if}
	{/snippet}
</SelectPrimitive.Item>
