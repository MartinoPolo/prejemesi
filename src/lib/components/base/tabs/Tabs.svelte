<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { selectionSlide } from '$lib/motion/selection_slide.js';
	import {
		TAB_INDICATOR_CLASSES,
		tabsContainerVariants,
		type TabsContainerProps,
	} from './tabs_variants.js';

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
	{@attach selectionSlide({
		optionSelector: "[role='tab']",
		selectedSelector: "[aria-selected='true']",
	})}
>
	{@render children?.()}
	<span data-slot="selection-indicator" aria-hidden="true" class={TAB_INDICATOR_CLASSES}></span>
</div>
