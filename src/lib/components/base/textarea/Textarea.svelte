<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { textareaVariants, type TextareaProps } from './textarea_variants.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		state = 'default',
		class: className,
		'data-slot': dataSlot = 'textarea',
		...restProps
	}: TextareaProps = $props();
</script>

<textarea
	bind:this={ref}
	data-slot={dataSlot}
	data-state={state}
	aria-invalid={state === 'error' ? true : undefined}
	class={cn(textareaVariants({ state }), 'field-sizing-content min-h-16', className)}
	bind:value
	{...restProps}
></textarea>
