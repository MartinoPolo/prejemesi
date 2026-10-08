<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import { cn } from '$lib/utils.js';
	import {
		segmentedToggleVariants,
		type SegmentedTogglePresentation,
	} from './segmented_toggle_classes.js';
	import {
		CONTROL_SIZE_CLASSES,
		RESPONSIVE_CONTROL_SIZE_CLASSES,
		type ControlSize,
	} from '$lib/components/base/control_sizing.js';
	import { selectionSlide } from '$lib/motion/selection_slide.js';

	type Props = Omit<
		ToggleGroup.ToggleGroupProps,
		'type' | 'value' | 'onValueChange' | 'class' | 'children'
	> & {
		value: string;
		class?: string;
		children?: Snippet;
		onValueChange?: (value: string) => void;
		onReselect?: (value: string) => void;
		presentation?: SegmentedTogglePresentation;
	};

	let {
		value = $bindable(),
		class: className,
		children,
		onValueChange,
		onReselect,
		presentation = 'default',
		size,
		...restProps
	}: Props = $props();

	const styles = $derived(segmentedToggleVariants({ presentation }));
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
	{@attach selectionSlide({
		optionSelector: "[data-slot='toggle-group-item']",
		selectedSelector: "[data-state='on']",
		faceSelector: presentation === 'connected' ? ':scope > .elevation-surface' : undefined,
	})}
>
	{@render children?.()}
	<span data-slot="selection-indicator" aria-hidden="true" class={styles.indicator()}></span>
</ToggleGroup.Root>

<style>
	:global(.segmented-toggle-connected > [data-slot='toggle-group-item']) {
		z-index: 1;
		border-radius: var(--radius-btn);
		background: transparent !important;
		outline: none;
		translate: 0 !important;
		scale: 1 !important;
	}

	:global(.segmented-toggle-connected > [data-slot='toggle-group-item'] > .elevation-surface) {
		box-shadow: none !important;
		transition: none;
		translate: 0 !important;
		scale: 1 !important;
	}

	:global(
		.segmented-toggle-connected
			> [data-slot='toggle-group-item']:not([data-state='on'])
			> .elevation-surface
	) {
		background: transparent !important;
		color: var(--muted-foreground) !important;
	}

	:global(.segmented-toggle-connected > [data-slot='toggle-group-item']:focus-visible) {
		outline: 2px solid var(--ring) !important;
		outline-offset: 2px !important;
	}

	/* Once the sliding indicator is placed, it paints the selected face instead. */
	:global(
		.segmented-toggle-connected:not([data-selection-placed])
			> [data-slot='toggle-group-item'][data-state='on']
			> .elevation-surface
	) {
		border: var(--border-w) solid var(--ink) !important;
		background: var(--card) !important;
	}

	@media (width < 640px) {
		:global(
			.segmented-toggle-connected
				> [data-slot='toggle-group-item'][data-state='on']
				> .elevation-surface
		) {
			position: absolute;
			inset: -1px;
			width: auto;
			height: auto;
		}
	}

	/* `-of-type` skips the trailing selection indicator span. */
	@media (width >= 640px) {
		:global(.segmented-toggle-connected:has(> :first-of-type[data-state='on']))::before {
			inset-inline-start: 1px;
		}

		:global(.segmented-toggle-connected:has(> :last-of-type[data-state='on']))::before {
			inset-inline-end: 1px;
		}
	}
</style>
