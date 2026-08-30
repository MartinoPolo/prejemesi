<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, waitFor } from 'storybook/test';
	import FilterMenu from './FilterMenu.svelte';

	const { Story } = defineMeta({
		title: 'Derived/FilterMenu',
		component: FilterMenu,
		tags: ['autodocs'],
	});

	const playDistinguishesHeadings = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const body = canvasElement.ownerDocument.body;
		await waitFor(() => {
			expect(body.querySelectorAll('[data-filter-group-heading]')).toHaveLength(3);
			expect(body.querySelectorAll('[data-filter-option]')).toHaveLength(9);
		});
		const heading = body.querySelector<HTMLElement>('[data-filter-group-heading]');
		const option = body.querySelector<HTMLElement>('[data-filter-option]');
		const indicator = option?.querySelector<HTMLElement>(
			'[data-slot="dropdown-menu-checkbox-item-indicator"]',
		);
		expect(heading).not.toBeNull();
		expect(option).not.toBeNull();
		expect(indicator).not.toBeNull();
		expect(getComputedStyle(heading!).textTransform).toBe('uppercase');
		expect(getComputedStyle(heading!).pointerEvents).toBe('none');
		expect(getComputedStyle(option!).cursor).toBe('pointer');
		expect(getComputedStyle(indicator!).borderStyle).toBe('solid');
	};
</script>

<script lang="ts">
	import type { FilterDefinition, FilterFacetGroup } from './filter_menu_types.js';

	let open = $state(true);
	let linked = $state(true);
	let received = $state(false);
	let selectedCategories = $state(['electronics']);
	let selectedPriorities = $state(['high', 'medium']);

	const definitions = $derived<FilterDefinition[]>([
		{
			id: 'linked',
			menuLabel: 'S odkazem',
			checked: linked,
			onchange: (checked) => (linked = checked),
		},
		{
			id: 'received',
			menuLabel: 'Zobrazit obdržené',
			checked: received,
			onchange: (checked) => (received = checked),
		},
	]);
	const facets = $derived<FilterFacetGroup[]>([
		{
			id: 'category',
			label: 'Kategorie',
			options: ['Hry', 'Elektronika', 'Bez kategorie'].map((label) => {
				const value = label.toLocaleLowerCase('cs');
				return {
					value,
					label,
					checked: selectedCategories.includes(value),
					onchange: (checked: boolean) => {
						selectedCategories = checked
							? [...selectedCategories, value]
							: selectedCategories.filter((category) => category !== value);
					},
				};
			}),
		},
		{
			id: 'priority',
			label: 'Priorita',
			options: [
				{ value: 'high', label: 'Vysoká' },
				{ value: 'medium', label: 'Střední' },
				{ value: 'low', label: 'Nízká' },
				{ value: 'none', label: 'Bez priority' },
			].map(({ value, label }) => ({
				value,
				label,
				checked: selectedPriorities.includes(value),
				onchange: (checked: boolean) => {
					selectedPriorities = checked
						? [...selectedPriorities, value]
						: selectedPriorities.filter((priority) => priority !== value);
				},
			})),
		},
	]);

	function clearAll() {
		linked = false;
		received = false;
		selectedCategories = [];
		selectedPriorities = [];
	}
</script>

<Story name="Grouped options [play: distinguish headings]" play={playDistinguishesHeadings}>
	{#snippet template()}
		<div class="min-h-130 p-6">
			<FilterMenu
				{definitions}
				{facets}
				{open}
				onopenchange={(nextOpen) => (open = nextOpen)}
				showActivePills={false}
				alwaysShowClearAllInMenu
				triggerLabel="Filtrovat"
				menuHeading="Filtrovat"
				clearAllLabel="Zrušit filtry"
				onclearall={clearAll}
				removeFilterLabel={(label) => `Odebrat filtr ${label}`}
				activeCountLabel={(count) => `${count} aktivní`}
			/>
		</div>
	{/snippet}
</Story>
