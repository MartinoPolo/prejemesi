export function copyComputedCustomProperties(source: HTMLElement, target: HTMLElement): void {
	// Body-attached clones leave the wishlist theme scope, so materialize inherited tokens.
	const sourceStyle = getComputedStyle(source);
	for (const property of sourceStyle) {
		if (property.startsWith('--')) {
			target.style.setProperty(property, sourceStyle.getPropertyValue(property));
		}
	}
}
