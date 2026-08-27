import { describe, expect, it, vi } from 'vitest';
import { normalizeActiveFilters } from './active_filters.js';
import type { FilterDefinition, FilterFacetGroup } from './filter_menu_types.js';

describe('normalizeActiveFilters', () => {
	it('uses definition order followed by facet and option order for the shared active list', () => {
		const definitions: FilterDefinition[] = [
			{
				id: 'first',
				menuLabel: 'First menu',
				activeLabel: 'First active',
				checked: true,
				onchange: vi.fn(),
			},
			{ id: 'inactive', menuLabel: 'Inactive', checked: false, onchange: vi.fn() },
			{ id: 'second', menuLabel: 'Second', checked: true, onchange: vi.fn() },
		];
		const facets: FilterFacetGroup[] = [
			{
				id: 'category',
				label: 'Category',
				options: [
					{ value: 'books', label: 'Books', checked: true, onchange: vi.fn() },
					{ value: 'toys', label: 'Toys', checked: true, onchange: vi.fn() },
				],
			},
		];

		expect(
			normalizeActiveFilters(definitions, facets).map(({ id, label }) => ({ id, label })),
		).toEqual([
			{ id: 'first', label: 'First active' },
			{ id: 'second', label: 'Second' },
			{ id: 'category:books', label: 'Books' },
			{ id: 'category:toys', label: 'Toys' },
		]);
	});
});
