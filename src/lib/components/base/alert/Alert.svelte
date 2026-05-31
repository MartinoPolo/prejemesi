<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { alertVariants, type AlertProps } from './alert_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		tone = 'default',
		children,
		...restProps
	}: AlertProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert"
	role="alert"
	class={cn(alertVariants({ tone }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
