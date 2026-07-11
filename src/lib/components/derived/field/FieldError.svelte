<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { fieldErrorVariants, type FieldErrorProps } from './field_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: FieldErrorProps = $props();
</script>

<p
	bind:this={ref}
	data-slot="field-error"
	class={cn(fieldErrorVariants(), className)}
	{...restProps}
>
	{@render children?.()}
</p>
