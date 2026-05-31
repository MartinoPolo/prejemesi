<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import overridesCss from './range-calendar-cell-overrides.css?raw';
	import { onMount } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: RangeCalendarPrimitive.CellProps = $props();

	onMount(() => {
		if (document.getElementById('range-calendar-cell-overrides')) {
			return;
		}
		const style = document.createElement('style');
		style.id = 'range-calendar-cell-overrides';
		style.textContent = overridesCss;
		document.head.appendChild(style);
	});
</script>

<RangeCalendarPrimitive.Cell
	bind:ref
	class={cn(
		'range-calendar-cell relative size-(--cell-size) p-0 text-center text-sm focus-within:z-20',
		'[&:has([data-selected])]:bg-accent/25',
		'[&:has([data-highlighted])]:bg-accent/15',
		'[&:has([data-highlighted]):hover]:bg-accent/25',
		'[&:has([data-range-start][data-highlighted])]:bg-transparent',
		'[td:has([data-highlighted])+&:has([data-range-start][data-highlighted])]:bg-accent/15',
		'[&:first-child[data-selected]_[data-bits-day]]:rounded-s-(--cell-radius) [&:last-child[data-selected]_[data-bits-day]]:rounded-e-(--cell-radius)',
		'[&:has([data-range-start]):not(:has([data-highlighted]))]:rounded-s-(--cell-radius) [&:has([data-range-end]):not(:has([data-highlighted]))]:rounded-e-(--cell-radius)',
		'[&:has([data-range-middle])]:rounded-none first:[&:has([data-range-middle])]:rounded-s-(--cell-radius) last:[&:has([data-range-middle])]:rounded-e-(--cell-radius)',
		'[&:has([data-highlighted])]:rounded-none',
		'[&:has([data-highlighted]):not(td:has([data-highlighted])+&)]:rounded-s-(--cell-radius)',
		'first:[&:has([data-highlighted])]:rounded-s-(--cell-radius) last:[&:has([data-highlighted])]:rounded-e-(--cell-radius)',
		'data-[outside-month]:!bg-transparent',
		className,
	)}
	{...restProps}
/>
