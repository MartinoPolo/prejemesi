<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import type { RadioGroupProps } from './radio_group_variants.js';

	let {
		ref = $bindable(null),
		value = $bindable(''),
		class: className,
		children,
		...restProps
	}: RadioGroupProps = $props();
</script>

<RadioGroupPrimitive.Root
	bind:ref
	bind:value
	data-slot="radio-group"
	class={cn('flex flex-col gap-3', className)}
	{...restProps}
>
	{@render children?.()}
</RadioGroupPrimitive.Root>
