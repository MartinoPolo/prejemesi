export interface NavDropdownItem {
	name: string;
	meta: string;
	href: string;
	emoji: string;
	badgeLabel?: string;
	badgeVariant?: 'shared' | 'draft';
}

export interface NavLink {
	label: string;
	href: string;
}
