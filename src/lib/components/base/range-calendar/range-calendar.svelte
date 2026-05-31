<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from 'bits-ui';
	import RangeCalendarCaption from './range-calendar-caption.svelte';
	import RangeCalendarCell from './range-calendar-cell.svelte';
	import RangeCalendarDay from './range-calendar-day.svelte';
	import RangeCalendarGrid from './range-calendar-grid.svelte';
	import RangeCalendarGridBody from './range-calendar-grid-body.svelte';
	import RangeCalendarGridHead from './range-calendar-grid-head.svelte';
	import RangeCalendarGridRow from './range-calendar-grid-row.svelte';
	import RangeCalendarHeadCell from './range-calendar-head-cell.svelte';
	import RangeCalendarHeader from './range-calendar-header.svelte';
	import RangeCalendarMonth from './range-calendar-month.svelte';
	import RangeCalendarMonths from './range-calendar-months.svelte';
	import RangeCalendarNav from './range-calendar-nav.svelte';
	import RangeCalendarNextButton from './range-calendar-next-button.svelte';
	import RangeCalendarPrevButton from './range-calendar-prev-button.svelte';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import type { ButtonIntent } from '$lib/components/base/button/index.js';
	import type { Snippet } from 'svelte';
	import { isEqualMonth, type DateValue } from '@internationalized/date';

	let {
		ref = $bindable(null),
		value = $bindable(),
		placeholder = $bindable(),
		// fallow-ignore-next-line code-duplication
		weekdayFormat = 'short',
		class: className,
		buttonIntent = 'ghost',
		captionLayout = 'label',
		locale = 'en-US',
		months: monthsProp,
		years,
		monthFormat: monthFormatProp,
		yearFormat = 'numeric',
		day,
		disableDaysOutsideMonth = false,
		...restProps
	}: WithoutChildrenOrChild<RangeCalendarPrimitive.RootProps> & {
		buttonIntent?: ButtonIntent;
		captionLayout?: 'dropdown' | 'dropdown-months' | 'dropdown-years' | 'label';
		months?: RangeCalendarPrimitive.MonthSelectProps['months'];
		years?: RangeCalendarPrimitive.YearSelectProps['years'];
		monthFormat?: RangeCalendarPrimitive.MonthSelectProps['monthFormat'];
		yearFormat?: RangeCalendarPrimitive.YearSelectProps['yearFormat'];
		day?: Snippet<[{ day: DateValue; outsideMonth: boolean }]>;
	} = $props();

	const monthFormat = $derived.by(() => {
		if (monthFormatProp != null) {
			return monthFormatProp;
		}
		if (captionLayout.startsWith('dropdown')) {
			return 'short';
		}
		return 'long';
	});
</script>

<RangeCalendarPrimitive.Root
	bind:ref
	bind:value
	bind:placeholder
	{weekdayFormat}
	{disableDaysOutsideMonth}
	class={cn(
		'w-fit p-3 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(8)] bg-background group/calendar [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent',
		className,
	)}
	{locale}
	{monthFormat}
	{yearFormat}
	{...restProps}
>
	{#snippet children({ months, weekdays })}
		<RangeCalendarMonths>
			<RangeCalendarNav>
				<RangeCalendarPrevButton intent={buttonIntent} />
				<RangeCalendarNextButton intent={buttonIntent} />
			</RangeCalendarNav>
			{#each months as month, monthIndex (month)}
				<RangeCalendarMonth>
					<RangeCalendarHeader>
						<RangeCalendarCaption
							{captionLayout}
							months={monthsProp}
							{monthFormat}
							{years}
							{yearFormat}
							month={month.value}
							bind:placeholder
							{locale}
							{monthIndex}
						/>
					</RangeCalendarHeader>

					<RangeCalendarGrid>
						<RangeCalendarGridHead>
							<RangeCalendarGridRow class="select-none">
								{#each weekdays as weekday, i (i)}
									<RangeCalendarHeadCell>
										{weekday.slice(0, 2)}
									</RangeCalendarHeadCell>
								{/each}
							</RangeCalendarGridRow>
						</RangeCalendarGridHead>
						<RangeCalendarGridBody>
							{#each month.weeks as weekDates (weekDates)}
								<RangeCalendarGridRow class="mt-2 w-full">
									{#each weekDates as date (date)}
										<RangeCalendarCell {date} month={month.value}>
											{#if day}
												{@render day({
													day: date,
													outsideMonth: !isEqualMonth(date, month.value),
												})}
											{:else}
												<RangeCalendarDay />
											{/if}
										</RangeCalendarCell>
									{/each}
								</RangeCalendarGridRow>
							{/each}
						</RangeCalendarGridBody>
					</RangeCalendarGrid>
				</RangeCalendarMonth>
			{/each}
		</RangeCalendarMonths>
	{/snippet}
</RangeCalendarPrimitive.Root>
