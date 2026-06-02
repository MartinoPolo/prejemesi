<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { StatusBadge, STATUS_BADGE_STATUSES } from './index.js';
	const { Story } = defineMeta({
		title: 'Derived/StatusBadge',
		component: StatusBadge,
		tags: ['autodocs'],
	});
</script>

<Story name="All Statuses">
	{#snippet template()}
		<div class="flex flex-wrap items-center gap-3">
			{#each STATUS_BADGE_STATUSES as status (status)}
				<StatusBadge {status}>{status}</StatusBadge>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Info">
	{#snippet template()}
		<StatusBadge status="info">Information</StatusBadge>
	{/snippet}
</Story>

<Story name="Success">
	{#snippet template()}
		<StatusBadge status="success">Completed</StatusBadge>
	{/snippet}
</Story>

<Story name="Warning">
	{#snippet template()}
		<StatusBadge status="warning">Pending</StatusBadge>
	{/snippet}
</Story>

<Story name="Danger">
	{#snippet template()}
		<StatusBadge status="danger">Error</StatusBadge>
	{/snippet}
</Story>
