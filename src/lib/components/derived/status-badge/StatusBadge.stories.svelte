<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { StatusBadge, STATUS_BADGE_STATUSES } from './index.js';
	const { Story } = defineMeta({
		title: 'Derived/StatusBadge',
		component: StatusBadge,
		tags: ['autodocs'],
	});
</script>

<Story name="Info">
	<StatusBadge status="info">Information</StatusBadge>
</Story>

<Story name="Success">
	<StatusBadge status="success">Completed</StatusBadge>
</Story>

<Story name="Warning">
	<StatusBadge status="warning">Pending</StatusBadge>
</Story>

<Story name="Danger">
	<StatusBadge status="danger">Error</StatusBadge>
</Story>

<Story name="All Statuses">
	<div class="flex flex-wrap items-center gap-3">
		{#each STATUS_BADGE_STATUSES as status (status)}
			<StatusBadge {status}>{status}</StatusBadge>
		{/each}
	</div>
</Story>
