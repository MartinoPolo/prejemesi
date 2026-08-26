import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import FilterMenu from './FilterMenu.svelte';
import type { FilterDefinition, FilterFacetGroup } from './filter_menu_types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

function baseProps() {
	return {
		triggerLabel: 'Filtr',
		menuHeading: 'Filtr',
		clearAllLabel: 'Vymazat',
		onclearall: () => {},
		removeFilterLabel: (label: string) => `Odebrat ${label}`,
		activeCountLabel: (count: number) => `${count} aktivních`,
	};
}

describe('FilterMenu facets', () => {
	it('counts each selected facet value as one active filter and renders a pill', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: true, onchange: () => {} },
		];
		const facets: FilterFacetGroup[] = [
			{
				id: 'category',
				label: 'Kategorie',
				options: [
					{ value: 'books', label: 'Knihy', checked: true, onchange: () => {} },
					{ value: 'toys', label: 'Hračky', checked: false, onchange: () => {} },
				],
			},
		];

		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(FilterMenu, { ...baseProps(), definitions, facets }, { baseElement: host });
		await tick();

		const trigger = document.querySelector('button') as HTMLElement;
		expect(trigger.textContent).toContain('2');

		const pills = document.querySelector('[data-filter-pills]') as HTMLElement;
		expect(pills.textContent).toContain('Dostupné');
		expect(pills.textContent).toContain('Knihy');
		expect(pills.textContent).not.toContain('Hračky');
	});

	it('renders no facet group when the prop is omitted', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: false, onchange: () => {} },
		];
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(FilterMenu, { ...baseProps(), definitions }, { baseElement: host });
		await tick();

		expect(document.body.textContent).not.toContain('Kategorie');
	});
});
