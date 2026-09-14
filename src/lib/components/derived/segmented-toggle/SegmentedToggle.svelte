<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { cn } from '$lib/utils.js';
	import { segmentedToggleVariants } from './segmented_toggle_classes.js';
	import {
		CONTROL_SIZE_CLASSES,
		RESPONSIVE_CONTROL_SIZE_CLASSES,
		type ControlSize,
	} from '$lib/components/base/control_sizing.js';

	type Props = Omit<
		ToggleGroup.ToggleGroupProps,
		'type' | 'value' | 'onValueChange' | 'class' | 'children'
	> & {
		value: string;
		class?: string;
		children?: Snippet;
		onValueChange?: (value: string) => void;
		onReselect?: (value: string) => void;
	};

	let {
		value = $bindable(),
		class: className,
		children,
		onValueChange,
		onReselect,
		size,
		...restProps
	}: Props = $props();

	const styles = segmentedToggleVariants();
	let selected = $derived(value);

	function handleValueChange(nextValue: string) {
		if (nextValue === '') {
			selected = value;
			onReselect?.(value);
			return;
		}

		value = nextValue;
		onValueChange?.(nextValue);
	}
</script>

<ToggleGroup.Root
	{...restProps}
	{size}
	type="single"
	bind:value={selected}
	onValueChange={handleValueChange}
	class={cn(
		styles.root(),
		size ? CONTROL_SIZE_CLASSES[size as ControlSize] : RESPONSIVE_CONTROL_SIZE_CLASSES,
		className,
	)}
>
	{@render children?.()}
</ToggleGroup.Root>
