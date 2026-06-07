<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Calendar } from '$lib/components/base/calendar/index.js';
	import { cn } from '$lib/utils.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import { CalendarDate, type DateValue } from '@internationalized/date';

	interface DatePickerProps {
		/** Selected date as a plain JS `Date`, or `null` when empty. */
		value?: Date | null;
		/** Associates a `<Label for>` with the trigger button. */
		id?: string;
		/** Disables the trigger. */
		disabled?: boolean;
		/** Trigger text shown when no date is selected. */
		placeholder?: string;
		/** Extra classes for the trigger button. */
		class?: string;
	}

	let {
		value = $bindable(null),
		id,
		disabled = false,
		placeholder,
		class: className,
	}: DatePickerProps = $props();

	/** Map the active app locale to a BCP-47 tag for `Calendar` and `Intl`. */
	const localeTag = $derived(getLocale() === 'cs' ? 'cs-CZ' : 'en-US');
	const placeholderText = $derived(placeholder ?? m.date_picker_placeholder());

	/** Date-only value → calendar value, using local components (no UTC shift). */
	function toCalendarValue(date: Date | null): DateValue | undefined {
		if (date === null || Number.isNaN(date.getTime())) {
			return undefined;
		}
		return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
	}

	let open = $state(false);
	const calendarValue = $derived(toCalendarValue(value));

	const triggerLabel = $derived(
		value === null
			? placeholderText
			: new Intl.DateTimeFormat(localeTag, { dateStyle: 'long' }).format(value),
	);

	function handleValueChange(next: DateValue | undefined) {
		value = next ? new Date(next.year, next.month - 1, next.day) : null;
		if (next) {
			open = false;
		}
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger {id} {disabled}>
		{#snippet child({ props })}
			<Button
				{...props}
				intent="outline"
				class={cn(
					'w-full justify-start font-normal',
					value === null && 'text-muted-foreground',
					className,
				)}
			>
				<CalendarIcon data-icon="inline-start" />
				{triggerLabel}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0">
		<Calendar
			type="single"
			value={calendarValue}
			onValueChange={handleValueChange}
			locale={localeTag}
		/>
	</Popover.Content>
</Popover.Root>
