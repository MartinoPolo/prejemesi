<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import { Calendar } from './index.js';
	import { CalendarDate, today, getLocalTimeZone } from '@internationalized/date';
	import type { DateValue } from '@internationalized/date';

	const tz = getLocalTimeZone();
	const todayDate = today(tz);

	const { Story } = defineMeta({
		title: 'Base/Calendar',
		component: Calendar,
		tags: ['autodocs'],
	});

	/** Click a date cell → verify aria-selected flips to "true" */
	const playClickDateSelection = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);

		// Find day buttons that are not outside-month and not disabled
		const dayButtons = canvas
			.getAllByRole('button')
			.filter(
				(button) =>
					button.hasAttribute('data-calendar-day') &&
					!button.hasAttribute('data-outside-month') &&
					!button.hasAttribute('data-disabled'),
			);

		const targetDay = dayButtons[10]; // pick a mid-month day
		const targetCell = targetDay.closest('[role="gridcell"]')!;

		// Initially not selected
		await expect(targetCell).toHaveAttribute('aria-selected', 'false');

		await userEvent.click(targetDay);

		// After click — selected
		await expect(targetCell).toHaveAttribute('aria-selected', 'true');
	};

	/**
	 * Get the visible calendar heading element.
	 * The Calendar uses a custom CalendarCaption (not bits-ui Heading primitive),
	 * so we find it via the [data-calendar-header] container which holds the month/year text.
	 */
	function getCalendarHeading(canvasElement: HTMLElement): HTMLElement {
		// CalendarHeader renders [data-calendar-header] — the caption text is inside it
		const header = canvasElement.querySelector('[data-calendar-header]');
		if (header) {
			return header as HTMLElement;
		}
		// Fallback: bits-ui Heading primitive (if used instead of CalendarCaption)
		const heading = canvasElement.querySelector('[data-calendar-heading]');
		if (heading) {
			return heading as HTMLElement;
		}
		throw new Error('Calendar heading not found');
	}

	/** Read current heading text (re-queries DOM each time to handle re-renders). */
	function readHeadingText(canvasElement: HTMLElement): string {
		return getCalendarHeading(canvasElement).textContent?.trim() ?? '';
	}

	/** Click next-month button → heading text changes to next month */
	const playNextMonth = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const initialText = readHeadingText(canvasElement);

		const nextButton = canvasElement.querySelector(
			'[data-calendar-next-button]',
		) as HTMLElement;
		await expect(nextButton).not.toBeNull();
		await userEvent.click(nextButton);

		await waitFor(() => expect(readHeadingText(canvasElement)).not.toBe(initialText));
	};

	/** Click prev-month button → heading text changes to previous month */
	const playPrevMonth = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const initialText = readHeadingText(canvasElement);

		const prevButton = canvasElement.querySelector(
			'[data-calendar-prev-button]',
		) as HTMLElement;
		await expect(prevButton).not.toBeNull();
		await userEvent.click(prevButton);

		await waitFor(() => expect(readHeadingText(canvasElement)).not.toBe(initialText));
	};

	/** Verify preselected date has aria-selected="true" on its cell */
	const playPreselectedAriaSelected = async ({
		canvasElement,
	}: {
		canvasElement: HTMLElement;
	}) => {
		const canvas = within(canvasElement);

		// Find the cell that is already selected
		const selectedCells = canvas
			.getAllByRole('gridcell')
			.filter((cell) => cell.getAttribute('aria-selected') === 'true');

		await expect(selectedCells.length).toBe(1);

		// The selected day button should show "15" (May 15)
		const dayButton = selectedCells[0].querySelector('[data-calendar-day]');
		await expect(dayButton).not.toBeNull();
		await expect(dayButton!.textContent?.trim()).toBe('15');
	};
</script>

<!-- 1. Default — no preselected date, shows current month -->
<Story name="Default [play: date selection]" play={playClickDateSelection}>
	{#snippet template()}
		<div class="p-4">
			<Calendar type="single" />
		</div>
	{/snippet}
</Story>

<!-- 2. Preselected Date — May 15, 2026 -->
<Story name="Preselected Date [play: aria selected]" play={playPreselectedAriaSelected}>
	{#snippet template()}
		<div class="p-4">
			<Calendar type="single" value={new CalendarDate(2026, 5, 15) as DateValue} />
		</div>
	{/snippet}
</Story>

<!-- 3. Min Max Constraint — selectable range: today-7d to today+30d -->
<Story name="Min Max Constraint [play: next month navigation]" play={playNextMonth}>
	{#snippet template()}
		<div class="p-4">
			<Calendar
				type="single"
				minValue={todayDate.subtract({ days: 7 }) as DateValue}
				maxValue={todayDate.add({ days: 30 }) as DateValue}
			/>
		</div>
	{/snippet}
</Story>

<!-- 4. Disabled Dates — weekends (Sat/Sun) are non-interactive -->
<Story name="Disabled Weekends [play: prev month navigation]" play={playPrevMonth}>
	{#snippet template()}
		<div class="p-4">
			<Calendar
				type="single"
				isDateDisabled={(date: DateValue) => {
					const day = date.toDate(tz).getDay();
					return day === 0 || day === 6;
				}}
			/>
		</div>
	{/snippet}
</Story>
