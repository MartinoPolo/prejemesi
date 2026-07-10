<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import type { RadioGroupItemProps } from './radio_group_types.js';

	let {
		ref = $bindable(null),
		value,
		class: className,
		...restProps
	}: RadioGroupItemProps = $props();
</script>

<RadioGroupPrimitive.Item
	bind:ref
	{value}
	data-slot="radio-group-item"
	class={cn(
		'relative size-4 shrink-0 cursor-pointer rounded-full border-2 border-ink bg-card outline-none transition-[border-color] after:absolute after:inset-0.75 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity hover:border-ring focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:after:opacity-100',
		className,
	)}
	{...restProps}
/>
