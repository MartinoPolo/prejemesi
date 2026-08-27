<script lang="ts">
	import ActiveFilterPills from './ActiveFilterPills.svelte';
	import type { ActiveFilterItem } from './active_filters.js';

	let triggerElement = $state<HTMLButtonElement | null>(null);
	let activeIds = $state(['first', 'second']);
	const labels: Record<string, string> = { first: 'První', second: 'Druhý' };
	let items = $derived<ActiveFilterItem[]>(
		activeIds.map((id) => ({
			id,
			label: labels[id]!,
			onremove: () => (activeIds = activeIds.filter((activeId) => activeId !== id)),
		})),
	);
</script>

<button bind:this={triggerElement} type="button">Filtr</button>
<ActiveFilterPills
	{items}
	clearAllLabel="Vymazat"
	onclearall={() => (activeIds = [])}
	removeFilterLabel={(label) => `Odebrat ${label}`}
	{triggerElement}
/>
