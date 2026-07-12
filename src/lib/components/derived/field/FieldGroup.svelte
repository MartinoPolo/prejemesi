<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { fieldGroupVariants, type FieldGroupProps } from './field_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: FieldGroupProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="field-group"
	class={cn(fieldGroupVariants(), className)}
	{...restProps}
>
	{@render children?.()}
</div>
