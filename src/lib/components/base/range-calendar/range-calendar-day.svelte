<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: RangeCalendarPrimitive.DayProps = $props();
</script>

<RangeCalendarPrimitive.Day
	bind:ref
	class={cn(
		'flex size-(--cell-size) flex-col items-center justify-center gap-1 rounded-(--cell-radius) p-0 leading-none font-normal whitespace-nowrap select-none cursor-pointer',
		'[&:not([data-selected]):not([data-highlighted])]:hover:bg-accent/15',
		// Today (not selected) — light accent tint ensures contrast on all accent colors
		'[&[data-today]:not([data-selected])]:bg-accent/25 [&[data-today]:not([data-selected])]:hover:bg-accent/50',
		'[&[data-today][data-disabled]]:text-muted-foreground',
		'data-[range-middle]:rounded-none',
		// Range start
		'data-[range-start]:bg-primary data-[range-start]:text-primary-foreground data-[range-start]:hover:bg-primary/80',
		// Range end
		'data-[range-end]:bg-primary data-[range-end]:text-primary-foreground data-[range-end]:hover:bg-primary/80',
		// Range middle — hover adds subtle accent overlay
		'data-[range-middle]:hover:bg-accent/15',
		// Outside months — hidden so they don't duplicate across adjacent month grids
		'data-[outside-month]:invisible data-[outside-month]:pointer-events-none',
		// Disabled
		'data-[disabled]:text-muted-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		// Unavailable
		'data-[unavailable]:line-through',
		// focus
		'focus:border-ring focus:ring-ring/50 focus:relative',
		// inner spans
		'[&>span]:text-xs [&>span]:opacity-70',
		className,
	)}
	{...restProps}
/>
