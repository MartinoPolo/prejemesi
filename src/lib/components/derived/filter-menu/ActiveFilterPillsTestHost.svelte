<script lang="ts">
	import ActiveFilterPills from './ActiveFilterPills.svelte';
	import type { ActiveFilterItem } from './active_filters.js';

	interface Props {
		initialActiveIds?: string[];
		layout?: 'wrap' | 'scroll';
		disabled?: boolean;
	}

	let { initialActiveIds = ['first', 'second'], layout, disabled }: Props = $props();

	function getInitialActiveIds(): string[] {
		return [...initialActiveIds];
	}

	let triggerElement = $state<HTMLButtonElement | null>(null);
	let activeIds = $state(getInitialActiveIds());
	const labels: Record<string, string> = {
		first: 'První',
		second: 'Druhý',
		third: 'Třetí obchod s dlouhým názvem',
		fourth: 'Čtvrtý obchod s dlouhým názvem',
	};
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
	{layout}
	{disabled}
/>
