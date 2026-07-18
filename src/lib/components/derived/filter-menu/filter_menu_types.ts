export interface FilterDefinition {
	id: string;
	menuLabel: string;
	activeLabel?: string;
	checked: boolean;
	onchange: (checked: boolean) => void;
}
