<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'value' | 'type' | 'class'> {
		/** Current single value. */
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		/** Fired with the new numeric value on every input change. */
		onValueChange?: (value: number) => void;
		class?: string;
	}

	let {
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		onValueChange,
		class: className,
		...restProps
	}: Props = $props();

	function handleInput(event: Event) {
		const next = Number((event.currentTarget as HTMLInputElement).value);
		value = next;
		onValueChange?.(next);
	}
</script>

<!--
Single-value range slider built on the native `<input type="range">` for first-class
accessibility (keyboard, screen-reader value reporting) with token-themed track + thumb.
Controlled via `value` + `onValueChange`.
-->
<input
	type="range"
	{min}
	{max}
	{step}
	{disabled}
	{value}
	oninput={handleInput}
	class={cn(
		'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted outline-none select-none disabled:cursor-not-allowed disabled:opacity-50',
		'[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm',
		'[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background',
		'focus-visible:ring-2 focus-visible:ring-ring/50',
		className,
	)}
	{...restProps}
/>
