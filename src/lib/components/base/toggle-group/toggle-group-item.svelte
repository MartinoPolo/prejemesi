<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { getContext } from 'svelte';
	import { Button } from '../button/index.js';
	import {
		togglePressedVariants,
		TOGGLE_INTENT_TO_BUTTON_INTENT,
		type ToggleIntent,
		type ToggleSize,
	} from '../toggle/toggle_variants.js';
	import type { ToggleGroupItemProps } from './toggle_group_variants.js';

	let {
		class: className,
		intent,
		size,
		children,
		ref = $bindable(null),
		...restProps
	}: ToggleGroupItemProps = $props();

	const groupContext = getContext<{ intent: ToggleIntent; size: ToggleSize }>('toggle-group');

	const resolvedIntent = $derived(intent ?? groupContext.intent);
	const resolvedSize = $derived(size ?? groupContext.size);
</script>

<ToggleGroupPrimitive.Item bind:ref {...restProps}>
	{#snippet child({ props })}
		<Button
			{...props}
			intent={TOGGLE_INTENT_TO_BUTTON_INTENT[resolvedIntent]}
			size={resolvedSize}
			class={cn(togglePressedVariants({ intent: resolvedIntent }), className)}
			data-slot="toggle-group-item"
		>
			{@render children?.()}
		</Button>
	{/snippet}
</ToggleGroupPrimitive.Item>
