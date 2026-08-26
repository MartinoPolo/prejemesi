export interface FilterDefinition {
	id: string;
	menuLabel: string;
	activeLabel?: string;
	checked: boolean;
	onchange: (checked: boolean) => void;
}

export interface FilterFacetOption {
	value: string;
	label: string;
	checked: boolean;
	onchange: (checked: boolean) => void;
}

export interface FilterFacetGroup {
	id: string;
	label: string;
	options: readonly FilterFacetOption[];
}
