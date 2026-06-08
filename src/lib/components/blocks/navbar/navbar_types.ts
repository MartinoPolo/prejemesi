export interface NavDropdownItem {
	name: string;
	meta: string;
	href: string;
	emoji: string;
	/** Optional day-granular event countdown (e.g. "za 5 dní"), shown after the meta line. */
	countdown?: string;
	badgeLabel?: string;
	badgeVariant?: 'shared' | 'draft';
	/**
	 * Gifter-relative resolution of a followed list. Present → the row is dimmed (no action needed);
	 * `bought` additionally shows a check on the thumb. Absent for owner/moderated rows.
	 */
	resolution?: 'reserved' | 'bought';
}

export interface NavLink {
	label: string;
	href: string;
}
