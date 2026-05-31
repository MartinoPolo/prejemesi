<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { tabVariants, type TabProps } from './tabs_variants.js';

	let {
		class: className,
		active = false,
		ref = $bindable(null),
		children,
		...restProps
	}: TabProps = $props();
</script>

<button
	bind:this={ref}
	data-slot="tab"
	role="tab"
	type="button"
	aria-selected={active}
	class={cn(tabVariants({ active }), className)}
	{...restProps}
>
	{@render children?.()}
</button>
