import type { ImageFrameProps } from '$lib/modules/images/index.js';

export interface NavDropdownItem {
	name: string;
	meta: string;
	href: string;
	/** Theme emoji — fallback shown in the thumb when the list has no custom image. */
	emoji: string;
	/** Resolved custom cover-image URL, or null to fall back to {@link emoji}. */
	imageUrl: string | null;
	/** Crop/frame props for the 1:1 thumbnail slot, applied when {@link imageUrl} is set. */
	imageFrame: ImageFrameProps;
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
