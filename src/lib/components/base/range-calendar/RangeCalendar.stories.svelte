<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import { RangeCalendar } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/RangeCalendar',
		component: RangeCalendar,
		tags: ['autodocs'],
	});

	/** Click start date → first click selects range-start */
	const playSelectStart = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);

		const dayButtons = canvas
			.getAllByRole('button')
			.filter(
				(button) =>
					button.hasAttribute('data-bits-day') &&
					!button.hasAttribute('data-outside-month') &&
					!button.hasAttribute('data-disabled'),
			);

		const startDay = dayButtons[7]; // pick an early-mid day
		await userEvent.click(startDay);

		// After first click, the day should be range-start
		await expect(startDay).toHaveAttribute('data-selection-start', '');
	};

	/** Click start then end → full range with highlight between */
	const playSelectFullRange = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);

		const dayButtons = canvas
			.getAllByRole('button')
			.filter(
				(button) =>
					button.hasAttribute('data-bits-day') &&
					!button.hasAttribute('data-outside-month') &&
					!button.hasAttribute('data-disabled'),
			);

		const startDay = dayButtons[5];
		const endDay = dayButtons[15];

		// Click start
		await userEvent.click(startDay);
		await expect(startDay).toHaveAttribute('data-selection-start', '');

		// Click end
		await userEvent.click(endDay);

		// Verify range endpoints
		await expect(startDay).toHaveAttribute('data-range-start', '');
		await expect(endDay).toHaveAttribute('data-range-end', '');

		// Verify middle days have data-range-middle
		const middleDays = canvas
			.getAllByRole('button')
			.filter((button) => button.hasAttribute('data-range-middle'));
		await expect(middleDays.length).toBeGreaterThan(0);
	};

	/** Verify pre-populated full range has correct start/end attributes */
	const playFullRangePreselected = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);

		// Find range-start and range-end day buttons
		const rangeStartDays = canvas
			.getAllByRole('button')
			.filter((button) => button.hasAttribute('data-range-start'));
		const rangeEndDays = canvas
			.getAllByRole('button')
			.filter((button) => button.hasAttribute('data-range-end'));

		await expect(rangeStartDays.length).toBe(1);
		await expect(rangeEndDays.length).toBe(1);

		// Middle days should exist
		const middleDays = canvas
			.getAllByRole('button')
			.filter((button) => button.hasAttribute('data-range-middle'));
		await expect(middleDays.length).toBeGreaterThan(0);
	};
</script>

<script lang="ts">
	import { CalendarDate } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';

	const partialRange: DateRange = {
		start: new CalendarDate(2026, 5, 10),
		end: undefined,
	};

	const fullRange: DateRange = {
		start: new CalendarDate(2026, 5, 10),
		end: new CalendarDate(2026, 5, 20),
	};

	const placeholder = new CalendarDate(2026, 5, 1);
</script>

<Story name="Empty [play: select full range]" play={playSelectFullRange}>
	{#snippet template()}
		<div class="p-4">
			<RangeCalendar {placeholder} />
		</div>
	{/snippet}
</Story>

<Story name="Partial Selection [play: select start]" play={playSelectStart}>
	{#snippet template()}
		<div class="p-4">
			<RangeCalendar value={partialRange} {placeholder} />
		</div>
	{/snippet}
</Story>

<Story name="Full Range [play: range preselected]" play={playFullRangePreselected}>
	{#snippet template()}
		<div class="p-4">
			<RangeCalendar value={fullRange} {placeholder} />
		</div>
	{/snippet}
</Story>

<Story name="Single Month [play: select full range]" play={playSelectFullRange}>
	{#snippet template()}
		<div class="p-4">
			<RangeCalendar numberOfMonths={1} {placeholder} />
		</div>
	{/snippet}
</Story>

<Story name="Two Month">
	{#snippet template()}
		<div class="p-4">
			<RangeCalendar numberOfMonths={2} pagedNavigation={true} {placeholder} />
		</div>
	{/snippet}
</Story>
