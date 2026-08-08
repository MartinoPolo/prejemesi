import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import FilterMenu from './FilterMenu.svelte';
import type { FilterDefinition, FilterToggle } from './filter_menu_types.js';

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

describe('FilterMenu toggles (issue #224 REQ-4)', () => {
	it('excludes toggles from the active-filter count badge', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: true, onchange: () => {} },
		];
		const toggles: FilterToggle[] = [
			{ id: 'group', label: 'Seskupit', checked: true, onchange: () => {} },
		];

		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(FilterMenu, { ...baseProps(), definitions, toggles }, { baseElement: host });
		await tick();

		// Trigger badge counts only the one active filter — the checked toggle is not a filter.
		const trigger = document.querySelector('button') as HTMLElement;
		expect(trigger.textContent).toContain('1');

		// The pills strip lists only real filters, never toggles.
		const pills = document.querySelector('[data-filter-pills]') as HTMLElement;
		expect(pills.textContent).toContain('Dostupné');
		expect(pills.textContent).not.toContain('Seskupit');
	});

	it('renders no toggle group when the prop is omitted', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: false, onchange: () => {} },
		];
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(FilterMenu, { ...baseProps(), definitions }, { baseElement: host });
		await tick();

		expect(document.body.textContent).not.toContain('Seskupit');
	});
});
