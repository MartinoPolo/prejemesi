/**
 * Whether the wishlist's event is still ahead. Any earlier instant counts as passed, the same
 * moment the detail page starts offering to archive the wishlist.
 */
export function hasUpcomingEventDate(eventDate: Date | null, now: Date = new Date()): boolean {
	return eventDate !== null && new Date(eventDate).getTime() >= now.getTime();
}
