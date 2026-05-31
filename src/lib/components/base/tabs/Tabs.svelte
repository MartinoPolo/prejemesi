<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { tabsContainerVariants, type TabsContainerProps } from './tabs_variants.js';

	let {
		class: className,
		ref = $bindable(null),
		children,
		...restProps
	}: TabsContainerProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="tabs"
	role="tablist"
	class={cn(tabsContainerVariants(), className)}
	{...restProps}
>
	{@render children?.()}
</div>
