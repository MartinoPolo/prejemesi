import type { FilterDefinition, FilterFacetGroup } from './filter_menu_types.js';

export interface ActiveFilterItem {
	id: string;
	label: string;
	onremove: () => void;
}

export function normalizeActiveFilters(
	definitions: readonly FilterDefinition[],
	facets: readonly FilterFacetGroup[] = [],
): ActiveFilterItem[] {
	return [
		...definitions
			.filter((definition) => definition.checked)
			.map((definition) => ({
				id: definition.id,
				label: definition.activeLabel ?? definition.menuLabel,
				onremove: () => definition.onchange(false),
			})),
		...facets.flatMap((facet) =>
			facet.options
				.filter((option) => option.checked)
				.map((option) => ({
					id: `${facet.id}:${option.value}`,
					label: option.label,
					onremove: () => option.onchange(false),
				})),
		),
	];
}
