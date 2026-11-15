<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from 'bits-ui';
	import { cn, type WithoutChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithoutChild<CollapsiblePrimitive.ContentProps> = $props();
</script>

<CollapsiblePrimitive.Content
	bind:ref
	data-slot="collapsible-content"
	class={cn(
		'data-open:animate-collapsible-down data-closed:animate-collapsible-up overflow-hidden',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</CollapsiblePrimitive.Content>
