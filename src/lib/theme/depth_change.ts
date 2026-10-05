/**
 * Calls `ondepthchange` whenever the document depth attribute changes. Observing the attribute
 * rather than the switcher event also covers depth set by any other writer.
 * Returns a function that stops observing.
 */
export function observeDepthChange(ondepthchange: () => void): () => void {
	const observer = new MutationObserver(ondepthchange);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-depth'],
	});
	return () => observer.disconnect();
}
