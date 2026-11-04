<script lang="ts">
	import { getContext, type Snippet } from 'svelte';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { cn } from '$lib/utils.js';
	import {
		SEGMENTED_TOGGLE_CONTEXT,
		segmentedToggleVariants,
		type SegmentedToggleContext,
	} from './segmented_toggle_classes.js';

	type Props = Omit<ToggleGroup.ToggleGroupItemProps, 'class' | 'children'> & {
		class?: string;
		children?: Snippet;
	};

	let { class: className, surfaceClass, children, ...restProps }: Props = $props();
	const tray = getContext<(() => SegmentedToggleContext) | undefined>(SEGMENTED_TOGGLE_CONTEXT);
	const styles = $derived(segmentedToggleVariants(tray?.()));
</script>

<ToggleGroup.Item
	{...restProps}
	class={cn(styles.item(), className)}
	surfaceClass={cn(styles.surface(), surfaceClass)}
>
	{@render children?.()}
</ToggleGroup.Item>
