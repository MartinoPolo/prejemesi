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
		'h-2.5 w-full cursor-pointer appearance-none rounded-full border-2 border-ink bg-background outline-none select-none disabled:cursor-not-allowed disabled:opacity-50',
		'[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow-[2px_2px_0_var(--hard-shadow)]',
		'[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-card',
		'focus-visible:ring-2 focus-visible:ring-ring/50',
		className,
	)}
	{...restProps}
/>
