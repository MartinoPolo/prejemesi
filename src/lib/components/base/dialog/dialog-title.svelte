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
		// The close button sits 1rem from the edge inside 1.5rem padding, so a clearance of its
		// size leaves a 0.5rem gap; centered mobile titles reserve it on both sides.
		'font-heading text-2xl leading-tight font-semibold break-words in-data-close-button:px-(--size-control-lg) sm:in-data-close-button:ps-0',
		className,
	)}
	{...restProps}
/>
