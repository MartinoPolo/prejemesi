<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { setContext } from 'svelte';
	import type { ToggleGroupProps } from './toggle_group_variants.js';
	import type { ToggleIntent, ToggleSize } from '../toggle/toggle_variants.js';

	let {
		class: className,
		intent = 'default',
		size = 'md',
		children,
		ref = $bindable(null),
		...restProps
	}: ToggleGroupProps = $props();

	setContext<{ intent: ToggleIntent; size: ToggleSize }>('toggle-group', {
		get intent() {
			return intent;
		},
		get size() {
			return size;
		},
	});
</script>

<ToggleGroupPrimitive.Root
	bind:ref
	data-slot="toggle-group"
	class={cn('flex items-center gap-0.5', className)}
	{...restProps}
>
	{@render children?.()}
</ToggleGroupPrimitive.Root>
