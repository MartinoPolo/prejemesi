import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import ActiveFilterPillsTestHost from './ActiveFilterPillsTestHost.svelte';
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

	it('removes a filter reactively, hides its pill, and moves focus to the next pill', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(ActiveFilterPillsTestHost, {}, { baseElement: host });

		await screen.getByRole('button', { name: 'Odebrat První' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Odebrat První' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Odebrat Druhý' }).element(),
		);
	});

	it('clears filters reactively, hides all pills, and restores trigger focus', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(ActiveFilterPillsTestHost, {}, { baseElement: host });

		await screen.getByRole('button', { name: 'Vymazat' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Odebrat První' }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Odebrat Druhý' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Filtr' }).element(),
		);
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
