<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { setToggleGroupContext } from './toggle_group.context.svelte.js';
	import type { ToggleGroupProps } from './toggle_group_types.js';

	let {
		class: className,
		intent = 'default',
		size = 'md',
		children,
		ref = $bindable(null),
		...restProps
	}: ToggleGroupProps = $props();

	setToggleGroupContext(
		() => intent,
		() => size,
	);
</script>

<ToggleGroupPrimitive.Root
	bind:ref
	data-slot="toggle-group"
	class={cn('flex items-center gap-0.5', className)}
	{...restProps}
>
	{@render children?.()}
</ToggleGroupPrimitive.Root>
