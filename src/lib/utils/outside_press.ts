/**
 * Calls `close` for a press outside every given element. Listens in the capture phase: gift cards
 * stop pointerdown propagation for their own gestures, which hides the press from bubble-phase
 * outside detection. Returns the cleanup, so an `$effect` can return it.
 */
export function closeOnOutsidePress(
	insideElements: () => readonly (HTMLElement | null)[],
	close: () => void,
): () => void {
	function handlePress(event: PointerEvent) {
		const target = event.target;
		const inside =
			target instanceof Node &&
			insideElements().some((element) => element?.contains(target) === true);
		if (!inside) {
			close();
		}
	}
	document.addEventListener('pointerdown', handlePress, true);
	return () => document.removeEventListener('pointerdown', handlePress, true);
}
