<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { DatePicker } from './index.js';
	const { Story } = defineMeta({
		title: 'Derived/DatePicker',
		component: DatePicker,
		tags: ['autodocs'],
	});
</script>

<script lang="ts">
	let empty = $state<Date | null>(null);
	let prefilled = $state<Date | null>(new Date(2026, 11, 24));
</script>

<Story name="Empty">
	{#snippet template()}
		<div class="max-w-xs">
			<DatePicker bind:value={empty} />
		</div>
	{/snippet}
</Story>

<Story name="Prefilled">
	{#snippet template()}
		<div class="max-w-xs">
			<DatePicker bind:value={prefilled} />
		</div>
	{/snippet}
</Story>

<Story name="Disabled">
	{#snippet template()}
		<div class="max-w-xs">
			<DatePicker value={new Date(2026, 11, 24)} disabled />
		</div>
	{/snippet}
</Story>
