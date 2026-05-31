<script lang="ts">
	import { Toggle as TogglePrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { Button } from '../button/index.js';
	import {
		togglePressedVariants,
		TOGGLE_INTENT_TO_BUTTON_INTENT,
		type ToggleProps,
	} from './toggle_variants.js';

	let {
		class: className,
		intent = 'default',
		size = 'md',
		ref = $bindable(null),
		children,
		...restProps
	}: ToggleProps = $props();
</script>

<TogglePrimitive.Root bind:ref {...restProps}>
	{#snippet child({ props })}
		<Button
			{...props}
			intent={TOGGLE_INTENT_TO_BUTTON_INTENT[intent]}
			{size}
			class={cn(togglePressedVariants({ intent }), className)}
			data-slot="toggle"
		>
			{@render children?.()}
		</Button>
	{/snippet}
</TogglePrimitive.Root>
