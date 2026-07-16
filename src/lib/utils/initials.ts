/**
 * Up to 2 uppercase initials derived from a display name (first letter of the
 * first two words) – the shared avatar-fallback text (issue #158).
 */
export function getInitials(name: string): string {
	return name
		.split(' ')
		.map((part) => part[0])
		.filter(Boolean)
		.slice(0, 2)
		.join('')
		.toUpperCase();
}
