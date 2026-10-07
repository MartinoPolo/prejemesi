<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.TitleProps = $props();
</script>

<DialogPrimitive.Title
	bind:ref
	data-slot="dialog-title"
	class={cn(
		// Centered mobile titles reserve the close-button clearance on both sides.
		'font-heading text-2xl leading-tight font-semibold break-words in-data-close-button:px-(--overlay-close-clearance-inside-dialog-padding) sm:in-data-close-button:ps-0',
		className,
	)}
	{...restProps}
/>
