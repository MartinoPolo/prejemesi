/** Picker value that creates the destination first; `#` never occurs in generated wishlist ids. */
export const NEW_WISHLIST_DESTINATION = '#new-wishlist';

export interface BulkCopyDestination {
	id: string;
	title: string;
	status: 'draft' | 'active' | 'archived';
	recipientDisplayName: string;
	/** Whether copies may link to their sources; `null` for a list just created, decided server-side. */
	linkable: boolean | null;
}
