export interface FilterDefinition {
	id: string;
	menuLabel: string;
	activeLabel?: string;
	checked: boolean;
	onchange: (checked: boolean) => void;
}

/**
 * A display-preference switch shown in the same dropdown as the filters but semantically distinct
 * (issue #224): it never counts toward the active-filter badge, pills, or clear-all. Used for the
 * „Seskupit podle priority" grouping toggle.
 */
export interface FilterToggle {
	id: string;
	label: string;
	checked: boolean;
	onchange: (checked: boolean) => void;
}
